# Cache Implementation Guide

## Quick Start for Engineers

This guide provides practical implementation patterns for integrating with the cache architecture.

## For DavidStream: Tag Cache Integration

### Basic Usage Pattern
```python
from repo_map_cache import TagCache
from pathlib import Path

class TagExtractor:
    def __init__(self):
        self.cache = TagCache(Path(".aider.tags.cache.v4"))
    
    def extract_tags(self, filepath: str) -> List[Tag]:
        # Check cache first
        cached_tags = self.cache.get(filepath)
        if cached_tags:
            return cached_tags
        
        # Parse file if cache miss
        tags = self._parse_with_treesitter(filepath)
        
        # Store in cache for next time
        self.cache.set(filepath, tags)
        
        return tags
    
    def _parse_with_treesitter(self, filepath: str) -> List[Tag]:
        # Your tree-sitter parsing logic here
        parser = self.get_parser_for_file(filepath)
        # ... parsing logic ...
        return tags
```

### Error Handling Pattern
```python
def extract_tags_safe(self, filepath: str) -> List[Tag]:
    try:
        return self.cache.get(filepath)
    except CacheCorruptionError:
        # Cache will auto-recover, just regenerate
        return self._parse_with_treesitter(filepath)
```

## For AlexTensor: Map Cache Integration

### Storing PageRank Results
```python
from repo_map_cache import MapCache, MapCacheKey

class RankCalculator:
    def __init__(self):
        self.cache = MapCache(Path(".aider.tags.cache.v4"))
    
    def calculate_ranks(
        self,
        chat_files: Set[str],
        other_files: Set[str],
        max_tokens: int
    ) -> str:
        # Create cache key
        cache_key = MapCacheKey(
            chat_files=frozenset(chat_files),
            other_files=frozenset(other_files),
            max_tokens=max_tokens,
            mentioned_fnames=frozenset(),
            mentioned_idents=frozenset()
        )
        
        # Check cache
        cached_map = self.cache.get(cache_key)
        if cached_map:
            return cached_map
        
        # Calculate if cache miss
        ranked_map = self._run_pagerank(chat_files, other_files)
        
        # Store result
        self.cache.set(cache_key, ranked_map)
        
        return ranked_map
```

### Batch Operations for Performance
```python
def process_multiple_contexts(self, contexts: List[Dict]) -> Dict[str, str]:
    # Prepare all cache keys
    keys = [
        MapCacheKey(
            chat_files=frozenset(ctx['chat']),
            other_files=frozenset(ctx['other']),
            max_tokens=ctx['tokens']
        )
        for ctx in contexts
    ]
    
    # Batch fetch from cache
    results = self.cache.batch_get(keys)
    
    # Process misses
    for key, ctx in zip(keys, contexts):
        if key not in results:
            results[key] = self._run_pagerank(
                ctx['chat'], 
                ctx['other']
            )
            self.cache.set(key, results[key])
    
    return results
```

## For LiamAstral: Query Result Caching

### Caching Rendered Trees
```python
from repo_map_cache import TreeCache

class QueryProcessor:
    def __init__(self):
        self.cache = TreeCache(Path(".aider.tags.cache.v4"))
    
    def render_tree(
        self,
        filepath: str,
        lines_of_interest: Set[int]
    ) -> str:
        # Check cache with lines of interest
        cached_tree = self.cache.get(filepath, lines_of_interest)
        if cached_tree:
            return cached_tree
        
        # Render if cache miss
        tree = self._apply_query_and_render(filepath, lines_of_interest)
        
        # Cache the result
        self.cache.set(filepath, lines_of_interest, tree)
        
        return tree
```

## Common Patterns for All Engineers

### 1. Cache Warming (Background Processing)
```python
from concurrent.futures import ThreadPoolExecutor

class CacheWarmer:
    def warm_cache_async(self, files: List[str]):
        """Pre-populate cache in background."""
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            for filepath in files:
                future = executor.submit(self.process_file, filepath)
                futures.append(future)
            
            # Don't wait for completion - let it run in background
            return futures
```

### 2. Invalidation on File Change
```python
class FileChangeHandler:
    def handle_file_modified(self, filepath: str):
        """Invalidate all caches for modified file."""
        self.tag_cache.invalidate(filepath)
        self.map_cache.invalidate_by_file(filepath)
        self.tree_cache.invalidate(filepath)
```

### 3. Memory Pressure Handling
```python
class MemoryAwareCache:
    def check_memory_and_adapt(self):
        """Adapt cache behavior under memory pressure."""
        if self.memory_monitor.is_high_pressure():
            # Reduce L1 cache size
            self.tag_cache.reduce_l1_size(250)
            # Force eviction
            self.tag_cache.evict_lru(target_items=100)
```

### 4. Concurrent Access Pattern
```python
from threading import Lock

class ThreadSafeOperations:
    def __init__(self):
        self.lock = Lock()
        self.cache = TagCache(Path(".aider.tags.cache.v4"))
    
    def get_or_compute(self, filepath: str) -> List[Tag]:
        # Try without lock first (read is safe)
        tags = self.cache.get(filepath)
        if tags:
            return tags
        
        # Acquire lock for write operation
        with self.lock:
            # Double-check after acquiring lock
            tags = self.cache.get(filepath)
            if tags:
                return tags
            
            # Compute and cache
            tags = self._compute_tags(filepath)
            self.cache.set(filepath, tags)
            return tags
```

## Configuration Examples

### Environment-Based Configuration
```bash
# .env file
REPO_MAP_CACHE_DIR=.cache/repo_map
REPO_MAP_CACHE_SIZE_MB=200
REPO_MAP_CACHE_L1_SIZE=1000
REPO_MAP_CACHE_REFRESH_MODE=auto
```

### Code Configuration
```python
from repo_map_cache import CacheConfig, CacheManager

# Load from environment
config = CacheConfig.from_env()

# Or configure programmatically
config = CacheConfig(
    cache_dir=Path(".custom_cache"),
    max_size_mb=100,
    l1_max_items=500,
    refresh_mode="files"  # Refresh when files change
)

# Initialize cache manager
cache_manager = CacheManager(config)
```

## Testing Your Cache Integration

### Unit Test Template
```python
import tempfile
from pathlib import Path

class TestCacheIntegration:
    def setup_method(self):
        # Use temporary directory for tests
        self.temp_dir = tempfile.mkdtemp()
        self.cache = TagCache(Path(self.temp_dir))
    
    def test_cache_hit(self):
        # Store in cache
        tags = [Tag("func1", "def", 10)]
        self.cache.set("test.py", tags)
        
        # Retrieve should hit cache
        cached = self.cache.get("test.py")
        assert cached == tags
        assert self.cache.stats.hits == 1
    
    def test_cache_invalidation(self):
        # Store in cache
        self.cache.set("test.py", [Tag("func1", "def", 10)])
        
        # Invalidate
        self.cache.invalidate("test.py")
        
        # Should return None (cache miss)
        assert self.cache.get("test.py") is None
    
    def teardown_method(self):
        # Clean up temp directory
        import shutil
        shutil.rmtree(self.temp_dir)
```

### Performance Test Template
```python
import time

class TestCachePerformance:
    def test_cache_speed(self):
        # Populate cache
        for i in range(1000):
            self.cache.set(f"file{i}.py", [Tag(f"func{i}", "def", i)])
        
        # Test L1 cache speed
        start = time.time()
        for i in range(100):
            self.cache.get(f"file{i}.py")
        l1_time = time.time() - start
        
        assert l1_time < 0.01  # Should be < 10ms for 100 lookups
```

## Debugging Cache Issues

### Enable Debug Logging
```python
import logging

# Enable cache debug logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('repo_map_cache')
logger.setLevel(logging.DEBUG)
```

### Cache Statistics
```python
# Get cache statistics
stats = cache_manager.get_statistics()
print(f"Tag cache hit rate: {stats['tags']['hit_rate']:.2%}")
print(f"Map cache size: {stats['maps']['size_mb']:.1f} MB")
print(f"Total cache requests: {stats['total_requests']}")
```

### Cache Inspection
```python
# Inspect cache contents
def inspect_cache(cache_dir: Path):
    from diskcache import Cache
    cache = Cache(cache_dir / "tags")
    
    print(f"Cache size: {cache.volume() / 1024 / 1024:.1f} MB")
    print(f"Number of entries: {len(cache)}")
    
    # List recent entries
    for key in list(cache.iterkeys())[:10]:
        entry = cache[key]
        print(f"  {key}: {len(entry.get('tags', []))} tags")
```

## Common Pitfalls to Avoid

1. **Don't cache mutable objects directly** - Always deep copy or serialize
2. **Don't ignore cache errors** - They indicate deeper issues
3. **Don't skip invalidation** - Stale cache is worse than no cache
4. **Don't use unhashable keys** - Convert sets to frozensets
5. **Don't forget to close connections** - Use context managers

## Integration Checklist

- [ ] Cache initialization in constructor
- [ ] Cache check before expensive operations
- [ ] Cache set after computation
- [ ] Error handling for cache failures
- [ ] Invalidation on file changes
- [ ] Memory pressure handling
- [ ] Thread safety for concurrent access
- [ ] Unit tests for cache behavior
- [ ] Performance tests for cache speed
- [ ] Configuration from environment
- [ ] Logging for debugging
- [ ] Statistics collection

## Support

For questions or issues:
1. Check cache statistics first
2. Enable debug logging
3. Inspect cache contents
4. Review this guide
5. Ask TanyaSigma for architectural guidance