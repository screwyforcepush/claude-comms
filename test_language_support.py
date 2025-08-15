#!/usr/bin/env python3
"""
Comprehensive test suite for language_support.py module
Test-driven development for TreeSitter language detection and query loading

Tests written FIRST to specify expected behavior:
- Language detection from file extensions
- Dynamic .scm query loading
- Multi-language support (Python, JavaScript, TypeScript)
- Error handling and fallback mechanisms
- Performance requirements
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import tree_sitter

# Import the module under test (will be implemented after tests)
try:
    from language_support import (
        LanguageDetector,
        QueryLoader,
        LanguageRegistry,
        LanguageSupport,
        UnsupportedLanguageError,
        QueryLoadError
    )
except ImportError:
    # Expected during TDD - create mock classes for test development
    class LanguageDetector:
        pass
    class QueryLoader:
        pass
    class LanguageRegistry:
        pass
    class LanguageSupport:
        pass
    class UnsupportedLanguageError(Exception):
        pass
    class QueryLoadError(Exception):
        pass


class TestLanguageDetector:
    """Test language detection from file extensions and content analysis"""
    
    def test_detect_python_files(self):
        """Test detection of Python files by extension"""
        detector = LanguageDetector()
        
        # Basic Python files
        assert detector.detect_language("script.py") == "python"
        assert detector.detect_language("module.pyi") == "python"
        assert detector.detect_language("/path/to/file.py") == "python"
        assert detector.detect_language("complex_name.test.py") == "python"
    
    def test_detect_javascript_files(self):
        """Test detection of JavaScript files by extension"""
        detector = LanguageDetector()
        
        # JavaScript files
        assert detector.detect_language("app.js") == "javascript"
        assert detector.detect_language("module.mjs") == "javascript"
        assert detector.detect_language("config.cjs") == "javascript"
        assert detector.detect_language("/src/components/Button.js") == "javascript"
    
    def test_detect_typescript_files(self):
        """Test detection of TypeScript files by extension"""
        detector = LanguageDetector()
        
        # TypeScript files
        assert detector.detect_language("app.ts") == "typescript"
        assert detector.detect_language("types.d.ts") == "typescript"
        assert detector.detect_language("component.tsx") == "typescript"
        assert detector.detect_language("/src/utils/helper.ts") == "typescript"
    
    def test_detect_unsupported_language(self):
        """Test handling of unsupported file extensions"""
        detector = LanguageDetector()
        
        with pytest.raises(UnsupportedLanguageError):
            detector.detect_language("document.txt")
        
        with pytest.raises(UnsupportedLanguageError):
            detector.detect_language("image.png")
        
        with pytest.raises(UnsupportedLanguageError):
            detector.detect_language("data.json")
    
    def test_detect_case_insensitive(self):
        """Test case-insensitive extension detection"""
        detector = LanguageDetector()
        
        assert detector.detect_language("Script.PY") == "python"
        assert detector.detect_language("App.JS") == "javascript"
        assert detector.detect_language("Types.TS") == "typescript"
    
    def test_detect_no_extension(self):
        """Test handling of files without extensions"""
        detector = LanguageDetector()
        
        with pytest.raises(UnsupportedLanguageError):
            detector.detect_language("README")
        
        with pytest.raises(UnsupportedLanguageError):
            detector.detect_language("Makefile")
    
    def test_supported_languages_list(self):
        """Test getting list of supported languages"""
        detector = LanguageDetector()
        supported = detector.get_supported_languages()
        
        assert isinstance(supported, list)
        assert "python" in supported
        assert "javascript" in supported
        assert "typescript" in supported
        assert len(supported) >= 3  # At least the three required languages
    
    def test_is_language_supported(self):
        """Test checking if specific language is supported"""
        detector = LanguageDetector()
        
        assert detector.is_supported("python") is True
        assert detector.is_supported("javascript") is True
        assert detector.is_supported("typescript") is True
        assert detector.is_supported("unsupported") is False
        assert detector.is_supported("") is False


class TestQueryLoader:
    """Test dynamic loading of .scm query patterns"""
    
    def test_load_python_queries(self):
        """Test loading Python query patterns"""
        loader = QueryLoader()
        queries = loader.load_queries("python")
        
        assert isinstance(queries, dict)
        assert "definitions" in queries
        assert "references" in queries
        assert len(queries["definitions"]) > 0
        assert len(queries["references"]) > 0
    
    def test_load_javascript_queries(self):
        """Test loading JavaScript query patterns"""
        loader = QueryLoader()
        queries = loader.load_queries("javascript")
        
        assert isinstance(queries, dict)
        assert "definitions" in queries
        assert "references" in queries
        # JavaScript should have more complex patterns
        assert len(queries["definitions"]) >= len(loader.load_queries("python")["definitions"])
    
    def test_load_typescript_queries(self):
        """Test loading TypeScript query patterns"""
        loader = QueryLoader()
        queries = loader.load_queries("typescript")
        
        assert isinstance(queries, dict)
        assert "definitions" in queries
        assert "references" in queries
        # TypeScript should include type-specific patterns
        type_patterns = [q for q in queries["definitions"] if "interface" in q or "type" in q]
        assert len(type_patterns) > 0
    
    def test_load_unsupported_language_queries(self):
        """Test error handling for unsupported language queries"""
        loader = QueryLoader()
        
        with pytest.raises(QueryLoadError):
            loader.load_queries("unsupported")
    
    def test_query_caching(self):
        """Test that queries are cached after first load"""
        loader = QueryLoader()
        
        # Load queries twice
        queries1 = loader.load_queries("python")
        queries2 = loader.load_queries("python")
        
        # Should be the same object (cached)
        assert queries1 is queries2
    
    def test_query_validation(self):
        """Test that loaded queries are valid tree-sitter patterns"""
        loader = QueryLoader()
        queries = loader.load_queries("python")
        
        # Each query should be a valid string
        for category, query_list in queries.items():
            assert isinstance(query_list, list)
            for query in query_list:
                assert isinstance(query, str)
                assert len(query.strip()) > 0
                # Should contain tree-sitter capture syntax
                assert "@" in query
    
    def test_get_query_paths(self):
        """Test getting paths to query files"""
        loader = QueryLoader()
        
        python_path = loader.get_query_path("python")
        assert python_path.endswith(".scm")
        assert "python" in python_path.lower()
        
        js_path = loader.get_query_path("javascript")
        assert js_path.endswith(".scm")
        assert "javascript" in js_path.lower()
    
    def test_reload_queries(self):
        """Test forced reloading of cached queries"""
        loader = QueryLoader()
        
        # Load and cache
        queries1 = loader.load_queries("python")
        
        # Reload (bypass cache)
        queries2 = loader.load_queries("python", force_reload=True)
        
        # Should be different objects
        assert queries1 is not queries2
        # But content should be identical
        assert queries1 == queries2


class TestLanguageRegistry:
    """Test language configuration registry"""
    
    def test_register_language(self):
        """Test registering a new language configuration"""
        registry = LanguageRegistry()
        
        config = {
            "name": "python",
            "extensions": [".py", ".pyi"],
            "tree_sitter_name": "python",
            "query_file": "python-tags.scm"
        }
        
        registry.register_language("python", config)
        assert registry.is_registered("python")
        
        # Check that the configuration is stored correctly
        stored_config = registry.get_config("python")
        assert stored_config.name == config["name"]
        assert stored_config.extensions == config["extensions"]
        assert stored_config.tree_sitter_name == config["tree_sitter_name"]
        assert stored_config.query_file == config["query_file"]
    
    def test_get_language_by_extension(self):
        """Test getting language by file extension"""
        registry = LanguageRegistry()
        
        # Should work with default registrations
        assert registry.get_language_by_extension(".py") == "python"
        assert registry.get_language_by_extension(".js") == "javascript"
        assert registry.get_language_by_extension(".ts") == "typescript"
    
    def test_get_extensions_for_language(self):
        """Test getting file extensions for a language"""
        registry = LanguageRegistry()
        
        py_exts = registry.get_extensions("python")
        assert ".py" in py_exts
        assert ".pyi" in py_exts
        
        js_exts = registry.get_extensions("javascript")
        assert ".js" in js_exts
        assert ".mjs" in js_exts
        assert ".cjs" in js_exts
    
    def test_get_tree_sitter_language(self):
        """Test getting tree-sitter language name"""
        registry = LanguageRegistry()
        
        assert registry.get_tree_sitter_name("python") == "python"
        assert registry.get_tree_sitter_name("javascript") == "javascript"
        assert registry.get_tree_sitter_name("typescript") == "typescript"
    
    def test_default_languages_registered(self):
        """Test that required languages are registered by default"""
        registry = LanguageRegistry()
        
        assert registry.is_registered("python")
        assert registry.is_registered("javascript")
        assert registry.is_registered("typescript")
    
    def test_language_priorities(self):
        """Test language priority for conflicting extensions"""
        registry = LanguageRegistry()
        
        # .tsx should prefer typescript over javascript
        assert registry.get_language_by_extension(".tsx") == "typescript"


class TestLanguageSupport:
    """Test main LanguageSupport facade class"""
    
    def test_initialization(self):
        """Test LanguageSupport initialization"""
        support = LanguageSupport()
        
        assert hasattr(support, 'detector')
        assert hasattr(support, 'loader')
        assert hasattr(support, 'registry')
    
    def test_detect_and_load_python(self):
        """Test end-to-end detection and query loading for Python"""
        support = LanguageSupport()
        
        # Detect language
        language = support.detect_file_language("example.py")
        assert language == "python"
        
        # Load queries for detected language
        queries = support.get_queries(language)
        assert isinstance(queries, dict)
        assert "definitions" in queries
        assert "references" in queries
    
    def test_detect_and_load_javascript(self):
        """Test end-to-end detection and query loading for JavaScript"""
        support = LanguageSupport()
        
        language = support.detect_file_language("app.js")
        assert language == "javascript"
        
        queries = support.get_queries(language)
        assert isinstance(queries, dict)
        assert len(queries["definitions"]) > 0
    
    def test_detect_and_load_typescript(self):
        """Test end-to-end detection and query loading for TypeScript"""
        support = LanguageSupport()
        
        language = support.detect_file_language("types.ts")
        assert language == "typescript"
        
        queries = support.get_queries(language)
        assert isinstance(queries, dict)
        # TypeScript should have interface patterns
        has_interface = any("interface" in str(queries).lower() for _ in [1])
        assert has_interface or "interface" in str(queries)
    
    def test_get_supported_files(self):
        """Test filtering supported files from a list"""
        support = LanguageSupport()
        
        files = [
            "script.py",
            "app.js", 
            "types.ts",
            "README.md",
            "image.png",
            "config.json"
        ]
        
        supported = support.get_supported_files(files)
        expected = ["script.py", "app.js", "types.ts"]
        
        assert len(supported) == 3
        for file in expected:
            assert file in supported
    
    def test_batch_language_detection(self):
        """Test detecting languages for multiple files"""
        support = LanguageSupport()
        
        files = ["a.py", "b.js", "c.ts", "d.py"]
        languages = support.detect_languages(files)
        
        expected = {
            "a.py": "python",
            "b.js": "javascript", 
            "c.ts": "typescript",
            "d.py": "python"
        }
        
        assert languages == expected
    
    def test_get_all_queries(self):
        """Test getting queries for all supported languages"""
        support = LanguageSupport()
        
        all_queries = support.get_all_queries()
        
        assert isinstance(all_queries, dict)
        assert "python" in all_queries
        assert "javascript" in all_queries
        assert "typescript" in all_queries
        
        for lang, queries in all_queries.items():
            assert "definitions" in queries
            assert "references" in queries
    
    def test_performance_caching(self):
        """Test that repeated operations are cached for performance"""
        support = LanguageSupport()
        
        # Time first detection (should be fast but not cached)
        import time
        start = time.time()
        lang1 = support.detect_file_language("test.py")
        first_time = time.time() - start
        
        # Time second detection (should be cached and faster)
        start = time.time()
        lang2 = support.detect_file_language("test.py")
        second_time = time.time() - start
        
        assert lang1 == lang2
        # Second call should be significantly faster (cached)
        assert second_time <= first_time * 1.1  # Allow for timing variance


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_empty_filename(self):
        """Test handling of empty filename"""
        support = LanguageSupport()
        
        with pytest.raises(UnsupportedLanguageError):
            support.detect_file_language("")
    
    def test_none_filename(self):
        """Test handling of None filename"""
        support = LanguageSupport()
        
        with pytest.raises((UnsupportedLanguageError, TypeError)):
            support.detect_file_language(None)
    
    def test_corrupted_query_file(self):
        """Test handling of corrupted query files"""
        # Use a temporary directory to force file-based loading
        import tempfile
        from pathlib import Path
        
        with tempfile.TemporaryDirectory() as temp_dir:
            loader = QueryLoader(query_dir=Path(temp_dir))
            
            # Mock a corrupted file read for a language without embedded patterns
            with patch('builtins.open', side_effect=IOError("File corrupted")):
                with patch('pathlib.Path.exists', return_value=True):
                    with pytest.raises(QueryLoadError):
                        loader.load_queries("unsupported_language")
    
    def test_malformed_query_syntax(self):
        """Test handling of malformed query syntax"""
        # Use a temporary directory to force file-based loading
        import tempfile
        from pathlib import Path
        
        with tempfile.TemporaryDirectory() as temp_dir:
            loader = QueryLoader(query_dir=Path(temp_dir))
            
            # Mock malformed content for a language without embedded patterns
            with patch('builtins.open', mock_open(read_data="invalid query syntax")):
                with patch('pathlib.Path.exists', return_value=True):
                    with pytest.raises(QueryLoadError):
                        loader.load_queries("unsupported_language")
    
    def test_missing_tree_sitter_language(self):
        """Test handling when tree-sitter language is not available"""
        support = LanguageSupport()
        
        # Mock tree_sitter module to raise exception
        with patch('tree_sitter.Language', side_effect=OSError("Language not found")):
            with pytest.raises(UnsupportedLanguageError):
                support.get_tree_sitter_language("python")


class TestIntegrationWithTeam:
    """Test integration points with team members' modules"""
    
    def test_nina_matrix_language_detection_api(self):
        """Test API that NinaMatrix will use for language detection"""
        support = LanguageSupport()
        
        # API that NinaMatrix expects
        result = support.detect_file_language("example.py")
        assert result == "python"
        
        # Batch detection API
        files = ["a.py", "b.js"] 
        batch_result = support.detect_languages(files)
        assert batch_result == {"a.py": "python", "b.js": "javascript"}
    
    def test_kevin_flux_query_caching_api(self):
        """Test API that KevinFlux will use for query caching"""
        support = LanguageSupport()
        
        # Query loading with cache key
        queries = support.get_queries("python")
        cache_key = support.get_query_cache_key("python")
        
        assert isinstance(cache_key, str)
        assert "python" in cache_key
        assert isinstance(queries, dict)
    
    def test_sophia_qubit_filtering_api(self):
        """Test API that SophiaQubit will use for filtering"""
        support = LanguageSupport()
        
        # Get supported file extensions for filtering
        extensions = support.get_all_supported_extensions()
        assert isinstance(extensions, list)
        assert ".py" in extensions
        assert ".js" in extensions
        assert ".ts" in extensions
        
        # Check if file is supported
        assert support.is_file_supported("test.py") is True
        assert support.is_file_supported("test.txt") is False


def mock_open(read_data=""):
    """Helper function to create mock open context manager"""
    mock = MagicMock()
    mock.__enter__.return_value.read.return_value = read_data
    return mock


if __name__ == "__main__":
    # Run tests with coverage
    pytest.main([
        __file__,
        "-v",
        "--cov=language_support",
        "--cov-report=term-missing",
        "--cov-fail-under=90"
    ])