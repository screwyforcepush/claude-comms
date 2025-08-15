"""
Tree-sitter based tag extraction module for repository mapping.

This module provides core parsing functionality to extract definitions and references
from source code files using tree-sitter queries. It implements the WP-2.1 specification
for the TreeSitterRepoMap system.

Key Features:
- Tag extraction using tree-sitter queries
- Python language support (MVP)
- Extensible architecture for additional languages
- Performance metrics collection
- Cache-friendly design

Integration Points:
- Provides tag extraction interface to RobertNova (PageRank)
- Supports OliviaChain with language detection
- Coordinates with KevinFlux on cache integration
- Shares parsing performance metrics with team

Author: NinaMatrix
Phase: 01-TreeSitterRepoMap
WP: 2.1 Tree-sitter Parser - Core parsing module
"""

import warnings
from collections import namedtuple
from pathlib import Path
import time
from typing import List, Optional, Iterator, Dict, Any

# Suppress tree-sitter FutureWarnings
warnings.simplefilter("ignore", category=FutureWarning)

try:
    import tree_sitter
    from grep_ast.tsl import get_language, get_parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    try:
        import tree_sitter
        from tree_sitter_languages import get_language, get_parser
        TREE_SITTER_AVAILABLE = True
    except ImportError:
        TREE_SITTER_AVAILABLE = False


# Tag namedtuple structure - matches reference implementation exactly
Tag = namedtuple("Tag", "rel_fname fname line name kind".split())


class TagExtractionError(Exception):
    """Custom exception for tag extraction errors."""
    pass


class TagExtractor:
    """
    Core tree-sitter based tag extraction engine.
    
    Extracts definitions and references from source code using tree-sitter
    queries. Designed for high performance and extensibility.
    """
    
    # Python query patterns based on essential-query-patterns.md
    PYTHON_QUERIES = {
        "class_definitions": "(class_definition name: (identifier) @name.definition.class) @definition.class",
        "function_definitions": "(function_definition name: (identifier) @name.definition.function) @definition.function", 
        "function_calls": """(call
  function: [
    (identifier) @name.reference.call
    (attribute
      attribute: (identifier) @name.reference.call)
  ]) @reference.call"""
    }
    
    # Language support mapping
    SUPPORTED_LANGUAGES = {
        ".py": "python",
        ".pyw": "python",
    }
    
    def __init__(self, enable_performance_metrics: bool = True):
        """
        Initialize TagExtractor with configuration.
        
        Args:
            enable_performance_metrics: Whether to collect performance timing data
        """
        if not TREE_SITTER_AVAILABLE:
            raise TagExtractionError(
                "tree-sitter dependencies not available. "
                "Please install tree-sitter and tree-sitter-languages."
            )
        
        self.enable_performance_metrics = enable_performance_metrics
        self.performance_metrics = {}
        self._parser_cache = {}
        self._language_cache = {}
    
    def get_language_for_file(self, file_path: str) -> Optional[str]:
        """
        Detect language from file extension.
        
        Args:
            file_path: Path to the source file
            
        Returns:
            Language identifier if supported, None otherwise
        """
        path = Path(file_path)
        suffix = path.suffix.lower()
        return self.SUPPORTED_LANGUAGES.get(suffix)
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language identifiers.
        
        Returns:
            List of supported language names
        """
        return list(set(self.SUPPORTED_LANGUAGES.values()))
    
    def _get_parser(self, language: str):
        """Get cached parser for language."""
        if language not in self._parser_cache:
            try:
                self._parser_cache[language] = get_parser(language)
                self._language_cache[language] = get_language(language)
            except Exception as e:
                raise TagExtractionError(f"Failed to load parser for {language}: {e}")
        
        return self._parser_cache[language], self._language_cache[language]
    
    def extract_tags(self, source_code: str, rel_fname: str, abs_fname: str) -> Iterator[Tag]:
        """
        Extract tags from source code using tree-sitter.
        
        Args:
            source_code: The source code content
            rel_fname: Relative file path for tag records
            abs_fname: Absolute file path for tag records
            
        Yields:
            Tag objects for definitions and references found
            
        Raises:
            TagExtractionError: If extraction fails
        """
        start_time = time.time() if self.enable_performance_metrics else None
        
        # Detect language
        language = self.get_language_for_file(abs_fname)
        if not language:
            return
        
        # Only Python supported in MVP
        if language != "python":
            return
        
        try:
            # Get parser and language
            parser, tree_sitter_language = self._get_parser(language)
            
            # Parse source code
            if not source_code:
                return
                
            tree = parser.parse(source_code.encode('utf-8'))
            
            # Extract tags using queries
            yield from self._extract_python_tags(
                tree, tree_sitter_language, source_code, rel_fname, abs_fname
            )
            
        except Exception as e:
            raise TagExtractionError(f"Failed to extract tags from {abs_fname}: {e}")
        
        finally:
            if self.enable_performance_metrics and start_time:
                duration = time.time() - start_time
                self.performance_metrics[abs_fname] = {
                    'extraction_time': duration,
                    'timestamp': time.time()
                }
    
    def _extract_python_tags(self, tree, language, source_code: str, rel_fname: str, abs_fname: str) -> Iterator[Tag]:
        """
        Extract Python-specific tags using tree-sitter queries.
        
        Args:
            tree: Parsed tree-sitter tree
            language: Tree-sitter language object
            source_code: Original source code
            rel_fname: Relative file path
            abs_fname: Absolute file path
            
        Yields:
            Tag objects for Python definitions and references
        """
        # Execute all Python queries
        for query_name, query_string in self.PYTHON_QUERIES.items():
            try:
                query = language.query(query_string)
                captures = query.captures(tree.root_node)
                
                # Handle different capture formats (dict vs list)
                if isinstance(captures, dict):
                    # grep_ast format: dict of capture_name -> list of nodes
                    for capture_name, nodes in captures.items():
                        for node in nodes:
                            tag = self._create_tag_from_capture(node, capture_name, rel_fname, abs_fname)
                            if tag:
                                yield tag
                else:
                    # tree-sitter-languages format: list of (node, capture_name) tuples
                    for node, capture_name in captures:
                        tag = self._create_tag_from_capture(node, capture_name, rel_fname, abs_fname)
                        if tag:
                            yield tag
                    
            except Exception as e:
                # Log query error but continue with other queries
                if self.enable_performance_metrics:
                    self.performance_metrics.setdefault('query_errors', []).append({
                        'query': query_name,
                        'error': str(e),
                        'file': abs_fname
                    })
    
    def _create_tag_from_capture(self, node, capture_name: str, rel_fname: str, abs_fname: str) -> Optional[Tag]:
        """
        Create a Tag object from a tree-sitter capture.
        
        Args:
            node: Tree-sitter node
            capture_name: Name of the capture
            rel_fname: Relative file path
            abs_fname: Absolute file path
            
        Returns:
            Tag object or None if capture should be ignored
        """
        # Determine tag kind
        if capture_name.startswith("name.definition."):
            kind = "def"
        elif capture_name.startswith("name.reference."):
            kind = "ref"
        elif capture_name == "name":  # Simple capture name for definitions
            kind = "def"
        else:
            return None
        
        # Create tag
        return Tag(
            rel_fname=rel_fname,
            fname=abs_fname,
            line=node.start_point[0],  # Zero-indexed line number
            name=node.text.decode('utf-8'),
            kind=kind
        )
    
    def extract_tags_from_file(self, file_path: str, root_path: Optional[str] = None) -> List[Tag]:
        """
        Extract tags from a file on disk.
        
        Args:
            file_path: Path to the source file
            root_path: Root path for calculating relative path
            
        Returns:
            List of Tag objects found in the file
            
        Raises:
            TagExtractionError: If file cannot be read or parsed
        """
        abs_path = str(Path(file_path).resolve())
        
        # Calculate relative path
        if root_path:
            try:
                rel_path = str(Path(abs_path).relative_to(Path(root_path).resolve()))
            except ValueError:
                # Files outside root path
                rel_path = abs_path
        else:
            rel_path = str(Path(file_path).name)
        
        # Read file content
        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                source_code = f.read()
        except Exception as e:
            raise TagExtractionError(f"Failed to read file {abs_path}: {e}")
        
        # Extract tags
        return list(self.extract_tags(source_code, rel_path, abs_path))
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get collected performance metrics.
        
        Returns:
            Dictionary of performance data for sharing with team
        """
        return self.performance_metrics.copy()
    
    def clear_performance_metrics(self):
        """Clear collected performance metrics."""
        self.performance_metrics.clear()


# Utility functions for team integration

def extract_tags_from_code(source_code: str, file_path: str, root_path: Optional[str] = None) -> List[Tag]:
    """
    Convenience function to extract tags from source code.
    
    Args:
        source_code: The source code content
        file_path: File path for tag records
        root_path: Root path for relative path calculation
        
    Returns:
        List of extracted Tag objects
    """
    extractor = TagExtractor()
    
    # Calculate paths
    abs_path = str(Path(file_path).resolve())
    if root_path:
        try:
            rel_path = str(Path(abs_path).relative_to(Path(root_path).resolve()))
        except ValueError:
            rel_path = abs_path
    else:
        rel_path = str(Path(file_path).name)
    
    return list(extractor.extract_tags(source_code, rel_path, abs_path))


def get_supported_file_extensions() -> List[str]:
    """
    Get list of supported file extensions.
    
    Returns:
        List of file extensions (including dots)
    """
    return list(TagExtractor.SUPPORTED_LANGUAGES.keys())


def is_supported_file(file_path: str) -> bool:
    """
    Check if file is supported for tag extraction.
    
    Args:
        file_path: Path to check
        
    Returns:
        True if file type is supported
    """
    return Path(file_path).suffix.lower() in TagExtractor.SUPPORTED_LANGUAGES


# Interface for team collaboration

class TagExtractionInterface:
    """
    Interface class for team integration points.
    
    This class provides the standardized interface that other team members
    can depend on for tag extraction functionality.
    """
    
    @staticmethod
    def extract_file_tags(file_path: str, root_path: Optional[str] = None) -> List[Tag]:
        """
        Extract tags from a file - main interface for RobertNova.
        
        Args:
            file_path: Source file to analyze
            root_path: Project root for relative paths
            
        Returns:
            List of Tag objects (definitions and references)
        """
        extractor = TagExtractor()
        return extractor.extract_tags_from_file(file_path, root_path)
    
    @staticmethod
    def get_language_for_file(file_path: str) -> Optional[str]:
        """
        Language detection interface for OliviaChain.
        
        Args:
            file_path: File to detect language for
            
        Returns:
            Language identifier if supported
        """
        extractor = TagExtractor()
        return extractor.get_language_for_file(file_path)
    
    @staticmethod
    def get_performance_data() -> Dict[str, Any]:
        """
        Performance metrics interface for team sharing.
        
        Returns:
            Performance metrics for analysis
        """
        # Note: This is a simplified interface
        # In production, metrics would be collected centrally
        return {"interface_note": "Use TagExtractor instance for detailed metrics"}


if __name__ == "__main__":
    # Simple test/demo when run directly
    test_code = '''
class TestClass:
    def test_method(self):
        return "test"

def test_function():
    obj = TestClass()
    return obj.test_method()
'''
    
    tags = extract_tags_from_code(test_code, "test.py")
    print(f"Extracted {len(tags)} tags:")
    for tag in tags:
        print(f"  {tag.kind}: {tag.name} (line {tag.line})")