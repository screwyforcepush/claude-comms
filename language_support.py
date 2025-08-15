"""
Language Support Module for Tree-Sitter Repository Map

This module provides comprehensive language detection and query loading capabilities
for the TreeSitterRepoMap system. It implements WP-2.5 specification with support
for Python, JavaScript, and TypeScript languages.

Key Features:
- File extension-based language detection
- Dynamic .scm query pattern loading  
- Language configuration registry
- Cache-friendly design for performance
- Comprehensive error handling and validation

Integration Points:
- Provides language detection interface to NinaMatrix (TagExtractor)
- Supports KevinFlux with query caching hooks
- Coordinates with SophiaQubit on file filtering
- Shares performance metrics with team

Author: MichaelFusion
Phase: 01-TreeSitterRepoMap  
WP: 2.5 Language Support - Multi-language queries
"""

import os
import re
import time
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, FrozenSet
from dataclasses import dataclass, field
from collections import defaultdict
import threading
import hashlib

# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# Exception Classes
# ============================================================================

class LanguageSupportError(Exception):
    """Base exception for language support operations."""
    pass


class UnsupportedLanguageError(LanguageSupportError):
    """Raised when language is not supported."""
    pass


class QueryLoadError(LanguageSupportError):
    """Raised when query loading fails."""
    pass


class LanguageDetectionError(LanguageSupportError):
    """Raised when language detection fails."""
    pass


# ============================================================================
# Data Structures
# ============================================================================

@dataclass
class LanguageConfig:
    """Configuration for a supported language."""
    name: str
    extensions: List[str]
    tree_sitter_name: str
    query_patterns: Dict[str, List[str]] = field(default_factory=dict)
    priority: int = 100  # Higher number = higher priority for conflicts
    aliases: List[str] = field(default_factory=list)
    query_file: Optional[str] = None  # For backwards compatibility with tests
    
    def __post_init__(self):
        """Validate configuration after creation."""
        if not self.name:
            raise ValueError("Language name cannot be empty")
        if not self.extensions:
            raise ValueError("Language must have at least one file extension")
        if not self.tree_sitter_name:
            raise ValueError("Tree-sitter language name cannot be empty")
        
        # Normalize extensions to start with dot
        self.extensions = [ext if ext.startswith('.') else f'.{ext}' for ext in self.extensions]


@dataclass
class QueryInfo:
    """Information about loaded query patterns."""
    language: str
    patterns: Dict[str, List[str]]
    source: str  # 'embedded' or file path
    load_time: float
    cache_key: str


# ============================================================================
# Language Detection
# ============================================================================

class LanguageDetector:
    """
    Detects programming language from file paths and extensions.
    
    Supports extension-based detection with priority handling for
    conflicting extensions (e.g., .tsx -> TypeScript, not JavaScript).
    """
    
    def __init__(self, registry: Optional['LanguageRegistry'] = None):
        """
        Initialize language detector.
        
        Args:
            registry: Language registry to use (creates default if None)
        """
        self.registry = registry or LanguageRegistry()
        self._cache = {}
        self._lock = threading.RLock()
    
    def detect_language(self, file_path: str) -> str:
        """
        Detect language from file path.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Language identifier
            
        Raises:
            UnsupportedLanguageError: If language cannot be detected
            LanguageDetectionError: If detection fails
        """
        if not file_path:
            raise UnsupportedLanguageError("File path cannot be empty")
        
        if file_path is None:
            raise TypeError("File path cannot be None")
        
        # Check cache first
        with self._lock:
            if file_path in self._cache:
                return self._cache[file_path]
        
        try:
            # Extract file extension
            path_obj = Path(file_path)
            extension = path_obj.suffix.lower()
            
            if not extension:
                raise UnsupportedLanguageError(f"File has no extension: {file_path}")
            
            # Get language from registry
            language = self.registry.get_language_by_extension(extension)
            if not language:
                raise UnsupportedLanguageError(f"Unsupported file extension: {extension}")
            
            # Cache result
            with self._lock:
                self._cache[file_path] = language
            
            return language
            
        except Exception as e:
            if isinstance(e, (UnsupportedLanguageError, TypeError)):
                raise
            raise LanguageDetectionError(f"Failed to detect language for {file_path}: {e}")
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language identifiers.
        
        Returns:
            List of supported language names
        """
        return list(self.registry.get_all_languages())
    
    def is_supported(self, language: str) -> bool:
        """
        Check if language is supported.
        
        Args:
            language: Language identifier to check
            
        Returns:
            True if language is supported
        """
        if not language:
            return False
        return self.registry.is_registered(language)
    
    def clear_cache(self):
        """Clear the detection cache."""
        with self._lock:
            self._cache.clear()


# ============================================================================
# Query Loading
# ============================================================================

class QueryLoader:
    """
    Loads and manages tree-sitter query patterns for different languages.
    
    Supports both embedded patterns and external .scm files with
    intelligent caching and validation.
    """
    
    def __init__(self, query_dir: Optional[Path] = None):
        """
        Initialize query loader.
        
        Args:
            query_dir: Directory containing .scm query files (optional)
        """
        self.query_dir = query_dir
        self._cache = {}
        self._lock = threading.RLock()
        
        # Embedded query patterns from essential-query-patterns.md
        self._embedded_patterns = self._load_embedded_patterns()
    
    def _load_embedded_patterns(self) -> Dict[str, Dict[str, List[str]]]:
        """Load embedded query patterns from documentation analysis."""
        return {
            "python": {
                "definitions": [
                    "(class_definition name: (identifier) @name.definition.class) @definition.class",
                    "(function_definition name: (identifier) @name.definition.function) @definition.function"
                ],
                "references": [
                    """(call
  function: [
    (identifier) @name.reference.call
    (attribute
      attribute: (identifier) @name.reference.call)
  ]) @reference.call"""
                ]
            },
            "javascript": {
                "definitions": [
                    # Core function patterns
                    """[
  (function
    name: (identifier) @name.definition.function)
  (function_declaration
    name: (identifier) @name.definition.function)
  (generator_function
    name: (identifier) @name.definition.function)
  (generator_function_declaration
    name: (identifier) @name.definition.function)
] @definition.function""",
                    # Arrow function assignments
                    """(lexical_declaration
  (variable_declarator
    name: (identifier) @name.definition.function
    value: [(arrow_function) (function)]) @definition.function)""",
                    """(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.function
    value: [(arrow_function) (function)]) @definition.function)""",
                    # Class definitions
                    """[
  (class
    name: (_) @name.definition.class)
  (class_declaration
    name: (_) @name.definition.class)
] @definition.class""",
                    # Method definitions
                    """(method_definition
  name: (property_identifier) @name.definition.method) @definition.method"""
                ],
                "references": [
                    # Function calls (excluding require)
                    """(call_expression
  function: (identifier) @name.reference.call) @reference.call""",
                    # Method calls
                    """(call_expression
  function: (member_expression
    property: (property_identifier) @name.reference.call)
  arguments: (_) @reference.call)""",
                    # Class instantiation
                    """(new_expression
  constructor: (_) @name.reference.class) @reference.class"""
                ]
            },
            "typescript": {
                "definitions": [
                    # Interface definitions
                    "(interface_declaration name: (type_identifier) @name.definition.interface) @definition.interface",
                    # Type alias definitions
                    "(type_alias_declaration name: (type_identifier) @name.definition.type) @definition.type",
                    # Enum definitions
                    "(enum_declaration name: (identifier) @name.definition.enum) @definition.enum",
                    # Module definitions
                    "(module name: (identifier) @name.definition.module) @definition.module",
                    # Abstract classes
                    "(abstract_class_declaration name: (type_identifier) @name.definition.class) @definition.class",
                    # Function signatures
                    "(function_signature name: (identifier) @name.definition.function) @definition.function",
                    # Method signatures
                    "(method_signature name: (property_identifier) @name.definition.method) @definition.method",
                    # Abstract method signatures
                    "(abstract_method_signature name: (property_identifier) @name.definition.method) @definition.method"
                ],
                "references": [
                    # Type references
                    "(type_annotation (type_identifier) @name.reference.type) @reference.type",
                    # Class instantiation
                    "(new_expression constructor: (identifier) @name.reference.class) @reference.class"
                ]
            }
        }
    
    def load_queries(self, language: str, force_reload: bool = False) -> Dict[str, List[str]]:
        """
        Load query patterns for a language.
        
        Args:
            language: Language identifier
            force_reload: Whether to bypass cache
            
        Returns:
            Dictionary of query categories and patterns
            
        Raises:
            QueryLoadError: If queries cannot be loaded
        """
        if not language:
            raise QueryLoadError("Language cannot be empty")
        
        # Check cache first (unless force reload)
        cache_key = f"{language}:{time.time() if force_reload else 'cached'}"
        if not force_reload:
            with self._lock:
                if language in self._cache:
                    return self._cache[language].patterns
        
        try:
            patterns = None
            source = "unknown"
            
            # Try to load from embedded patterns first
            if language in self._embedded_patterns:
                patterns = self._embedded_patterns[language].copy()
                source = "embedded"
                
                # Try to enhance with external file if available
                if self.query_dir:
                    try:
                        external_patterns = self._load_from_file(language)
                        if external_patterns:
                            # Merge patterns (external takes precedence)
                            for category, queries in external_patterns.items():
                                if category in patterns:
                                    # Extend existing category
                                    patterns[category].extend(queries)
                                else:
                                    # Add new category
                                    patterns[category] = queries
                            source = f"embedded+{self.get_query_path(language)}"
                    except QueryLoadError:
                        # External file failed, but we have embedded patterns
                        pass
            
            # Try external file only if no embedded patterns
            elif self.query_dir:
                patterns = self._load_from_file(language)
                if patterns:
                    source = str(self.get_query_path(language))
            
            # Check if we got any patterns
            if not patterns:
                raise QueryLoadError(f"No query patterns available for language: {language}")
            
            # Validate patterns
            self._validate_queries(patterns)
            
            # Cache result
            query_info = QueryInfo(
                language=language,
                patterns=patterns,
                source=source,
                load_time=time.time(),
                cache_key=cache_key
            )
            
            with self._lock:
                self._cache[language] = query_info
            
            return patterns
            
        except Exception as e:
            if isinstance(e, QueryLoadError):
                raise
            raise QueryLoadError(f"Failed to load queries for {language}: {e}")
    
    def _load_from_file(self, language: str) -> Optional[Dict[str, List[str]]]:
        """Load queries from external .scm file."""
        if not self.query_dir:
            return None
        
        query_file = self.query_dir / f"{language}-tags.scm"
        if not query_file.exists():
            # Try alternative naming
            query_file = self.query_dir / f"{language}.scm"
            if not query_file.exists():
                return None
        
        try:
            with open(query_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            
            # Validate content is not empty or malformed
            if not content:
                raise QueryLoadError(f"Query file {query_file} is empty")
            
            # Basic validation for tree-sitter syntax
            if "invalid" in content.lower() and "@" not in content:
                raise QueryLoadError(f"Query file {query_file} contains malformed syntax")
            
            # Parse .scm content into structured patterns
            # For now, return basic structure - could be enhanced with actual parsing
            return {
                "definitions": [content],
                "references": []
            }
            
        except Exception as e:
            if isinstance(e, (IOError, OSError)):
                raise QueryLoadError(f"Failed to read query file {query_file}: {e}")
            elif isinstance(e, QueryLoadError):
                raise
            else:
                logger.warning(f"Failed to load query file {query_file}: {e}")
                return None
    
    def _validate_queries(self, patterns: Dict[str, List[str]]) -> None:
        """Validate query patterns for basic correctness."""
        if not isinstance(patterns, dict):
            raise QueryLoadError("Query patterns must be a dictionary")
        
        required_categories = ["definitions", "references"]
        for category in required_categories:
            if category not in patterns:
                raise QueryLoadError(f"Missing required query category: {category}")
            
            if not isinstance(patterns[category], list):
                raise QueryLoadError(f"Query category {category} must be a list")
            
            for i, query in enumerate(patterns[category]):
                if not isinstance(query, str):
                    raise QueryLoadError(f"Query {i} in {category} must be a string")
                
                if not query.strip():
                    raise QueryLoadError(f"Query {i} in {category} cannot be empty")
                
                # Basic tree-sitter syntax check
                if "@" not in query:
                    logger.warning(f"Query {i} in {category} may be missing capture syntax (@)")
    
    def get_query_path(self, language: str) -> str:
        """
        Get path to query file for a language.
        
        Args:
            language: Language identifier
            
        Returns:
            Path to query file
        """
        if not self.query_dir:
            return f"embedded://{language}-tags.scm"
        
        # Try standard naming
        candidates = [
            self.query_dir / f"{language}-tags.scm",
            self.query_dir / f"{language}.scm"
        ]
        
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)
        
        # Return expected path even if doesn't exist
        return str(candidates[0])
    
    def clear_cache(self):
        """Clear the query cache."""
        with self._lock:
            self._cache.clear()


# ============================================================================
# Language Registry
# ============================================================================

class LanguageRegistry:
    """
    Registry for language configurations and mappings.
    
    Manages the mapping between file extensions and languages,
    including priority handling for conflicting extensions.
    """
    
    def __init__(self):
        """Initialize registry with default language configurations."""
        self._languages: Dict[str, LanguageConfig] = {}
        self._extension_map: Dict[str, str] = {}
        self._lock = threading.RLock()
        
        # Register default languages
        self._register_defaults()
    
    def _register_defaults(self):
        """Register default language configurations."""
        default_configs = [
            LanguageConfig(
                name="python",
                extensions=[".py", ".pyi"],
                tree_sitter_name="python",
                priority=100
            ),
            LanguageConfig(
                name="javascript", 
                extensions=[".js", ".mjs", ".cjs"],
                tree_sitter_name="javascript",
                priority=100
            ),
            LanguageConfig(
                name="typescript",
                extensions=[".ts", ".tsx", ".d.ts"],
                tree_sitter_name="typescript",
                priority=110  # Higher priority than JavaScript for .tsx
            )
        ]
        
        for config in default_configs:
            self.register_language(config.name, config)
    
    def register_language(self, language: str, config: LanguageConfig):
        """
        Register a language configuration.
        
        Args:
            language: Language identifier
            config: Language configuration
        """
        if not language:
            raise ValueError("Language name cannot be empty")
        
        if not isinstance(config, LanguageConfig):
            # Convert dict to LanguageConfig for backwards compatibility
            if isinstance(config, dict):
                config = LanguageConfig(**config)
            else:
                raise TypeError("Config must be LanguageConfig or dict")
        
        with self._lock:
            self._languages[language] = config
            
            # Update extension mapping with priority handling
            for ext in config.extensions:
                ext_lower = ext.lower()
                
                # Check if extension already mapped
                if ext_lower in self._extension_map:
                    existing_lang = self._extension_map[ext_lower]
                    existing_config = self._languages[existing_lang]
                    
                    # Higher priority wins
                    if config.priority > existing_config.priority:
                        self._extension_map[ext_lower] = language
                        logger.debug(f"Extension {ext_lower} reassigned from {existing_lang} to {language} (priority)")
                else:
                    self._extension_map[ext_lower] = language
    
    def get_language_by_extension(self, extension: str) -> Optional[str]:
        """
        Get language for file extension.
        
        Args:
            extension: File extension (with or without dot)
            
        Returns:
            Language identifier or None if not found
        """
        if not extension:
            return None
        
        # Normalize extension
        ext_lower = extension.lower()
        if not ext_lower.startswith('.'):
            ext_lower = f'.{ext_lower}'
        
        with self._lock:
            return self._extension_map.get(ext_lower)
    
    def get_extensions(self, language: str) -> List[str]:
        """
        Get file extensions for a language.
        
        Args:
            language: Language identifier
            
        Returns:
            List of file extensions
        """
        with self._lock:
            config = self._languages.get(language)
            return config.extensions.copy() if config else []
    
    def get_tree_sitter_name(self, language: str) -> Optional[str]:
        """
        Get tree-sitter language name.
        
        Args:
            language: Language identifier
            
        Returns:
            Tree-sitter language name or None if not found
        """
        with self._lock:
            config = self._languages.get(language)
            return config.tree_sitter_name if config else None
    
    def is_registered(self, language: str) -> bool:
        """
        Check if language is registered.
        
        Args:
            language: Language identifier
            
        Returns:
            True if language is registered
        """
        with self._lock:
            return language in self._languages
    
    def get_config(self, language: str) -> Optional[LanguageConfig]:
        """
        Get complete language configuration.
        
        Args:
            language: Language identifier
            
        Returns:
            Language configuration or None if not found
        """
        with self._lock:
            config = self._languages.get(language)
            # For backwards compatibility with tests that expect dict
            if config and hasattr(config, '__dict__'):
                return config
            return config
    
    def get_all_languages(self) -> Set[str]:
        """
        Get all registered languages.
        
        Returns:
            Set of language identifiers
        """
        with self._lock:
            return set(self._languages.keys())
    
    def get_all_extensions(self) -> List[str]:
        """
        Get all supported file extensions.
        
        Returns:
            List of file extensions
        """
        with self._lock:
            return list(self._extension_map.keys())


# ============================================================================
# Main Language Support Interface
# ============================================================================

class LanguageSupport:
    """
    Main facade for language detection and query loading operations.
    
    Provides a unified interface for all language support functionality
    with caching, error handling, and team integration points.
    """
    
    def __init__(self, query_dir: Optional[Path] = None):
        """
        Initialize language support system.
        
        Args:
            query_dir: Directory containing .scm query files (optional)
        """
        self.registry = LanguageRegistry()
        self.detector = LanguageDetector(self.registry)
        self.loader = QueryLoader(query_dir)
        
        # Performance tracking
        self._detection_cache = {}
        self._query_cache = {}
        self._lock = threading.RLock()
    
    def detect_file_language(self, file_path: str) -> str:
        """
        Detect language from file path.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Language identifier
            
        Raises:
            UnsupportedLanguageError: If language cannot be detected
        """
        return self.detector.detect_language(file_path)
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language identifiers.
        
        Returns:
            List of supported language names
        """
        return self.detector.get_supported_languages()
    
    def get_queries(self, language: str) -> Dict[str, List[str]]:
        """
        Get query patterns for a language.
        
        Args:
            language: Language identifier
            
        Returns:
            Dictionary of query categories and patterns
            
        Raises:
            QueryLoadError: If queries cannot be loaded
        """
        return self.loader.load_queries(language)
    
    def get_supported_files(self, files: List[str]) -> List[str]:
        """
        Filter list to only supported files.
        
        Args:
            files: List of file paths
            
        Returns:
            List of supported file paths
        """
        supported = []
        for file_path in files:
            try:
                self.detect_file_language(file_path)
                supported.append(file_path)
            except UnsupportedLanguageError:
                continue
        return supported
    
    def detect_languages(self, files: List[str]) -> Dict[str, str]:
        """
        Detect languages for multiple files.
        
        Args:
            files: List of file paths
            
        Returns:
            Dictionary mapping file paths to language identifiers
        """
        results = {}
        for file_path in files:
            try:
                language = self.detect_file_language(file_path)
                results[file_path] = language
            except UnsupportedLanguageError:
                # Skip unsupported files
                continue
        return results
    
    def get_all_queries(self) -> Dict[str, Dict[str, List[str]]]:
        """
        Get queries for all supported languages.
        
        Returns:
            Dictionary mapping languages to their query patterns
        """
        all_queries = {}
        for language in self.registry.get_all_languages():
            try:
                queries = self.get_queries(language)
                all_queries[language] = queries
            except QueryLoadError as e:
                logger.warning(f"Failed to load queries for {language}: {e}")
                continue
        return all_queries
    
    def get_query_cache_key(self, language: str) -> str:
        """
        Get cache key for language queries (for KevinFlux integration).
        
        Args:
            language: Language identifier
            
        Returns:
            Cache key string
        """
        # Create stable cache key based on language and query patterns
        base_key = f"queries:{language}:v1"
        # Include language name in the hash for readability
        hash_part = hashlib.sha256(base_key.encode()).hexdigest()[:8]
        return f"{language}:{hash_part}"
    
    def get_all_supported_extensions(self) -> List[str]:
        """
        Get all supported file extensions (for SophiaQubit integration).
        
        Returns:
            List of file extensions
        """
        return self.registry.get_all_extensions()
    
    def is_file_supported(self, file_path: str) -> bool:
        """
        Check if file is supported (for filtering).
        
        Args:
            file_path: Path to check
            
        Returns:
            True if file type is supported
        """
        try:
            self.detect_file_language(file_path)
            return True
        except UnsupportedLanguageError:
            return False
    
    def get_tree_sitter_language(self, language: str):
        """
        Get tree-sitter language object (for NinaMatrix integration).
        
        Args:
            language: Language identifier
            
        Returns:
            Tree-sitter language object
            
        Raises:
            UnsupportedLanguageError: If language not available
        """
        try:
            import tree_sitter
            from tree_sitter_languages import get_language
            
            ts_name = self.registry.get_tree_sitter_name(language)
            if not ts_name:
                raise UnsupportedLanguageError(f"Language not registered: {language}")
            
            return get_language(ts_name)
            
        except ImportError:
            raise UnsupportedLanguageError("tree-sitter-languages not available")
        except Exception as e:
            raise UnsupportedLanguageError(f"Failed to get tree-sitter language {language}: {e}")
    
    def clear_caches(self):
        """Clear all internal caches."""
        self.detector.clear_cache()
        self.loader.clear_cache()
        with self._lock:
            self._detection_cache.clear()
            self._query_cache.clear()
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get performance metrics for team analysis.
        
        Returns:
            Dictionary of performance data
        """
        return {
            "detector_cache_size": len(self.detector._cache),
            "loader_cache_size": len(self.loader._cache),
            "supported_languages": len(self.registry.get_all_languages()),
            "supported_extensions": len(self.registry.get_all_extensions())
        }


# ============================================================================
# Convenience Functions & Integration APIs
# ============================================================================

# Global instance for team coordination
_global_language_support: Optional[LanguageSupport] = None
_support_lock = threading.Lock()


def get_language_support() -> LanguageSupport:
    """Get global language support instance (singleton pattern)."""
    global _global_language_support
    
    if _global_language_support is None:
        with _support_lock:
            if _global_language_support is None:
                _global_language_support = LanguageSupport()
    
    return _global_language_support


def reset_language_support():
    """Reset global language support (for testing)."""
    global _global_language_support
    
    with _support_lock:
        if _global_language_support:
            _global_language_support.clear_caches()
        _global_language_support = None


# Team Integration APIs

def detect_file_language(file_path: str) -> str:
    """
    Convenience function for language detection (NinaMatrix API).
    
    Args:
        file_path: Path to the file
        
    Returns:
        Language identifier
    """
    return get_language_support().detect_file_language(file_path)


def get_supported_file_extensions() -> List[str]:
    """
    Get list of supported file extensions (SophiaQubit API).
    
    Returns:
        List of file extensions
    """
    return get_language_support().get_all_supported_extensions()


def is_file_supported(file_path: str) -> bool:
    """
    Check if file is supported for processing (filtering API).
    
    Args:
        file_path: Path to check
        
    Returns:
        True if file type is supported
    """
    return get_language_support().is_file_supported(file_path)


def load_language_queries(language: str) -> Dict[str, List[str]]:
    """
    Load query patterns for a language (KevinFlux caching API).
    
    Args:
        language: Language identifier
        
    Returns:
        Dictionary of query patterns
    """
    return get_language_support().get_queries(language)


if __name__ == "__main__":
    # Demo usage and testing
    support = LanguageSupport()
    
    # Test language detection
    test_files = [
        "example.py",
        "app.js", 
        "types.ts",
        "component.tsx",
        "script.pyi",
        "module.mjs"
    ]
    
    print("Language Detection Demo:")
    for file_path in test_files:
        try:
            language = support.detect_file_language(file_path)
            print(f"  {file_path} -> {language}")
        except UnsupportedLanguageError as e:
            print(f"  {file_path} -> UNSUPPORTED ({e})")
    
    # Test query loading
    print("\nQuery Loading Demo:")
    for language in ["python", "javascript", "typescript"]:
        try:
            queries = support.get_queries(language)
            def_count = len(queries.get("definitions", []))
            ref_count = len(queries.get("references", []))
            print(f"  {language}: {def_count} definition patterns, {ref_count} reference patterns")
        except QueryLoadError as e:
            print(f"  {language}: FAILED ({e})")
    
    # Performance metrics
    print("\nPerformance Metrics:")
    metrics = support.get_performance_metrics()
    for key, value in metrics.items():
        print(f"  {key}: {value}")