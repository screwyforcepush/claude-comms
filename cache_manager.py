"""
Three-Level Cache System for Tree-Sitter Repository Map

This module implements a comprehensive caching system with:
- TagCache: Stores AST tags per file with diskcache
- MapCache: Stores generated repository maps with SQLite
- TreeCache: Stores formatted tree representations with memory fallback

Architecture:
- L1: In-memory cache (hot data, <1ms access)  
- L2: Disk cache via diskcache/SQLite (warm data, <50ms access)
- L3: Source files (cold data, regeneration required)

Performance Targets:
- L1 Hit Rate: >80% for active files
- L2 Hit Rate: >95% combined with L1
- Memory Usage: <100MB for typical repos
- Cache Retrieval: L1 <1ms, L2 <50ms

Integration Points:
- NinaMatrix: TagCache for AST parsing results
- RobertNova: MapCache for PageRank rankings  
- SophiaQubit: TreeCache for token optimization
- OliviaChain: Language-specific caching support
"""

import os
import sys
import time
import json
import hashlib
import sqlite3
import threading
import logging
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Set, Optional, FrozenSet, Any, Union
from collections import defaultdict, OrderedDict
from contextlib import contextmanager
import weakref
import gc

try:
    import diskcache
except ImportError:
    diskcache = None

try:
    import psutil
except ImportError:
    psutil = None

# Cache version for compatibility checks
CACHE_VERSION = 4

# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# Exception Classes
# ============================================================================

class CacheError(Exception):
    """Base exception for cache operations."""
    pass


class CacheCorruptionError(CacheError):
    """Raised when cache data is corrupted."""
    pass


class CacheFullError(CacheError):
    """Raised when cache has reached size limits."""
    pass


class CacheMissError(CacheError):
    """Raised on cache miss (optional strict mode)."""
    pass


# ============================================================================
# Data Structures
# ============================================================================

@dataclass
class Tag:
    """AST tag structure for tree-sitter parsing results."""
    name: str
    kind: str
    line: int
    column: Optional[int] = None
    file: Optional[str] = None


@dataclass 
class TagCacheEntry:
    """Cache entry for tag data with metadata."""
    filepath: str
    mtime: float
    content_hash: str
    tags: List[Tag]
    language: str
    parse_time: float
    cache_version: int = CACHE_VERSION
    
    def is_valid(self) -> bool:
        """Check if cache entry is valid."""
        return (
            self.cache_version == CACHE_VERSION and
            self.mtime > 0 and
            len(self.content_hash) > 0
        )


@dataclass
class MapCacheKey:
    """Cache key for repository map requests."""
    chat_files: FrozenSet[str]
    other_files: FrozenSet[str] 
    max_tokens: int
    mentioned_fnames: FrozenSet[str]
    mentioned_idents: FrozenSet[str]
    
    def to_hash(self) -> str:
        """Generate stable hash for cache key."""
        key_data = {
            'chat': sorted(self.chat_files),
            'other': sorted(self.other_files),
            'tokens': self.max_tokens,
            'fnames': sorted(self.mentioned_fnames),
            'idents': sorted(self.mentioned_idents),
            'version': CACHE_VERSION
        }
        key_json = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_json.encode()).hexdigest()[:16]


@dataclass
class MapCacheEntry:
    """Cache entry for generated repository maps."""
    key: MapCacheKey
    content: str
    token_count: int
    generation_time: float
    access_count: int = 0
    last_access: float = 0.0
    cache_version: int = CACHE_VERSION
    
    def update_access(self):
        """Update access statistics."""
        self.access_count += 1
        self.last_access = time.time()


@dataclass
class TreeCacheEntry:
    """Cache entry for rendered tree representations."""
    filepath: str
    lines_of_interest: FrozenSet[int]
    mtime: float
    rendered_tree: str
    render_time: float
    cache_version: int = CACHE_VERSION
    
    def get_key(self) -> str:
        """Generate cache key for tree entry."""
        lines_str = ','.join(map(str, sorted(self.lines_of_interest)))
        key_data = f"{self.filepath}:{lines_str}:{self.mtime}:{CACHE_VERSION}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]


@dataclass
class CacheStats:
    """Cache statistics tracking."""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    corruptions: int = 0
    total_size_bytes: int = 0
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
    
    @property 
    def size_mb(self) -> float:
        """Get cache size in megabytes."""
        return self.total_size_bytes / (1024 * 1024)


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class CacheConfig:
    """Cache system configuration."""
    cache_dir: Path = Path(".aider.tags.cache.v4")
    max_size_mb: int = 200
    l1_max_items: int = 1000
    ttl_hours: int = 24
    refresh_mode: str = "auto"  # auto|manual|always|files
    enable_warming: bool = True
    enable_metrics: bool = True
    sqlite_wal_mode: bool = True
    memory_pressure_threshold_mb: int = 100
    
    @classmethod
    def from_env(cls) -> 'CacheConfig':
        """Load configuration from environment variables."""
        return cls(
            cache_dir=Path(os.getenv('REPO_MAP_CACHE_DIR', str(cls.cache_dir))),
            max_size_mb=int(os.getenv('REPO_MAP_CACHE_SIZE_MB', cls.max_size_mb)),
            l1_max_items=int(os.getenv('REPO_MAP_CACHE_L1_SIZE', cls.l1_max_items)),
            ttl_hours=int(os.getenv('REPO_MAP_CACHE_TTL_HOURS', cls.ttl_hours)),
            refresh_mode=os.getenv('REPO_MAP_CACHE_REFRESH_MODE', cls.refresh_mode),
            enable_warming=os.getenv('REPO_MAP_CACHE_WARMING', 'true').lower() == 'true',
            enable_metrics=os.getenv('REPO_MAP_CACHE_METRICS', 'true').lower() == 'true'
        )


# ============================================================================
# LRU Cache Implementation
# ============================================================================

class LRUCache:
    """Thread-safe LRU cache implementation."""
    
    def __init__(self, maxsize: int = 500):
        self.maxsize = maxsize
        self.data = OrderedDict()
        self.lock = threading.RLock()
        
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache, updating LRU order."""
        with self.lock:
            if key in self.data:
                # Move to end (most recently used)
                value = self.data.pop(key)
                self.data[key] = value
                return value
            return None
    
    def set(self, key: str, value: Any) -> None:
        """Set item in cache with LRU eviction."""
        with self.lock:
            if key in self.data:
                # Update existing item
                self.data.pop(key)
            elif len(self.data) >= self.maxsize:
                # Evict least recently used
                self.data.popitem(last=False)
            
            self.data[key] = value
    
    def delete(self, key: str) -> bool:
        """Delete item from cache."""
        with self.lock:
            return self.data.pop(key, None) is not None
    
    def clear(self) -> None:
        """Clear all items from cache."""
        with self.lock:
            self.data.clear()
    
    def __contains__(self, key: str) -> bool:
        """Check if key exists in cache."""
        with self.lock:
            return key in self.data
    
    def __len__(self) -> int:
        """Get cache size."""
        with self.lock:
            return len(self.data)


# ============================================================================
# Cache Implementations
# ============================================================================

class TagCache:
    """Cache for AST tags with L1 memory + L2 disk storage."""
    
    def __init__(self, cache_dir: Path, max_l1_items: int = 500):
        self.cache_dir = cache_dir / "tags"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # L1 Memory cache
        self.l1_cache = LRUCache(maxsize=max_l1_items)
        
        # L2 Disk cache
        self.l2_cache = self._init_disk_cache()
        
        # Statistics
        self.stats = CacheStats()
        self.lock = threading.RLock()
        
    def _init_disk_cache(self):
        """Initialize disk cache with error handling."""
        if diskcache is None:
            logger.warning("diskcache not available, using memory-only cache")
            return {}
        
        try:
            cache = diskcache.Cache(
                str(self.cache_dir),
                size_limit=100 * 1024 * 1024,  # 100MB
                eviction_policy='least-recently-used'
            )
            return cache
        except Exception as e:
            logger.error(f"Failed to initialize disk cache: {e}")
            return {}
    
    def get(self, filepath: str) -> Optional[List[Tag]]:
        """Get tags with cache hierarchy traversal."""
        cache_key = self._get_cache_key(filepath)
        
        # Try L1 cache first
        with self.lock:
            entry = self.l1_cache.get(cache_key)
            if entry and self._is_entry_valid(entry, filepath):
                self.stats.hits += 1
                return entry.tags
        
        # Try L2 cache
        if hasattr(self.l2_cache, 'get'):
            try:
                entry = self.l2_cache.get(cache_key)
                if entry and self._is_entry_valid(entry, filepath):
                    # Promote to L1
                    self.l1_cache.set(cache_key, entry)
                    self.stats.hits += 1
                    return entry.tags
            except Exception as e:
                logger.debug(f"L2 cache error: {e}")
        
        # Cache miss
        self.stats.misses += 1
        return None
    
    def set(self, filepath: str, tags: List[Tag], language: str = "unknown", 
            parse_time: float = 0.0) -> None:
        """Set tags in both cache levels."""
        try:
            cache_key = self._get_cache_key(filepath)
            mtime = os.path.getmtime(filepath) if os.path.exists(filepath) else time.time()
            content_hash = self._get_content_hash(filepath)
            
            entry = TagCacheEntry(
                filepath=filepath,
                mtime=mtime,
                content_hash=content_hash,
                tags=tags,
                language=language,
                parse_time=parse_time,
                cache_version=CACHE_VERSION
            )
            
            # Set in L1 cache
            with self.lock:
                self.l1_cache.set(cache_key, entry)
            
            # Set in L2 cache
            if hasattr(self.l2_cache, '__setitem__'):
                try:
                    self.l2_cache[cache_key] = entry
                except Exception as e:
                    logger.debug(f"L2 cache write error: {e}")
                    
        except Exception as e:
            logger.error(f"Cache set error for {filepath}: {e}")
    
    def invalidate(self, filepath: str) -> None:
        """Invalidate entry in all cache levels."""
        cache_key = self._get_cache_key(filepath)
        
        with self.lock:
            self.l1_cache.delete(cache_key)
        
        if hasattr(self.l2_cache, '__delitem__'):
            try:
                del self.l2_cache[cache_key]
            except (KeyError, Exception):
                pass
    
    def clear(self) -> None:
        """Clear all cache levels."""
        with self.lock:
            self.l1_cache.clear()
        
        if hasattr(self.l2_cache, 'clear'):
            try:
                self.l2_cache.clear()
            except Exception as e:
                logger.debug(f"L2 cache clear error: {e}")
    
    def _get_cache_key(self, filepath: str) -> str:
        """Generate cache key for file."""
        return f"tags:{filepath}"
    
    def _get_content_hash(self, filepath: str) -> str:
        """Generate content hash for file."""
        try:
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    content = f.read()
                return hashlib.sha256(content).hexdigest()[:16]
        except Exception:
            pass
        return ""
    
    def _is_entry_valid(self, entry: TagCacheEntry, filepath: str) -> bool:
        """Check if cache entry is still valid."""
        if not entry or not entry.is_valid():
            return False
        
        try:
            current_mtime = os.path.getmtime(filepath)
            return current_mtime <= entry.mtime
        except OSError:
            return False


class MapCache:
    """Cache for repository maps with LFU eviction."""
    
    def __init__(self, cache_dir: Path, max_l1_items: int = 100):
        self.cache_dir = cache_dir / "maps"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # L1 Memory cache
        self.l1_cache = LRUCache(maxsize=max_l1_items)
        
        # L2 Disk cache
        self.l2_cache = self._init_disk_cache()
        
        # Statistics
        self.stats = CacheStats()
        self.lock = threading.RLock()
        
    def _init_disk_cache(self):
        """Initialize disk cache with SQLite backend."""
        if diskcache is None:
            logger.warning("diskcache not available, using memory-only cache")
            return {}
        
        try:
            cache = diskcache.Cache(
                str(self.cache_dir),
                size_limit=50 * 1024 * 1024,  # 50MB
                eviction_policy='least-frequently-used'
            )
            return cache
        except Exception as e:
            logger.error(f"Failed to initialize map cache: {e}")
            return {}
    
    def get(self, key: MapCacheKey) -> Optional[str]:
        """Get repository map from cache."""
        cache_key = key.to_hash()
        
        # Try L1 cache
        with self.lock:
            entry = self.l1_cache.get(cache_key)
            if entry:
                entry.update_access()
                self.stats.hits += 1
                return entry.content
        
        # Try L2 cache
        if hasattr(self.l2_cache, 'get'):
            try:
                entry = self.l2_cache.get(cache_key)
                if entry:
                    entry.update_access()
                    # Promote to L1
                    self.l1_cache.set(cache_key, entry)
                    self.stats.hits += 1
                    return entry.content
            except Exception as e:
                logger.debug(f"L2 map cache error: {e}")
        
        # Cache miss
        self.stats.misses += 1
        return None
    
    def set(self, key: MapCacheKey, content: str, token_count: int = 0,
            generation_time: float = 0.0) -> None:
        """Set repository map in cache."""
        try:
            cache_key = key.to_hash()
            
            entry = MapCacheEntry(
                key=key,
                content=content,
                token_count=token_count,
                generation_time=generation_time,
                access_count=1,
                last_access=time.time(),
                cache_version=CACHE_VERSION
            )
            
            # Set in L1 cache
            with self.lock:
                self.l1_cache.set(cache_key, entry)
            
            # Set in L2 cache
            if hasattr(self.l2_cache, '__setitem__'):
                try:
                    self.l2_cache[cache_key] = entry
                except Exception as e:
                    logger.debug(f"L2 map cache write error: {e}")
                    
        except Exception as e:
            logger.error(f"Map cache set error: {e}")
    
    def invalidate_by_file(self, filepath: str) -> None:
        """Invalidate entries that depend on a file."""
        # For now, clear all cache as we don't track dependencies
        # TODO: Implement proper dependency tracking
        self.clear()
    
    def clear(self) -> None:
        """Clear all cache levels."""
        with self.lock:
            self.l1_cache.clear()
        
        if hasattr(self.l2_cache, 'clear'):
            try:
                self.l2_cache.clear()
            except Exception as e:
                logger.debug(f"L2 map cache clear error: {e}")


class TreeCache:
    """Cache for tree representations with memory fallback."""
    
    def __init__(self, cache_dir: Path, max_l1_items: int = 200):
        self.cache_dir = cache_dir / "trees"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # L1 Memory cache  
        self.l1_cache = LRUCache(maxsize=max_l1_items)
        
        # L2 Disk cache with fallback
        self.l2_cache = self._init_disk_cache()
        self.memory_fallback = {}
        
        # Statistics
        self.stats = CacheStats()
        self.lock = threading.RLock()
        
    def _init_disk_cache(self):
        """Initialize disk cache with memory fallback."""
        if diskcache is None:
            logger.warning("diskcache not available, using memory fallback")
            return self.memory_fallback
        
        try:
            cache = diskcache.Cache(
                str(self.cache_dir),
                size_limit=20 * 1024 * 1024,  # 20MB
                eviction_policy='least-recently-used'
            )
            return cache
        except Exception as e:
            logger.warning(f"Disk cache failed, using memory fallback: {e}")
            return self.memory_fallback
    
    def get(self, filepath: str, lines_of_interest: Set[int]) -> Optional[str]:
        """Get tree representation from cache."""
        lines_frozen = frozenset(lines_of_interest)
        temp_entry = TreeCacheEntry(
            filepath=filepath,
            lines_of_interest=lines_frozen,
            mtime=0,
            rendered_tree="",
            render_time=0
        )
        cache_key = temp_entry.get_key()
        
        # Try L1 cache
        with self.lock:
            entry = self.l1_cache.get(cache_key)
            if entry and self._is_entry_valid(entry, filepath):
                self.stats.hits += 1
                return entry.rendered_tree
        
        # Try L2 cache
        try:
            entry = self.l2_cache.get(cache_key)
            if entry and self._is_entry_valid(entry, filepath):
                # Promote to L1
                self.l1_cache.set(cache_key, entry)
                self.stats.hits += 1
                return entry.rendered_tree
        except Exception as e:
            logger.debug(f"L2 tree cache error: {e}")
        
        # Cache miss
        self.stats.misses += 1
        return None
    
    def set(self, filepath: str, lines_of_interest: Set[int], 
            rendered_tree: str, render_time: float = 0.0) -> None:
        """Set tree representation in cache."""
        try:
            lines_frozen = frozenset(lines_of_interest)
            mtime = os.path.getmtime(filepath) if os.path.exists(filepath) else time.time()
            
            entry = TreeCacheEntry(
                filepath=filepath,
                lines_of_interest=lines_frozen,
                mtime=mtime,
                rendered_tree=rendered_tree,
                render_time=render_time,
                cache_version=CACHE_VERSION
            )
            
            cache_key = entry.get_key()
            
            # Set in L1 cache
            with self.lock:
                self.l1_cache.set(cache_key, entry)
            
            # Set in L2 cache
            try:
                self.l2_cache[cache_key] = entry
            except Exception as e:
                logger.debug(f"L2 tree cache write error: {e}")
                
        except Exception as e:
            logger.error(f"Tree cache set error: {e}")
    
    def invalidate(self, filepath: str) -> None:
        """Invalidate entries for a file."""
        # Clear entries that match the filepath
        # For simplicity, clear all cache - TODO: implement selective invalidation
        self.clear()
    
    def clear(self) -> None:
        """Clear all cache levels."""
        with self.lock:
            self.l1_cache.clear()
        
        try:
            if hasattr(self.l2_cache, 'clear'):
                self.l2_cache.clear()
            else:
                self.l2_cache.clear()
        except Exception as e:
            logger.debug(f"L2 tree cache clear error: {e}")
    
    def _is_entry_valid(self, entry: TreeCacheEntry, filepath: str) -> bool:
        """Check if cache entry is still valid."""
        if not entry or entry.cache_version != CACHE_VERSION:
            return False
        
        try:
            current_mtime = os.path.getmtime(filepath)
            return current_mtime <= entry.mtime
        except OSError:
            return False


# ============================================================================
# Main Cache Manager
# ============================================================================

class CacheManager:
    """Main interface for all caching operations."""
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        
        # Ensure cache directory exists
        self.config.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize cache components
        self.tag_cache = TagCache(self.config.cache_dir, self.config.l1_max_items)
        self.map_cache = MapCache(self.config.cache_dir, self.config.l1_max_items // 10)
        self.tree_cache = TreeCache(self.config.cache_dir, self.config.l1_max_items // 5)
        
        # Initialize monitoring
        self.monitor = CacheMonitor() if self.config.enable_metrics else None
        
        # File modification tracking
        self.file_mtimes: Dict[str, float] = {}
        self.lock = threading.RLock()
        
        # Initialize SQLite optimizations
        self._optimize_sqlite()
        
        logger.info(f"CacheManager initialized with config: {self.config}")
    
    def _optimize_sqlite(self) -> None:
        """Apply SQLite optimizations for performance."""
        if not self.config.sqlite_wal_mode:
            return
        
        try:
            # Apply optimizations to disk caches that use SQLite
            db_files = list(self.config.cache_dir.glob("**/cache.db"))
            for db_file in db_files:
                try:
                    conn = sqlite3.connect(str(db_file))
                    conn.execute("PRAGMA journal_mode=WAL")
                    conn.execute("PRAGMA synchronous=NORMAL")
                    conn.execute("PRAGMA cache_size=10000")
                    conn.execute("PRAGMA temp_store=MEMORY")
                    conn.close()
                except Exception as e:
                    logger.debug(f"SQLite optimization failed for {db_file}: {e}")
        except Exception as e:
            logger.debug(f"SQLite optimization error: {e}")
    
    # Tag Cache Interface
    def get_tags(self, filepath: str) -> Optional[List[Tag]]:
        """Get tags with full cache hierarchy and validation."""
        # Check file modification
        if self._is_file_modified(filepath):
            self.invalidate_file(filepath)
            return None
        
        # Try cache hierarchy
        tags = self.tag_cache.get(filepath)
        
        if self.monitor:
            if tags:
                self.monitor.record_hit('tags')
            else:
                self.monitor.record_miss('tags')
        
        return tags
    
    def set_tags(self, filepath: str, tags: List[Tag], language: str = "unknown",
                 parse_time: float = 0.0) -> None:
        """Set tags in cache hierarchy."""
        self.tag_cache.set(filepath, tags, language, parse_time)
        self._update_file_mtime(filepath)
    
    # Map Cache Interface
    def get_map(self, key: MapCacheKey) -> Optional[str]:
        """Get repository map from cache."""
        content = self.map_cache.get(key)
        
        if self.monitor:
            if content:
                self.monitor.record_hit('maps')
            else:
                self.monitor.record_miss('maps')
        
        return content
    
    def set_map(self, key: MapCacheKey, content: str, token_count: int = 0,
                generation_time: float = 0.0) -> None:
        """Set repository map in cache."""
        self.map_cache.set(key, content, token_count, generation_time)
    
    # Tree Cache Interface  
    def get_tree(self, filepath: str, lines_of_interest: Set[int]) -> Optional[str]:
        """Get tree representation from cache."""
        # Check file modification
        if self._is_file_modified(filepath):
            self.invalidate_file(filepath)
            return None
        
        tree = self.tree_cache.get(filepath, lines_of_interest)
        
        if self.monitor:
            if tree:
                self.monitor.record_hit('trees')
            else:
                self.monitor.record_miss('trees')
        
        return tree
    
    def set_tree(self, filepath: str, lines_of_interest: Set[int],
                 rendered_tree: str, render_time: float = 0.0) -> None:
        """Set tree representation in cache."""
        self.tree_cache.set(filepath, lines_of_interest, rendered_tree, render_time)
        self._update_file_mtime(filepath)
    
    # Invalidation Interface
    def invalidate_file(self, filepath: str) -> None:
        """Invalidate all caches for a file."""
        self.tag_cache.invalidate(filepath)
        self.map_cache.invalidate_by_file(filepath)
        self.tree_cache.invalidate(filepath)
        
        with self.lock:
            self.file_mtimes.pop(filepath, None)
    
    def clear_all(self) -> None:
        """Clear all caches."""
        self.tag_cache.clear()
        self.map_cache.clear()
        self.tree_cache.clear()
        
        with self.lock:
            self.file_mtimes.clear()
    
    # Statistics Interface
    def get_statistics(self) -> Dict[str, Dict]:
        """Get cache performance statistics."""
        if not self.monitor:
            return {}
        
        return self.monitor.get_report()
    
    # File Modification Tracking
    def _is_file_modified(self, filepath: str) -> bool:
        """Check if file has been modified since last cache."""
        try:
            current_mtime = os.path.getmtime(filepath)
            with self.lock:
                cached_mtime = self.file_mtimes.get(filepath, 0)
            return current_mtime > cached_mtime
        except OSError:
            return True
    
    def _update_file_mtime(self, filepath: str) -> None:
        """Update tracked file modification time."""
        try:
            mtime = os.path.getmtime(filepath)
            with self.lock:
                self.file_mtimes[filepath] = mtime
        except OSError:
            pass


# ============================================================================
# Cache Monitoring
# ============================================================================

class CacheMonitor:
    """Cache performance monitoring and statistics."""
    
    def __init__(self):
        self.stats = defaultdict(CacheStats)
        self.lock = threading.RLock()
    
    def record_hit(self, cache_type: str) -> None:
        """Record cache hit."""
        with self.lock:
            self.stats[cache_type].hits += 1
    
    def record_miss(self, cache_type: str) -> None:
        """Record cache miss."""
        with self.lock:
            self.stats[cache_type].misses += 1
    
    def record_eviction(self, cache_type: str) -> None:
        """Record cache eviction."""
        with self.lock:
            self.stats[cache_type].evictions += 1
    
    def record_corruption(self, cache_type: str) -> None:
        """Record cache corruption."""
        with self.lock:
            self.stats[cache_type].corruptions += 1
    
    def get_report(self) -> Dict[str, Dict]:
        """Get comprehensive cache statistics report."""
        with self.lock:
            return {
                cache_type: {
                    'hit_rate': stats.hit_rate,
                    'total_requests': stats.hits + stats.misses,
                    'hits': stats.hits,
                    'misses': stats.misses,
                    'evictions': stats.evictions,
                    'corruptions': stats.corruptions,
                    'size_mb': stats.size_mb
                }
                for cache_type, stats in self.stats.items()
            }


# ============================================================================
# Memory Management
# ============================================================================

class MemoryMonitor:
    """Monitor and manage cache memory usage."""
    
    def __init__(self, threshold_mb: int = 100):
        self.threshold = threshold_mb * 1024 * 1024
    
    def check_memory_pressure(self) -> bool:
        """Check if memory usage is too high."""
        if psutil is None:
            return False
        
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            return memory_info.rss > self.threshold
        except Exception:
            return False
    
    def reduce_memory_usage(self, cache_manager: CacheManager) -> None:
        """Reduce memory usage when pressure detected."""
        if self.check_memory_pressure():
            logger.info("Memory pressure detected, reducing cache sizes")
            
            # Clear L1 caches to free memory
            cache_manager.tag_cache.l1_cache.clear()
            cache_manager.map_cache.l1_cache.clear()
            cache_manager.tree_cache.l1_cache.clear()
            
            # Force garbage collection
            gc.collect()


# ============================================================================
# Public API
# ============================================================================

def create_cache_manager(config: Optional[CacheConfig] = None) -> CacheManager:
    """Create and configure a cache manager instance."""
    if config is None:
        config = CacheConfig.from_env()
    
    return CacheManager(config)


# ============================================================================
# Module Initialization
# ============================================================================

# Global cache manager instance (lazy initialization)
_global_cache_manager: Optional[CacheManager] = None
_cache_lock = threading.Lock()


def get_cache_manager() -> CacheManager:
    """Get global cache manager instance (singleton pattern)."""
    global _global_cache_manager
    
    if _global_cache_manager is None:
        with _cache_lock:
            if _global_cache_manager is None:
                _global_cache_manager = create_cache_manager()
    
    return _global_cache_manager


def reset_cache_manager() -> None:
    """Reset global cache manager (for testing)."""
    global _global_cache_manager
    
    with _cache_lock:
        if _global_cache_manager:
            _global_cache_manager.clear_all()
        _global_cache_manager = None


if __name__ == "__main__":
    # Demo usage
    cache_manager = create_cache_manager()
    
    # Example tag caching
    sample_tags = [
        Tag("main", "function", 1, 0),
        Tag("MyClass", "class", 10, 0)
    ]
    
    cache_manager.set_tags("/example/file.py", sample_tags, "python")
    retrieved_tags = cache_manager.get_tags("/example/file.py")
    
    print(f"Cache demo: stored {len(sample_tags)} tags")
    if retrieved_tags:
        print(f"Retrieved {len(retrieved_tags)} tags from cache")
    else:
        print("Cache miss - tags not found")
    
    # Test map caching
    map_key = MapCacheKey(
        chat_files=frozenset(["/test.py"]),
        other_files=frozenset(["/utils.py"]),
        max_tokens=1024,
        mentioned_fnames=frozenset(),
        mentioned_idents=frozenset()
    )
    
    cache_manager.set_map(map_key, "Repository map content...", 512, 0.5)
    retrieved_map = cache_manager.get_map(map_key)
    
    if retrieved_map:
        print(f"Retrieved map: {len(retrieved_map)} characters")
    
    # Show statistics
    stats = cache_manager.get_statistics()
    if stats:
        print("Cache statistics:", json.dumps(stats, indent=2))