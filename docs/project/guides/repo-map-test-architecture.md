# Repository Map Test Architecture

## Test Strategy Overview

This document defines the comprehensive testing strategy for the tree-sitter based repository map implementation, ensuring quality, reliability, and performance.

## Testing Philosophy

1. **Test Pyramid Approach**
   - 70% Unit Tests: Fast, isolated component testing
   - 20% Integration Tests: Module interaction verification
   - 10% End-to-End Tests: Complete system validation

2. **Test-Driven Development (TDD)**
   - Write tests before implementation
   - Red-Green-Refactor cycle
   - Maintain high code coverage (>90%)

## Test Structure

```
tests/
├── unit/
│   ├── test_tag_extraction.py
│   ├── test_ranking_algorithm.py
│   ├── test_token_optimizer.py
│   ├── test_cache_operations.py
│   └── test_language_support.py
├── integration/
│   ├── test_hook_integration.py
│   ├── test_cache_persistence.py
│   └── test_multi_language.py
├── e2e/
│   ├── test_complete_flow.py
│   └── test_user_scenarios.py
├── performance/
│   ├── test_large_repos.py
│   ├── test_memory_usage.py
│   └── test_cache_performance.py
├── fixtures/
│   ├── sample_repos/
│   ├── test_files/
│   └── mock_data/
└── conftest.py
```

## Unit Test Specifications

### 1. Tag Extraction Tests

```python
# tests/unit/test_tag_extraction.py
import pytest
from repo_map_core import TagExtractor, Tag

class TestTagExtraction:
    @pytest.fixture
    def extractor(self):
        return TagExtractor()
    
    def test_extract_python_functions(self, extractor):
        """Test extraction of Python function definitions."""
        code = '''
def simple_function():
    pass

async def async_function():
    await something()
        '''
        tags = extractor.extract_from_string(code, 'python')
        assert len([t for t in tags if t.kind == 'def']) == 2
        assert 'simple_function' in [t.name for t in tags]
        assert 'async_function' in [t.name for t in tags]
    
    def test_extract_python_classes(self, extractor):
        """Test extraction of Python class definitions."""
        code = '''
class BaseClass:
    def method(self):
        pass

class DerivedClass(BaseClass):
    pass
        '''
        tags = extractor.extract_from_string(code, 'python')
        class_tags = [t for t in tags if t.kind == 'def' and 'Class' in t.name]
        assert len(class_tags) == 2
    
    def test_extract_references(self, extractor):
        """Test extraction of function/class references."""
        code = '''
result = calculate_sum(1, 2)
obj = MyClass()
obj.method()
        '''
        tags = extractor.extract_from_string(code, 'python')
        ref_tags = [t for t in tags if t.kind == 'ref']
        assert 'calculate_sum' in [t.name for t in ref_tags]
        assert 'MyClass' in [t.name for t in ref_tags]
    
    @pytest.mark.parametrize("language,code,expected_tags", [
        ('javascript', 'function test() {}', ['test']),
        ('typescript', 'class Foo { bar() {} }', ['Foo', 'bar']),
        ('python', 'def hello(): pass', ['hello']),
    ])
    def test_multi_language_extraction(self, extractor, language, code, expected_tags):
        """Test extraction across multiple languages."""
        tags = extractor.extract_from_string(code, language)
        tag_names = [t.name for t in tags]
        for expected in expected_tags:
            assert expected in tag_names
    
    def test_unicode_handling(self, extractor):
        """Test handling of unicode in identifiers."""
        code = 'def 你好(): pass\ndef café(): pass'
        tags = extractor.extract_from_string(code, 'python')
        assert len(tags) > 0  # Should not crash
    
    def test_syntax_error_handling(self, extractor):
        """Test graceful handling of syntax errors."""
        code = 'def broken('  # Invalid syntax
        tags = extractor.extract_from_string(code, 'python')
        assert tags == []  # Should return empty, not crash
```

### 2. Ranking Algorithm Tests

```python
# tests/unit/test_ranking_algorithm.py
import pytest
import networkx as nx
from repo_map_core import RankCalculator, Tag

class TestRankingAlgorithm:
    @pytest.fixture
    def calculator(self):
        return RankCalculator()
    
    def test_pagerank_basic(self, calculator):
        """Test basic PageRank calculation."""
        tags = [
            Tag('file1.py', 'file1.py', 'main', 'def', 1),
            Tag('file1.py', 'file1.py', 'helper', 'ref', 2),
            Tag('file2.py', 'file2.py', 'helper', 'def', 1),
        ]
        ranks = calculator.calculate_ranks(tags, set())
        assert ranks['file2.py'] > ranks['file1.py']  # helper is referenced
    
    def test_chat_file_boost(self, calculator):
        """Test that files in chat get ranking boost."""
        tags = [
            Tag('chat.py', 'chat.py', 'func', 'def', 1),
            Tag('other.py', 'other.py', 'func', 'def', 1),
        ]
        ranks = calculator.calculate_ranks(tags, {'chat.py'})
        assert ranks['chat.py'] > ranks['other.py']
    
    def test_mentioned_identifier_boost(self, calculator):
        """Test that mentioned identifiers get boost."""
        tags = [
            Tag('file.py', 'file.py', 'mentioned_func', 'def', 1),
            Tag('file.py', 'file.py', 'other_func', 'def', 2),
        ]
        ranks = calculator.calculate_ranks(
            tags, set(), mentioned_idents={'mentioned_func'}
        )
        # Check that mentioned function ranks higher
        assert 'mentioned_func' in calculator.boosted_idents
    
    def test_cyclic_dependencies(self, calculator):
        """Test handling of cyclic dependencies."""
        tags = [
            Tag('a.py', 'a.py', 'func_a', 'def', 1),
            Tag('a.py', 'a.py', 'func_b', 'ref', 2),
            Tag('b.py', 'b.py', 'func_b', 'def', 1),
            Tag('b.py', 'b.py', 'func_a', 'ref', 2),
        ]
        ranks = calculator.calculate_ranks(tags, set())
        assert len(ranks) > 0  # Should not crash on cycles
    
    def test_private_member_penalty(self, calculator):
        """Test that private members get lower rank."""
        tags = [
            Tag('file.py', 'file.py', '_private', 'def', 1),
            Tag('file.py', 'file.py', 'public', 'def', 2),
        ]
        ranks = calculator.calculate_ranks(tags, set())
        # Private should rank lower due to penalty
```

### 3. Token Optimization Tests

```python
# tests/unit/test_token_optimizer.py
import pytest
from repo_map_core import TokenOptimizer

class TestTokenOptimizer:
    @pytest.fixture
    def optimizer(self):
        def mock_counter(text):
            return len(text) // 4  # Simple mock
        return TokenOptimizer(mock_counter)
    
    def test_binary_search_convergence(self, optimizer):
        """Test that binary search finds optimal size."""
        ranked_tags = [f"tag_{i}" for i in range(100)]
        result = optimizer.optimize_map_size(ranked_tags, max_tokens=500)
        assert result is not None
        assert optimizer.token_counter(result) <= 500
    
    def test_empty_input(self, optimizer):
        """Test handling of empty input."""
        result = optimizer.optimize_map_size([], max_tokens=100)
        assert result == ""
    
    def test_all_tags_fit(self, optimizer):
        """Test when all tags fit within limit."""
        ranked_tags = ["tag1", "tag2", "tag3"]
        result = optimizer.optimize_map_size(ranked_tags, max_tokens=1000)
        assert all(tag in result for tag in ranked_tags)
    
    def test_no_tags_fit(self, optimizer):
        """Test when no tags fit within limit."""
        ranked_tags = ["x" * 1000]  # Very long tag
        result = optimizer.optimize_map_size(ranked_tags, max_tokens=10)
        assert result == ""
```

### 4. Cache Operation Tests

```python
# tests/unit/test_cache_operations.py
import pytest
import tempfile
import time
from pathlib import Path
from repo_map_cache import RepoMapCache

class TestCacheOperations:
    @pytest.fixture
    def cache(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield RepoMapCache(cache_dir=tmpdir)
    
    def test_cache_miss(self, cache):
        """Test cache miss returns None."""
        result = cache.get_cached_tags('nonexistent.py')
        assert result is None
    
    def test_cache_hit(self, cache, tmp_path):
        """Test cache hit returns stored value."""
        test_file = tmp_path / "test.py"
        test_file.write_text("content")
        
        tags = [{'name': 'test', 'kind': 'def'}]
        cache.cache_tags(str(test_file), tags)
        
        result = cache.get_cached_tags(str(test_file))
        assert result == tags
    
    def test_cache_invalidation_on_modification(self, cache, tmp_path):
        """Test cache invalidates when file modified."""
        test_file = tmp_path / "test.py"
        test_file.write_text("original")
        
        cache.cache_tags(str(test_file), ['original'])
        time.sleep(0.01)  # Ensure different mtime
        test_file.write_text("modified")
        
        result = cache.get_cached_tags(str(test_file))
        assert result is None  # Cache should be invalidated
    
    def test_concurrent_access(self, cache):
        """Test cache handles concurrent access."""
        import threading
        
        def write_cache(i):
            cache.cache_tags(f"file{i}.py", [f"tag{i}"])
        
        threads = [threading.Thread(target=write_cache, args=(i,)) 
                  for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Should not crash or corrupt
```

## Integration Test Specifications

### 1. Hook Integration Tests

```python
# tests/integration/test_hook_integration.py
import json
import subprocess
import pytest

class TestHookIntegration:
    def test_hook_basic_flow(self, tmp_path):
        """Test complete hook execution flow."""
        hook_input = {
            "prompt": "Test prompt",
            "session_id": "test123",
            "chat_files": []
        }
        
        result = subprocess.run(
            ["python", ".claude/hooks/context/repo_map.py"],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0
        output = json.loads(result.stdout)
        assert "hookSpecificOutput" in output
        assert "additionalContext" in output["hookSpecificOutput"]
    
    def test_hook_error_handling(self):
        """Test hook handles errors gracefully."""
        invalid_input = "not json"
        
        result = subprocess.run(
            ["python", ".claude/hooks/context/repo_map.py"],
            input=invalid_input,
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 1
        assert "Error" in result.stderr
```

### 2. Multi-Language Integration Tests

```python
# tests/integration/test_multi_language.py
import pytest
from repo_map_core import RepoMapGenerator

class TestMultiLanguageIntegration:
    @pytest.fixture
    def sample_repo(self, tmp_path):
        """Create a multi-language sample repo."""
        (tmp_path / "app.py").write_text("def main(): pass")
        (tmp_path / "utils.js").write_text("function helper() {}")
        (tmp_path / "styles.css").write_text(".class { color: red; }")
        return tmp_path
    
    def test_multi_language_processing(self, sample_repo):
        """Test processing files in multiple languages."""
        generator = RepoMapGenerator(root=sample_repo)
        files = list(sample_repo.glob("*"))
        
        result = generator.generate_map([], files)
        assert "app.py" in result
        assert "utils.js" in result
        # CSS might be skipped if no parser
```

## End-to-End Test Specifications

```python
# tests/e2e/test_complete_flow.py
class TestCompleteFlow:
    def test_real_repository(self):
        """Test on a real repository structure."""
        # Clone or use a test repository
        # Run complete flow
        # Verify output quality
        pass
    
    def test_user_scenario_new_project(self):
        """Test user exploring new project."""
        # Simulate user asking about project structure
        # Verify repo map provides useful context
        pass
```

## Performance Test Specifications

```python
# tests/performance/test_large_repos.py
import pytest
import time
from repo_map_core import RepoMapGenerator

class TestPerformance:
    @pytest.mark.slow
    def test_large_repository(self, large_repo_fixture):
        """Test performance on large repository."""
        generator = RepoMapGenerator()
        
        start = time.time()
        result = generator.generate_map([], large_repo_fixture)
        duration = time.time() - start
        
        assert duration < 5.0  # Should complete within 5 seconds
        assert len(result) > 0
    
    @pytest.mark.benchmark
    def test_memory_usage(self, benchmark, sample_repo):
        """Benchmark memory usage."""
        generator = RepoMapGenerator()
        
        def generate():
            return generator.generate_map([], sample_repo)
        
        result = benchmark(generate)
        assert benchmark.stats['mem_peak'] < 100 * 1024 * 1024  # < 100MB
```

## Mock Strategies

### 1. File System Mocks
```python
@pytest.fixture
def mock_filesystem(mocker):
    """Mock file system operations."""
    mock_files = {
        'file1.py': 'def func1(): pass',
        'file2.py': 'class MyClass: pass'
    }
    
    def mock_read(path):
        return mock_files.get(path, '')
    
    mocker.patch('builtins.open', mocker.mock_open(read_data=''))
    mocker.patch('os.path.getmtime', return_value=1234567890)
    return mock_files
```

### 2. External Service Mocks
```python
@pytest.fixture
def mock_token_counter(mocker):
    """Mock token counting service."""
    def counter(text):
        return len(text) // 4  # Simple approximation
    
    mocker.patch('repo_map_core.token_count', side_effect=counter)
    return counter
```

### 3. Cache Mocks
```python
@pytest.fixture
def mock_cache(mocker):
    """Mock cache for testing without persistence."""
    cache_data = {}
    
    mock = mocker.MagicMock()
    mock.get.side_effect = lambda k: cache_data.get(k)
    mock.__setitem__.side_effect = lambda k, v: cache_data.__setitem__(k, v)
    
    return mock
```

## Test Data Management

### Fixture Organization
```python
# tests/fixtures/conftest.py
import pytest
from pathlib import Path

@pytest.fixture
def sample_python_file():
    return '''
class Calculator:
    def add(self, a, b):
        return a + b
    
    def subtract(self, a, b):
        return a - b

def main():
    calc = Calculator()
    result = calc.add(1, 2)
    print(result)
'''

@pytest.fixture
def sample_javascript_file():
    return '''
class Component {
    constructor(props) {
        this.props = props;
    }
    
    render() {
        return '<div>Hello</div>';
    }
}

export default Component;
'''
```

## Coverage Requirements

### Minimum Coverage Targets
- Overall: 90%
- Core modules: 95%
- Critical paths: 100%
- Error handling: 85%

### Coverage Configuration
```ini
# .coveragerc
[run]
source = .claude/hooks/context/
omit = 
    */tests/*
    */test_*.py

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:

[html]
directory = htmlcov
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Repository Map

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, 3.10, 3.11]
    
    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        pip install uv
        uv pip install -r requirements.txt
        uv pip install pytest pytest-cov pytest-benchmark
    
    - name: Run tests
      run: |
        pytest tests/ -v --cov=.claude/hooks/context/ --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

## Test Execution Commands

```bash
# Run all tests
pytest tests/

# Run specific test category
pytest tests/unit/
pytest tests/integration/
pytest tests/e2e/

# Run with coverage
pytest --cov=.claude/hooks/context/ --cov-report=html

# Run performance tests
pytest tests/performance/ -m slow

# Run in parallel
pytest -n auto

# Run with verbose output
pytest -v

# Run specific test
pytest tests/unit/test_tag_extraction.py::TestTagExtraction::test_extract_python_functions
```

## Quality Gates

### Pre-commit Checks
1. All unit tests pass
2. Coverage > 90%
3. No linting errors
4. Type checking passes

### Pre-merge Checks
1. All integration tests pass
2. Performance benchmarks met
3. Memory profiling acceptable
4. Security scan clean

### Release Checks
1. All E2E tests pass
2. Load testing successful
3. Compatibility verified
4. Documentation updated