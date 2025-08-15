# Repository Map Cache Architecture

## Executive Summary

This document defines the comprehensive caching strategy for the tree-sitter repository map system. The architecture implements a three-level cache hierarchy optimized for performance, reliability, and scalability, using SQLite via diskcache for persistence and implementing robust invalidation and fallback mechanisms.

## Architecture Overview

### Three-Level Cache Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                   L1: In-Memory Cache                    │
│  • Hot data (LRU, 500-1000 items)                       │
│  • Sub-millisecond access                               │
│  • Thread-safe via GIL                                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   L2: Disk Cache                        │
│  • Warm data (SQLite via diskcache)                    │
│  • 10-50ms access                                      │
│  • Process-safe, persistent                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   L3: Source Files                      │
│  • Ultimate truth                                      │
│  • Regeneration on miss                                │
│  • 100-500ms processing                                │
└─────────────────────────────────────────────────────────┘
```

### Cache Levels Detail

#### Level 1: In-Memory Cache (Hot Data)
- **Purpose**: Ultra-fast access to frequently used data
- **Implementation**: Python dict with LRU eviction wrapper
- **Capacity**: 500-1000 items per cache type
- **TTL**: Session duration
- **Hit Rate Target**: >80% for active files

#### Level 2: Disk Cache (Warm Data)
- **Purpose**: Persistent storage across sessions
- **Implementation**: SQLite via diskcache library
- **Capacity**: 100MB-1GB configurable
- **TTL**: Based on file modification time
- **Hit Rate Target**: >95% combined with L1

#### Level 3: Source Files (Cold Data)
- **Purpose**: Ground truth for regeneration
- **Implementation**: Direct file system access
- **Processing**: Tree-sitter parsing and analysis
- **Caching**: Results promoted to L1 and L2

## Cache Types and Structures

### 1. Tag Cache
Stores extracted AST tags per file.

```python
@dataclass
class TagCacheEntry:
    filepath: str
    mtime: float
    content_hash: str
    tags: List[Tag]
    language: str
    parse_time: float
    cache_version: int

class TagCache:
    def __init__(self, cache_dir: Path):
        self.l1_cache: Dict[str, TagCacheEntry] = LRUCache(maxsize=500)
        self.l2_cache: Cache = Cache(
            cache_dir / "tags",
            size_limit=100 * 1024 * 1024,  # 100MB
            eviction_policy='least-recently-used'
        )
    
    def get(self, filepath: str) -> Optional[List[Tag]]:
        """Get tags with cache hierarchy traversal."""
        
    def set(self, filepath: str, tags: List[Tag]) -> None:
        """Set tags in both cache levels."""
        
    def invalidate(self, filepath: str) -> None:
        """Invalidate entry in all cache levels."""
```

### 2. Map Cache
Stores generated repository maps.

```python
@dataclass
class MapCacheKey:
    chat_files: FrozenSet[str]
    other_files: FrozenSet[str]
    max_tokens: int
    mentioned_fnames: FrozenSet[str]
    mentioned_idents: FrozenSet[str]
    
    def to_hash(self) -> str:
        """Generate stable hash for cache key."""

@dataclass
class MapCacheEntry:
    key: MapCacheKey
    content: str
    token_count: int
    generation_time: float
    access_count: int
    last_access: float

class MapCache:
    def __init__(self, cache_dir: Path):
        self.l1_cache: Dict[str, MapCacheEntry] = LRUCache(maxsize=100)
        self.l2_cache: Cache = Cache(
            cache_dir / "maps",
            size_limit=50 * 1024 * 1024,  # 50MB
            eviction_policy='least-frequently-used'
        )
```

### 3. Tree Render Cache
Stores formatted tree representations.

```python
@dataclass
class TreeCacheEntry:
    filepath: str
    lines_of_interest: FrozenSet[int]
    mtime: float
    rendered_tree: str
    render_time: float

class TreeCache:
    def __init__(self, cache_dir: Path):
        self.l1_cache: Dict[str, TreeCacheEntry] = LRUCache(maxsize=200)
        self.l2_cache: Cache = Cache(
            cache_dir / "trees",
            size_limit=20 * 1024 * 1024,  # 20MB
            eviction_policy='least-recently-used'
        )
```

## Cache Key Strategies

### File-Based Keys
```python
def generate_file_key(filepath: str, mtime: float) -> str:
    """Generate cache key for file-based entries."""
    return f"{filepath}:{mtime}:{CACHE_VERSION}"
```

### Content-Based Keys
```python
def generate_content_key(content: str) -> str:
    """Generate cache key based on content hash."""
    return hashlib.sha256(content.encode()).hexdigest()[:16]
```

### Composite Keys
```python
def generate_map_key(
    chat_files: Set[str],
    other_files: Set[str],
    max_tokens: int,
    context: Dict
) -> str:
    """Generate stable key for map cache."""
    key_data = {
        'chat': sorted(chat_files),
        'other': sorted(other_files),
        'tokens': max_tokens,
        'mentions': sorted(context.get('mentions', []))
    }
    key_json = json.dumps(key_data, sort_keys=True)
    return hashlib.sha256(key_json.encode()).hexdigest()[:16]
```

## Invalidation Policies

### Time-Based Invalidation
```python
class InvalidationPolicy:
    def __init__(self):
        self.ttl_seconds = {
            'tags': 3600 * 24 * 7,    # 1 week
            'maps': 3600,             # 1 hour
            'trees': 3600 * 24,       # 1 day
        }
    
    def is_expired(self, entry_type: str, timestamp: float) -> bool:
        ttl = self.ttl_seconds.get(entry_type, 3600)
        return time.time() - timestamp > ttl
```

### File Modification Invalidation
```python
class FileWatcher:
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
        self.file_mtimes: Dict[str, float] = {}
    
    def check_invalidation(self, filepath: str) -> bool:
        """Check if file has been modified since caching."""
        current_mtime = os.path.getmtime(filepath)
        cached_mtime = self.file_mtimes.get(filepath, 0)
        
        if current_mtime > cached_mtime:
            self.cache_manager.invalidate_file(filepath)
            self.file_mtimes[filepath] = current_mtime
            return True
        return False
```

### Dependency Invalidation
```python
class DependencyTracker:
    def __init__(self):
        self.dependencies: Dict[str, Set[str]] = {}
    
    def add_dependency(self, cache_key: str, filepath: str):
        """Track file dependencies for cache entries."""
        if cache_key not in self.dependencies:
            self.dependencies[cache_key] = set()
        self.dependencies[cache_key].add(filepath)
    
    def invalidate_dependents(self, filepath: str) -> Set[str]:
        """Invalidate all cache entries depending on file."""
        invalidated = set()
        for key, deps in self.dependencies.items():
            if filepath in deps:
                invalidated.add(key)
        return invalidated
```

## Fallback Mechanisms

### Cache Corruption Recovery
```python
class CacheRecovery:
    @staticmethod
    def recover_from_corruption(cache_dir: Path) -> Cache:
        """Recover from corrupted cache."""
        try:
            # Try to open existing cache
            return Cache(cache_dir)
        except Exception as e:
            logger.warning(f"Cache corrupted: {e}")
            
            # Backup corrupted cache
            backup_dir = cache_dir.with_suffix('.corrupted')
            if cache_dir.exists():
                shutil.move(cache_dir, backup_dir)
            
            # Create fresh cache
            return Cache(cache_dir)
```

### Graceful Degradation
```python
class CacheFallback:
    def __init__(self):
        self.fallback_strategies = [
            self._try_memory_cache,
            self._try_disk_cache,
            self._try_regenerate,
            self._return_minimal
        ]
    
    def get_with_fallback(self, key: str) -> Optional[Any]:
        """Try multiple strategies to get data."""
        for strategy in self.fallback_strategies:
            try:
                result = strategy(key)
                if result is not None:
                    return result
            except Exception as e:
                logger.debug(f"Strategy {strategy.__name__} failed: {e}")
        return None
```

### Error Recovery
```python
class ErrorHandler:
    @staticmethod
    def handle_sqlite_error(error: sqlite3.Error, cache: Cache) -> None:
        """Handle SQLite-specific errors."""
        if isinstance(error, sqlite3.OperationalError):
            if "database is locked" in str(error):
                # Retry with exponential backoff
                time.sleep(0.1)
                return
            elif "disk I/O error" in str(error):
                # Fall back to memory-only cache
                return MemoryOnlyCache()
        
        # Log and continue without cache
        logger.error(f"Cache error: {error}")
        return NullCache()
```

## Size Management

### Cache Size Limits
```python
class CacheSizeManager:
    def __init__(self):
        self.size_limits = {
            'tags': 100 * 1024 * 1024,    # 100MB
            'maps': 50 * 1024 * 1024,      # 50MB
            'trees': 20 * 1024 * 1024,     # 20MB
            'total': 200 * 1024 * 1024,    # 200MB total
        }
    
    def enforce_limits(self, cache_type: str, cache: Cache):
        """Enforce size limits for cache type."""
        limit = self.size_limits[cache_type]
        if cache.volume() > limit:
            self.evict_oldest(cache, target_size=limit * 0.8)
```

### Eviction Strategies
```python
class EvictionPolicy:
    @staticmethod
    def lru_evict(cache: Cache, target_size: int):
        """Least Recently Used eviction."""
        items = sorted(
            cache.items(),
            key=lambda x: x[1].get('last_access', 0)
        )
        
        current_size = cache.volume()
        for key, _ in items:
            if current_size <= target_size:
                break
            size = cache.get_size(key)
            del cache[key]
            current_size -= size
    
    @staticmethod
    def lfu_evict(cache: Cache, target_size: int):
        """Least Frequently Used eviction."""
        items = sorted(
            cache.items(),
            key=lambda x: x[1].get('access_count', 0)
        )
        # Similar eviction logic
```

### Memory Management
```python
class MemoryMonitor:
    def __init__(self, threshold_mb: int = 100):
        self.threshold = threshold_mb * 1024 * 1024
    
    def check_memory_pressure(self) -> bool:
        """Check if memory usage is too high."""
        import psutil
        process = psutil.Process()
        memory_info = process.memory_info()
        return memory_info.rss > self.threshold
    
    def reduce_memory_usage(self, cache_manager: CacheManager):
        """Reduce memory usage when pressure detected."""
        if self.check_memory_pressure():
            # Clear L1 caches
            cache_manager.clear_memory_caches()
            # Force garbage collection
            import gc
            gc.collect()
```

## Concurrent Access Patterns

### Thread Safety
```python
class ThreadSafeCache:
    def __init__(self, cache_dir: Path):
        self.lock = threading.RLock()
        self.cache = Cache(cache_dir)
    
    def get(self, key: str) -> Optional[Any]:
        with self.lock:
            return self.cache.get(key)
    
    def set(self, key: str, value: Any) -> None:
        with self.lock:
            self.cache[key] = value
```

### SQLite Optimization
```python
class SQLiteOptimizer:
    @staticmethod
    def optimize_for_concurrency(db_path: Path):
        """Configure SQLite for concurrent access."""
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=10000")
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.close()
```

### Connection Pooling
```python
class ConnectionPool:
    def __init__(self, db_path: Path, max_connections: int = 5):
        self.db_path = db_path
        self.connections = queue.Queue(maxsize=max_connections)
        
        # Pre-create connections
        for _ in range(max_connections):
            conn = sqlite3.connect(db_path)
            self.connections.put(conn)
    
    @contextmanager
    def get_connection(self):
        conn = self.connections.get()
        try:
            yield conn
        finally:
            self.connections.put(conn)
```

## Performance Optimization

### Cache Warming
```python
class CacheWarmer:
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
    
    def warm_cache_async(self, files: List[str]):
        """Warm cache in background."""
        def warm():
            for filepath in files:
                try:
                    self.cache_manager.get_or_generate(filepath)
                except Exception as e:
                    logger.debug(f"Failed to warm {filepath}: {e}")
        
        thread = threading.Thread(target=warm, daemon=True)
        thread.start()
```

### Batch Operations
```python
class BatchCacheOperations:
    def batch_get(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple cache entries efficiently."""
        results = {}
        
        # Check L1 first
        l1_misses = []
        for key in keys:
            if key in self.l1_cache:
                results[key] = self.l1_cache[key]
            else:
                l1_misses.append(key)
        
        # Batch L2 lookup
        if l1_misses:
            with self.l2_cache.transact():
                for key in l1_misses:
                    value = self.l2_cache.get(key)
                    if value:
                        results[key] = value
                        self.l1_cache[key] = value
        
        return results
```

## Monitoring and Metrics

### Cache Statistics
```python
@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    corruptions: int = 0
    total_size_bytes: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

class CacheMonitor:
    def __init__(self):
        self.stats = defaultdict(CacheStats)
    
    def record_hit(self, cache_type: str):
        self.stats[cache_type].hits += 1
    
    def record_miss(self, cache_type: str):
        self.stats[cache_type].misses += 1
    
    def get_report(self) -> Dict[str, Dict]:
        return {
            cache_type: {
                'hit_rate': stats.hit_rate,
                'total_requests': stats.hits + stats.misses,
                'size_mb': stats.total_size_bytes / (1024 * 1024)
            }
            for cache_type, stats in self.stats.items()
        }
```

## Configuration

### Environment Variables
```bash
# Cache configuration
REPO_MAP_CACHE_DIR=.aider.tags.cache.v4
REPO_MAP_CACHE_SIZE_MB=200
REPO_MAP_CACHE_L1_SIZE=1000
REPO_MAP_CACHE_TTL_HOURS=24
REPO_MAP_CACHE_REFRESH_MODE=auto  # auto|manual|always|files
```

### Configuration Class
```python
@dataclass
class CacheConfig:
    cache_dir: Path = Path(".aider.tags.cache.v4")
    max_size_mb: int = 200
    l1_max_items: int = 1000
    ttl_hours: int = 24
    refresh_mode: str = "auto"
    enable_warming: bool = True
    enable_metrics: bool = True
    
    @classmethod
    def from_env(cls) -> 'CacheConfig':
        """Load configuration from environment."""
        return cls(
            cache_dir=Path(os.getenv('REPO_MAP_CACHE_DIR', cls.cache_dir)),
            max_size_mb=int(os.getenv('REPO_MAP_CACHE_SIZE_MB', cls.max_size_mb)),
            # ... etc
        )
```

## Implementation Interface

### Main Cache Manager
```python
class CacheManager:
    """Main interface for all caching operations."""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.tag_cache = TagCache(config.cache_dir)
        self.map_cache = MapCache(config.cache_dir)
        self.tree_cache = TreeCache(config.cache_dir)
        self.monitor = CacheMonitor()
        
        # Initialize SQLite optimization
        SQLiteOptimizer.optimize_for_concurrency(config.cache_dir / "cache.db")
    
    def get_tags(self, filepath: str) -> Optional[List[Tag]]:
        """Get tags with full cache hierarchy."""
        # Check file modification
        if self._is_modified(filepath):
            self.invalidate_file(filepath)
            return None
        
        # Try cache hierarchy
        tags = self.tag_cache.get(filepath)
        if tags:
            self.monitor.record_hit('tags')
        else:
            self.monitor.record_miss('tags')
        
        return tags
    
    def set_tags(self, filepath: str, tags: List[Tag]):
        """Set tags in cache hierarchy."""
        mtime = os.path.getmtime(filepath)
        entry = TagCacheEntry(
            filepath=filepath,
            mtime=mtime,
            tags=tags,
            cache_version=CACHE_VERSION
        )
        self.tag_cache.set(filepath, entry)
    
    def clear_all(self):
        """Clear all caches."""
        self.tag_cache.clear()
        self.map_cache.clear()
        self.tree_cache.clear()
    
    def get_statistics(self) -> Dict:
        """Get cache performance statistics."""
        return self.monitor.get_report()
```

## Testing Strategy

### Unit Tests
```python
class TestCacheManager:
    def test_cache_hierarchy(self):
        """Test L1 -> L2 -> L3 hierarchy."""
        
    def test_invalidation(self):
        """Test cache invalidation on file change."""
        
    def test_concurrent_access(self):
        """Test thread-safe concurrent access."""
        
    def test_corruption_recovery(self):
        """Test recovery from corrupted cache."""
        
    def test_size_limits(self):
        """Test cache size enforcement."""
```

### Performance Tests
```python
class TestCachePerformance:
    def test_cache_hit_performance(self):
        """Verify L1 cache < 1ms, L2 cache < 50ms."""
        
    def test_large_repo_performance(self):
        """Test with 10,000+ file repository."""
        
    def test_memory_usage(self):
        """Verify memory stays under limits."""
```

## Success Metrics

- **L1 Hit Rate**: > 80% for active files
- **L2 Hit Rate**: > 95% combined with L1
- **Cache Retrieval**: L1 < 1ms, L2 < 50ms
- **Memory Usage**: < 100MB for typical repos
- **Corruption Recovery**: < 5s to rebuild
- **Concurrent Access**: No deadlocks, < 100ms wait time

## Summary

This cache architecture provides:

1. **High Performance**: Three-level hierarchy optimizes for speed
2. **Reliability**: Robust error handling and corruption recovery
3. **Scalability**: Handles large repositories efficiently
4. **Concurrency**: Thread and process-safe operations
5. **Maintainability**: Clear interfaces and monitoring

The implementation uses industry best practices for caching AST parsing results and generated code maps, ensuring optimal performance while maintaining data consistency and reliability.