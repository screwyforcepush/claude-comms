# Repository Map Implementation Guide

## Implementation Overview

This guide provides concrete implementation details for the tree-sitter based repository map system, building on the architecture defined in `repo-map-architecture.md`.

## Module Structure

```
.claude/hooks/
├── context/
│   ├── repo_map.py          # Hook entry point (existing, to be replaced)
│   ├── repo_map_core.py     # Core mapping logic
│   ├── repo_map_cache.py    # Caching system
│   ├── repo_map_hook.py     # Hook integration
│   ├── language_support.py  # Language configurations
│   ├── token_optimizer.py   # Token optimization
│   └── queries/             # Tree-sitter query files
│       ├── python-tags.scm
│       ├── javascript-tags.scm
│       └── ...
```

## Implementation Phases

### Phase 1: Core Foundation (Priority 1)

#### 1.1 Basic Tag Extraction
```python
# repo_map_core.py - Minimal implementation
from tree_sitter import Language, Parser
import tree_sitter_python as tspython

class TagExtractor:
    def __init__(self):
        self.parsers = {
            'python': Parser(Language(tspython.language()))
        }
    
    def extract_tags(self, filepath: str) -> List[Tag]:
        """Extract definitions and references from file."""
        # Parse file with tree-sitter
        # Extract function/class definitions
        # Extract references
        # Return Tag objects
```

#### 1.2 Simple Ranking
```python
# repo_map_core.py - Basic PageRank
import networkx as nx

class RankCalculator:
    def calculate_ranks(self, tags: List[Tag], chat_files: Set[str]) -> Dict[str, float]:
        """Calculate importance ranks using PageRank."""
        G = nx.DiGraph()
        # Build graph from tags
        # Apply PageRank
        # Return ranked results
```

#### 1.3 Hook Integration
```python
# repo_map.py - Replace existing hook
#!/usr/bin/env python3
import json
import sys
from repo_map_hook import inject_repo_map

def main():
    try:
        input_data = json.load(sys.stdin)
        prompt = input_data.get('prompt', '')
        session_id = input_data.get('session_id', 'unknown')
        
        # Generate repo map
        repo_map = inject_repo_map(prompt, session_id)
        
        output = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": f"Current repository structure:\n{repo_map}"
            }
        }
        print(json.dumps(output))
        sys.exit(0)
    except Exception as e:
        print(f"Error in repo_map hook: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### Phase 2: Optimization & Caching

#### 2.1 Token Optimization
```python
# token_optimizer.py
class TokenOptimizer:
    def __init__(self, token_counter):
        self.token_counter = token_counter
    
    def optimize_map_size(self, ranked_tags, max_tokens):
        """Binary search for optimal tag count."""
        low, high = 0, len(ranked_tags)
        best_map = None
        best_tokens = 0
        
        while low <= high:
            mid = (low + high) // 2
            tree = self.format_tree(ranked_tags[:mid])
            tokens = self.token_counter(tree)
            
            if tokens <= max_tokens:
                if tokens > best_tokens:
                    best_map = tree
                    best_tokens = tokens
                low = mid + 1
            else:
                high = mid - 1
        
        return best_map
```

#### 2.2 Caching System
```python
# repo_map_cache.py
from diskcache import Cache
from pathlib import Path
import os

class RepoMapCache:
    def __init__(self, cache_dir=".aider.tags.cache.v4"):
        self.cache_dir = Path(cache_dir)
        self.tags_cache = Cache(self.cache_dir / "tags")
        self.map_cache = Cache(self.cache_dir / "maps")
    
    def get_cached_tags(self, filepath):
        """Get cached tags if file unchanged."""
        mtime = os.path.getmtime(filepath)
        cache_key = f"{filepath}:{mtime}"
        return self.tags_cache.get(cache_key)
    
    def cache_tags(self, filepath, tags):
        """Cache extracted tags."""
        mtime = os.path.getmtime(filepath)
        cache_key = f"{filepath}:{mtime}"
        self.tags_cache[cache_key] = tags
```

### Phase 3: Advanced Features

#### 3.1 Multi-language Support
```python
# language_support.py
from tree_sitter_languages import get_language, get_parser

LANGUAGE_MAP = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'jsx',
    '.tsx': 'tsx',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp',
    '.c': 'c',
    '.rb': 'ruby',
    # ... more languages
}

def get_language_for_file(filepath):
    """Detect language from file extension."""
    ext = Path(filepath).suffix
    return LANGUAGE_MAP.get(ext)
```

#### 3.2 Query Schemas
```scheme
; queries/python-tags.scm
; Function definitions
(function_definition
  name: (identifier) @name.definition.function)

; Class definitions  
(class_definition
  name: (identifier) @name.definition.class)

; Method definitions
(class_definition
  body: (block
    (function_definition
      name: (identifier) @name.definition.method)))

; Function/method calls
(call
  function: (identifier) @name.reference.call)
  
; Attribute access
(attribute
  attribute: (identifier) @name.reference.attribute)
```

## Integration Points

### 1. Hook System Integration

The repo map integrates at the `UserPromptSubmit` hook point:

```python
# Hook registration in .claude/settings.json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/context/repo_map.py"
  }
}
```

### 2. Session Context Extraction

Extract context from the current Claude session:

```python
def get_chat_context(session_id):
    """Extract files currently in chat."""
    # Parse session history
    # Extract mentioned files
    # Extract mentioned identifiers
    # Return context dict
```

### 3. File System Integration

```python
def get_project_files(root_dir='.'):
    """Get all relevant project files."""
    import pathspec
    
    # Read .gitignore
    with open('.gitignore') as f:
        gitignore = pathspec.PathSpec.from_lines('gitwildmatch', f)
    
    files = []
    for root, dirs, filenames in os.walk(root_dir):
        # Filter using gitignore
        for fname in filenames:
            filepath = os.path.join(root, fname)
            if not gitignore.match_file(filepath):
                files.append(filepath)
    
    return files
```

## Dependencies Installation

```toml
# pyproject.toml additions
[project]
dependencies = [
    "tree-sitter>=0.20.0",
    "tree-sitter-languages>=1.10.0",  
    "networkx>=3.0",
    "diskcache>=5.6.0",
    "pathspec>=0.12.0",
    "pygments>=2.17.0",
]
```

```bash
# Installation command
uv pip install tree-sitter tree-sitter-languages networkx diskcache pathspec pygments
```

## Configuration Management

```python
# config.py
import os
from pathlib import Path

class RepoMapConfig:
    def __init__(self):
        self.max_tokens = int(os.getenv('REPO_MAP_MAX_TOKENS', '1024'))
        self.cache_dir = os.getenv('REPO_MAP_CACHE_DIR', '.aider.tags.cache.v4')
        self.refresh_mode = os.getenv('REPO_MAP_REFRESH_MODE', 'auto')
        self.verbose = os.getenv('REPO_MAP_VERBOSE', 'false').lower() == 'true'
        
        # Load config file if exists
        config_path = Path('.claude/repo_map.json')
        if config_path.exists():
            self.load_from_file(config_path)
```

## Error Handling Patterns

```python
# Error handling wrapper
def safe_parse_file(filepath):
    """Safely parse file with fallback."""
    try:
        return parse_with_treesitter(filepath)
    except Exception as e:
        # Fallback to regex-based extraction
        try:
            return parse_with_regex(filepath)
        except:
            # Log and skip
            log_warning(f"Failed to parse {filepath}: {e}")
            return []
```

## Testing Implementation

### Unit Tests Structure
```
tests/
├── test_tag_extraction.py
├── test_ranking.py
├── test_cache.py
├── test_token_optimizer.py
├── test_hook_integration.py
└── fixtures/
    ├── sample_python.py
    ├── sample_javascript.js
    └── ...
```

### Sample Test
```python
# tests/test_tag_extraction.py
import pytest
from repo_map_core import TagExtractor

def test_extract_python_functions():
    extractor = TagExtractor()
    code = '''
def hello_world():
    print("Hello")
    
class MyClass:
    def method(self):
        pass
    '''
    
    tags = extractor.extract_from_string(code, 'python')
    
    assert len(tags) == 3
    assert any(t.name == 'hello_world' and t.kind == 'def' for t in tags)
    assert any(t.name == 'MyClass' and t.kind == 'def' for t in tags)
    assert any(t.name == 'method' and t.kind == 'def' for t in tags)
```

## Performance Benchmarks

### Target Metrics
- Initial scan: < 3s for 1000 files
- Cached retrieval: < 50ms
- Incremental update: < 200ms
- Memory usage: < 50MB for typical repos

### Benchmark Code
```python
# benchmarks/performance.py
import time
import tracemalloc

def benchmark_initial_scan(repo_path):
    tracemalloc.start()
    start = time.time()
    
    mapper = RepoMapGenerator()
    result = mapper.generate_map([], get_all_files(repo_path))
    
    end = time.time()
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    print(f"Time: {end - start:.2f}s")
    print(f"Memory: {peak / 1024 / 1024:.1f}MB")
```

## Deployment Checklist

### Pre-deployment
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Memory profiling completed
- [ ] Error handling tested

### Deployment Steps
1. Install dependencies: `uv pip install -r requirements.txt`
2. Run tests: `pytest tests/`
3. Replace existing hook: `cp repo_map.py .claude/hooks/context/`
4. Clear cache if needed: `rm -rf .aider.tags.cache.*`
5. Test with sample prompt

### Post-deployment
- [ ] Monitor performance metrics
- [ ] Check error logs
- [ ] Validate cache behavior
- [ ] User acceptance testing

## Troubleshooting Guide

### Common Issues

1. **Parser not found for language**
   - Solution: Install language-specific tree-sitter package
   - Fallback: Use pygments-based extraction

2. **Cache corruption**
   - Solution: Delete cache directory and restart
   - Prevention: Implement cache validation

3. **Token limit exceeded**
   - Solution: Reduce max_tokens configuration
   - Adjust: Token counting algorithm

4. **Slow initial scan**
   - Solution: Implement progress indicator
   - Optimize: Add parallel processing

## Future Optimizations

1. **Parallel Processing**
   - Use multiprocessing for file parsing
   - Concurrent cache operations

2. **Incremental Updates**
   - File watcher integration
   - Delta computation for graph updates

3. **Smart Caching**
   - Predictive cache warming
   - LRU eviction policy

4. **Advanced Ranking**
   - Machine learning for importance
   - User behavior tracking