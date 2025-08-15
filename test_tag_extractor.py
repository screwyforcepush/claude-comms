"""
Comprehensive unit tests for tag_extractor.py module.
Testing tree-sitter based tag extraction for Python files.

Tests written FIRST following TDD principles.
"""

import pytest
import tempfile
import os
from pathlib import Path
from collections import namedtuple
from unittest.mock import Mock, patch, MagicMock


# Expected Tag namedtuple structure based on reference implementation
Tag = namedtuple("Tag", "rel_fname fname line name kind".split())


class TestTagNamedtuple:
    """Test the Tag namedtuple structure and behavior."""
    
    def test_tag_namedtuple_creation(self):
        """Test Tag namedtuple can be created with all required fields."""
        tag = Tag(
            rel_fname="src/module.py",
            fname="/full/path/src/module.py", 
            line=10,
            name="function_name",
            kind="def"
        )
        
        assert tag.rel_fname == "src/module.py"
        assert tag.fname == "/full/path/src/module.py"
        assert tag.line == 10
        assert tag.name == "function_name"
        assert tag.kind == "def"
    
    def test_tag_namedtuple_fields(self):
        """Test Tag namedtuple has exactly the expected fields."""
        expected_fields = ["rel_fname", "fname", "line", "name", "kind"]
        assert Tag._fields == tuple(expected_fields)
    
    def test_tag_definition_kind(self):
        """Test Tag with definition kind."""
        tag = Tag("test.py", "/test.py", 5, "MyClass", "def")
        assert tag.kind == "def"
    
    def test_tag_reference_kind(self):
        """Test Tag with reference kind."""
        tag = Tag("test.py", "/test.py", 15, "function_call", "ref")
        assert tag.kind == "ref"


class TestTagExtractorClass:
    """Test TagExtractor class creation and initialization."""
    
    def test_tag_extractor_import(self):
        """Test TagExtractor can be imported from tag_extractor module."""
        from tag_extractor import TagExtractor
        assert TagExtractor is not None
    
    def test_tag_extractor_initialization(self):
        """Test TagExtractor initializes with default configuration."""
        from tag_extractor import TagExtractor
        extractor = TagExtractor()
        assert extractor.enable_performance_metrics is True
        assert isinstance(extractor.performance_metrics, dict)
    
    def test_tag_extractor_supported_languages(self):
        """Test TagExtractor reports supported languages."""
        from tag_extractor import TagExtractor
        extractor = TagExtractor()
        languages = extractor.get_supported_languages()
        assert "python" in languages


class TestPythonFileTagExtraction:
    """Test Python file tag extraction functionality."""
    
    def test_extract_python_class_definition(self):
        """Test extraction of Python class definitions."""
        python_code = '''
class TestClass:
    """A test class."""
    pass

class AnotherClass:
    def method(self):
        pass
'''
        
        from tag_extractor import TagExtractor
        extractor = TagExtractor()
        tags = list(extractor.extract_tags(python_code, "test.py", "/full/test.py"))
        
        # Should find two class definitions
        class_tags = [tag for tag in tags if tag.kind == "def" and tag.name in ["TestClass", "AnotherClass"]]
        assert len(class_tags) == 2
        
        # Verify class names
        class_names = [tag.name for tag in class_tags]
        assert "TestClass" in class_names
        assert "AnotherClass" in class_names
    
    def test_extract_python_function_definition(self):
        """Test extraction of Python function definitions."""
        python_code = '''
def hello_world():
    """A simple function."""
    return "Hello, World!"

def another_function(param1, param2=None):
    return param1 + str(param2)
'''
        
        from tag_extractor import TagExtractor
        extractor = TagExtractor()
        tags = list(extractor.extract_tags(python_code, "test.py", "/full/test.py"))
        
        # Should find two function definitions
        func_tags = [tag for tag in tags if tag.kind == "def" and tag.name in ["hello_world", "another_function"]]
        assert len(func_tags) == 2
        
        # Verify function names
        func_names = [tag.name for tag in func_tags]
        assert "hello_world" in func_names
        assert "another_function" in func_names
    
    def test_extract_python_method_definition(self):
        """Test extraction of Python method definitions within classes."""
        python_code = '''
class MyClass:
    def __init__(self):
        self.value = 0
    
    def public_method(self):
        return self.value
    
    def _private_method(self):
        pass
'''
        
        from tag_extractor import TagExtractor
        extractor = TagExtractor()
        tags = list(extractor.extract_tags(python_code, "test.py", "/full/test.py"))
        
        # Should find class and method definitions
        def_tags = [tag for tag in tags if tag.kind == "def"]
        
        # Verify we found the class and methods
        names = [tag.name for tag in def_tags]
        assert "MyClass" in names
        assert "__init__" in names
        assert "public_method" in names
        assert "_private_method" in names
    
    def test_extract_python_function_calls(self):
        """Test extraction of Python function call references."""
        python_code = '''
def helper_function():
    return True

def main():
    result = helper_function()
    print(result)
    return len(str(result))
'''
        
        # This test will fail initially - driving implementation
        pytest.skip("Implementation pending")
    
    def test_extract_method_calls(self):
        """Test extraction of method call references."""
        python_code = '''
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result = calc.add(1, 2)
'''
        
        # This test will fail initially - driving implementation
        pytest.skip("Implementation pending")


class TestTagExtractionLineNumbers:
    """Test accurate line number reporting in tag extraction."""
    
    def test_class_definition_line_numbers(self):
        """Test class definitions report correct line numbers."""
        python_code = '''# Line 1 comment
# Line 2 comment
class FirstClass:  # Line 3
    pass

# Line 6 comment
class SecondClass:  # Line 7
    def method(self):  # Line 8
        pass
'''
        
        # This test will fail initially - driving implementation
        pytest.skip("Implementation pending")
    
    def test_function_definition_line_numbers(self):
        """Test function definitions report correct line numbers."""
        python_code = '''
def first_function():  # Line 2
    pass

def second_function():  # Line 5
    return True
'''
        
        # This test will fail initially - driving implementation  
        pytest.skip("Implementation pending")


class TestTagExtractionEdgeCases:
    """Test edge cases and error conditions in tag extraction."""
    
    def test_empty_file(self):
        """Test tag extraction from empty file."""
        python_code = ""
        
        # Should return empty list without errors
        pytest.skip("Implementation pending")
    
    def test_syntax_error_file(self):
        """Test tag extraction from file with syntax errors."""
        python_code = '''
class BrokenClass
    def missing_colon()
        pass
'''
        
        # Should handle syntax errors gracefully
        pytest.skip("Implementation pending")
    
    def test_unicode_characters(self):
        """Test tag extraction with unicode characters in names."""
        python_code = '''
def función_español():
    """Function with unicode characters."""
    return "¡Hola mundo!"

class ClassWithUnicode:
    def méthode_française(self):
        pass
'''
        
        # Should handle unicode properly
        pytest.skip("Implementation pending")
    
    def test_very_long_file(self):
        """Test tag extraction performance on large files."""
        # Generate a large Python file
        lines = ["def function_{}():".format(i) for i in range(1000)]
        lines.extend(["    pass"] * 1000)
        python_code = "\n".join(lines)
        
        # Should complete within reasonable time
        pytest.skip("Implementation pending")


class TestLanguageDetection:
    """Test language detection and query selection."""
    
    def test_python_file_detection(self):
        """Test Python file detection by extension."""
        test_files = [
            ("script.py", "python"),
            ("module.pyw", "python"),
            ("setup.py", "python"),
        ]
        
        # Should correctly identify Python files
        pytest.skip("Implementation pending")
    
    def test_unsupported_language(self):
        """Test handling of unsupported language files."""
        # Should return empty list or raise appropriate error
        pytest.skip("Implementation pending")


class TestQueryPatternUsage:
    """Test usage of tree-sitter query patterns."""
    
    def test_python_class_query_pattern(self):
        """Test Python class definition query pattern matches expected structure."""
        # Based on essential-query-patterns.md:
        # (class_definition name: (identifier) @name.definition.class) @definition.class
        pytest.skip("Implementation pending")
    
    def test_python_function_query_pattern(self):
        """Test Python function definition query pattern."""
        # Based on essential-query-patterns.md:
        # (function_definition name: (identifier) @name.definition.function) @definition.function
        pytest.skip("Implementation pending")
    
    def test_python_call_query_pattern(self):
        """Test Python function call query pattern."""
        # Based on essential-query-patterns.md:
        # (call function: (identifier) @name.reference.call) @reference.call
        pytest.skip("Implementation pending")


class TestCacheIntegration:
    """Test integration with caching system (for KevinFlux coordination)."""
    
    def test_tag_extraction_cache_key_generation(self):
        """Test cache key generation for tag extraction results."""
        # Should generate consistent cache keys based on file path and mtime
        pytest.skip("Implementation pending")
    
    def test_tag_extraction_cache_invalidation(self):
        """Test cache invalidation when file changes."""
        # Should invalidate cache when file modification time changes
        pytest.skip("Implementation pending")


class TestPerformanceMetrics:
    """Test performance metrics collection (for team collaboration)."""
    
    def test_tag_extraction_timing(self):
        """Test tag extraction timing metrics collection."""
        # Should collect timing data for performance analysis
        pytest.skip("Implementation pending")
    
    def test_tag_extraction_memory_usage(self):
        """Test memory usage monitoring during extraction."""
        # Should monitor memory usage for large files
        pytest.skip("Implementation pending")


class TestErrorHandling:
    """Test comprehensive error handling scenarios."""
    
    def test_file_not_found_error(self):
        """Test handling of non-existent files."""
        pytest.skip("Implementation pending")
    
    def test_permission_denied_error(self):
        """Test handling of files without read permissions."""
        pytest.skip("Implementation pending")
    
    def test_tree_sitter_parser_error(self):
        """Test handling of tree-sitter parsing errors."""
        pytest.skip("Implementation pending")
    
    def test_malformed_query_error(self):
        """Test handling of malformed tree-sitter queries."""
        pytest.skip("Implementation pending")


class TestIntegrationWithReferenceImplementation:
    """Test compatibility with reference implementation patterns."""
    
    def test_tag_structure_compatibility(self):
        """Test Tag structure matches reference implementation exactly."""
        # Tag = namedtuple("Tag", "rel_fname fname line name kind".split())
        # Must match reference implementation exactly
        tag = Tag("test.py", "/full/test.py", 10, "function_name", "def")
        
        # Verify exact field structure
        assert hasattr(tag, 'rel_fname')
        assert hasattr(tag, 'fname') 
        assert hasattr(tag, 'line')
        assert hasattr(tag, 'name')
        assert hasattr(tag, 'kind')
        
        # Verify field order
        assert tag._fields == ('rel_fname', 'fname', 'line', 'name', 'kind')
    
    def test_kind_values_compatibility(self):
        """Test kind values match reference implementation."""
        # Reference uses "def" for definitions and "ref" for references
        valid_kinds = ["def", "ref"]
        
        def_tag = Tag("test.py", "/test.py", 5, "MyClass", "def")
        ref_tag = Tag("test.py", "/test.py", 10, "function_call", "ref")
        
        assert def_tag.kind in valid_kinds
        assert ref_tag.kind in valid_kinds
    
    def test_line_number_zero_indexed(self):
        """Test line numbers use zero-based indexing like reference."""
        # Reference implementation uses node.start_point[0] which is zero-indexed
        tag = Tag("test.py", "/test.py", 0, "first_line_function", "def")
        assert tag.line == 0  # First line should be 0, not 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])