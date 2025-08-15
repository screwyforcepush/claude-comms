#!/usr/bin/env python3
"""
Tree-Sitter Repository Map Hook

Integrates tag extraction, PageRank, token management, and caching to generate
intelligent repository maps injected into user context.

Architecture:
- TagExtractor: Parses source files using tree-sitter
- GraphRanker: Applies PageRank algorithm for importance ranking
- CacheManager: Three-level caching for performance
- Token Management: Budget-aware content optimization

Author: PeterQuantum (Integration Specialist)
Phase: 01-TreeSitterRepoMap
WP: 3.1 Hook Integration
"""

import json
import sys
import os
import time
import logging
from pathlib import Path
from typing import List, Dict, Set, Optional, Any
from dataclasses import dataclass

# Import modules - graceful fallback if not available
try:
    # Add project root to path for module imports  
    # Hook is at .claude/hooks/context/repo_map.py, so project root is 3 levels up
    project_root = Path(__file__).parent.parent.parent.parent
    sys.path.insert(0, str(project_root))
    
    # Import from current directory (modules are in project root)
    import importlib.util
    
    # Load tag_extractor
    tag_extractor_path = project_root / "tag_extractor.py"
    if tag_extractor_path.exists():
        spec = importlib.util.spec_from_file_location("tag_extractor", tag_extractor_path)
        tag_extractor_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tag_extractor_module)
        TagExtractor = tag_extractor_module.TagExtractor
        TagExtractionInterface = tag_extractor_module.TagExtractionInterface
        Tag = tag_extractor_module.Tag
        TAG_EXTRACTOR_AVAILABLE = True
    else:
        raise ImportError("tag_extractor.py not found")
        
except ImportError as e:
    logging.warning(f"Tag extractor not available: {e}")
    TAG_EXTRACTOR_AVAILABLE = False
    Tag = None

try:
    # Load graph_ranker
    graph_ranker_path = project_root / "graph_ranker.py"
    if graph_ranker_path.exists():
        spec = importlib.util.spec_from_file_location("graph_ranker", graph_ranker_path)
        graph_ranker_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(graph_ranker_module)
        GraphRanker = graph_ranker_module.GraphRanker
        rank_files_from_tags = graph_ranker_module.rank_files_from_tags
        GRAPH_RANKER_AVAILABLE = True
    else:
        raise ImportError("graph_ranker.py not found")
        
except ImportError as e:
    logging.warning(f"Graph ranker not available: {e}")
    GRAPH_RANKER_AVAILABLE = False

try:
    # Load cache_manager
    cache_manager_path = project_root / "cache_manager.py" 
    if cache_manager_path.exists():
        spec = importlib.util.spec_from_file_location("cache_manager", cache_manager_path)
        cache_manager_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cache_manager_module)
        CacheManager = cache_manager_module.CacheManager
        MapCacheKey = cache_manager_module.MapCacheKey
        create_cache_manager = cache_manager_module.create_cache_manager
        CACHE_MANAGER_AVAILABLE = True
    else:
        raise ImportError("cache_manager.py not found")
        
except ImportError as e:
    logging.warning(f"Cache manager not available: {e}")
    CACHE_MANAGER_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
logger = logging.getLogger(__name__)

# Basic token management implementation (inline)
@dataclass
class TokenCount:
    """Simple token count result."""
    tokens: int
    text: str
    cached: bool = False

class SimpleTokenizer:
    """Basic tokenizer using whitespace splitting."""
    
    def __init__(self):
        self.cache = {}
    
    def count_tokens(self, text: str) -> TokenCount:
        """Count tokens using simple whitespace splitting."""
        if not text:
            return TokenCount(0, text)
        
        # Simple cache check
        text_hash = hash(text)
        if text_hash in self.cache:
            cached_count = self.cache[text_hash]
            return TokenCount(cached_count, text, cached=True)
        
        # Basic token counting (words + punctuation)
        # This is a rough approximation - real tokenizers are more sophisticated
        tokens = len(text.split())
        # Add rough adjustment for punctuation and formatting
        tokens += text.count('\n') // 4  # Line breaks
        tokens += text.count('{') + text.count('}')  # Braces
        tokens += text.count('(') + text.count(')')  # Parentheses
        
        self.cache[text_hash] = tokens
        return TokenCount(tokens, text, cached=False)

class RepoMapGenerator:
    """Main repository map generator integrating all modules."""
    
    def __init__(self, map_tokens: int = 1024):
        """Initialize with token budget."""
        self.map_tokens = map_tokens
        self.tokenizer = SimpleTokenizer()
        
        # Initialize modules if available
        self.tag_extractor = TagExtractor() if TAG_EXTRACTOR_AVAILABLE else None
        self.cache_manager = create_cache_manager() if CACHE_MANAGER_AVAILABLE else None
        
        logger.info(f"RepoMapGenerator initialized with {map_tokens} token budget")
        logger.info(f"Modules available: extractor={TAG_EXTRACTOR_AVAILABLE}, "
                   f"ranker={GRAPH_RANKER_AVAILABLE}, cache={CACHE_MANAGER_AVAILABLE}")
    
    def generate_repo_map(self, 
                         chat_files: Optional[Set[str]] = None,
                         mentioned_files: Optional[Set[str]] = None,
                         mentioned_idents: Optional[Set[str]] = None) -> str:
        """Generate repository map with all modules integrated."""
        start_time = time.time()
        
        if chat_files is None:
            chat_files = set()
        if mentioned_files is None:
            mentioned_files = set()
        if mentioned_idents is None:
            mentioned_idents = set()
        
        logger.info(f"Generating repo map for {len(chat_files)} chat files, "
                   f"{len(mentioned_files)} mentioned files, {len(mentioned_idents)} mentioned identifiers")
        
        try:
            # Step 1: Check cache if available
            if self.cache_manager:
                cache_key = MapCacheKey(
                    chat_files=frozenset(chat_files),
                    other_files=frozenset(mentioned_files),
                    max_tokens=self.map_tokens,
                    mentioned_fnames=frozenset(mentioned_files),
                    mentioned_idents=frozenset(mentioned_idents)
                )
                
                cached_map = self.cache_manager.get_map(cache_key)
                if cached_map:
                    logger.info("Returning cached repository map")
                    return cached_map
            
            # Step 2: Discover source files
            source_files = self._discover_source_files()
            logger.info(f"Discovered {len(source_files)} source files")
            
            # Step 3: Extract tags if extractor available
            if self.tag_extractor and TAG_EXTRACTOR_AVAILABLE:
                tags = self._extract_tags_from_files(source_files)
                logger.info(f"Extracted {len(tags)} tags from source files")
                
                # Step 4: Apply PageRank if available
                if GRAPH_RANKER_AVAILABLE:
                    file_rankings, definition_rankings = self._apply_pagerank(
                        tags, chat_files, mentioned_files, mentioned_idents
                    )
                else:
                    # Fallback: use simple file prioritization
                    file_rankings = self._simple_file_ranking(source_files, chat_files, mentioned_files)
                    definition_rankings = []
            else:
                # Fallback: no tag extraction
                tags = []
                file_rankings = self._simple_file_ranking(source_files, chat_files, mentioned_files)
                definition_rankings = []
            
            # Step 5: Generate map content within token budget
            repo_map = self._build_repo_map(file_rankings, definition_rankings, tags)
            
            # Step 6: Cache result if cache manager available
            if self.cache_manager:
                generation_time = time.time() - start_time
                token_count = self.tokenizer.count_tokens(repo_map).tokens
                self.cache_manager.set_map(cache_key, repo_map, token_count, generation_time)
            
            logger.info(f"Generated repository map in {time.time() - start_time:.2f}s")
            return repo_map
            
        except Exception as e:
            logger.error(f"Error generating repository map: {e}")
            return self._generate_fallback_map(chat_files, mentioned_files)
    
    def _discover_source_files(self) -> List[str]:
        """Discover source files in the project."""
        project_root = Path.cwd()
        source_files = []
        
        # Common source file patterns
        patterns = ['**/*.py', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', 
                   '**/*.java', '**/*.cpp', '**/*.h', '**/*.cs', '**/*.go']
        
        for pattern in patterns:
            try:
                files = list(project_root.glob(pattern))
                for file_path in files:
                    # Skip common directories to ignore
                    if any(part in str(file_path) for part in 
                          ['node_modules', '.git', '__pycache__', '.pytest_cache', 
                           'venv', '.venv', 'build', 'dist']):
                        continue
                    
                    # Convert to relative path
                    try:
                        rel_path = str(file_path.relative_to(project_root))
                        source_files.append(rel_path)
                    except ValueError:
                        # File outside project root
                        continue
            except Exception as e:
                logger.debug(f"Error with pattern {pattern}: {e}")
                continue
        
        return sorted(list(set(source_files)))
    
    def _extract_tags_from_files(self, file_paths: List[str]) -> List[Tag]:
        """Extract tags from source files."""
        all_tags = []
        project_root = Path.cwd()
        
        for file_path in file_paths:
            try:
                abs_path = project_root / file_path
                if not abs_path.exists():
                    continue
                
                # Check cache first if available
                if self.cache_manager:
                    cached_tags = self.cache_manager.get_tags(str(abs_path))
                    if cached_tags:
                        all_tags.extend(cached_tags)
                        continue
                
                # Extract tags
                tags = self.tag_extractor.extract_tags_from_file(str(abs_path), str(project_root))
                all_tags.extend(tags)
                
                # Cache results if cache manager available
                if self.cache_manager:
                    language = self.tag_extractor.get_language_for_file(str(abs_path)) or "unknown"
                    self.cache_manager.set_tags(str(abs_path), tags, language)
                
            except Exception as e:
                logger.debug(f"Error extracting tags from {file_path}: {e}")
                continue
        
        return all_tags
    
    def _apply_pagerank(self, tags: List[Tag], chat_files: Set[str], 
                       mentioned_files: Set[str], mentioned_idents: Set[str]):
        """Apply PageRank algorithm to rank files and definitions."""
        try:
            # Convert tags to format expected by graph_ranker if needed
            if GRAPH_RANKER_AVAILABLE and tags:
                # Check if we need to convert tag format
                compatible_tags = []
                for tag in tags:
                    # Create compatible tag using graph_ranker's Tag class
                    if hasattr(graph_ranker_module, 'Tag'):
                        compatible_tag = graph_ranker_module.Tag(
                            rel_fname=tag.rel_fname,
                            fname=tag.fname, 
                            line=tag.line,
                            name=tag.name,
                            kind=tag.kind
                        )
                        compatible_tags.append(compatible_tag)
                    else:
                        compatible_tags.append(tag)
                
                file_rankings, definition_rankings = rank_files_from_tags(
                    tags=compatible_tags,
                    chat_files=chat_files,
                    mentioned_idents=mentioned_idents,
                    mentioned_files=mentioned_files,
                    limit=50,  # Limit for performance
                    verbose=False
                )
                
                logger.info(f"PageRank produced {len(file_rankings)} file rankings, "
                           f"{len(definition_rankings)} definition rankings")
                
                return file_rankings, definition_rankings
            else:
                raise Exception("PageRank not available or no tags")
            
        except Exception as e:
            logger.error(f"PageRank error: {e}")
            # Fallback to simple ranking
            all_files = {tag.rel_fname for tag in tags}
            return self._simple_file_ranking(list(all_files), chat_files, mentioned_files), []
    
    def _simple_file_ranking(self, files: List[str], chat_files: Set[str], 
                           mentioned_files: Set[str]) -> List[tuple]:
        """Simple file ranking fallback when PageRank unavailable."""
        file_scores = {}
        
        for file_path in files:
            score = 0.1  # Base score
            
            # Boost for chat files
            if file_path in chat_files:
                score += 10.0
            
            # Boost for mentioned files
            if file_path in mentioned_files:
                score += 5.0
            
            # Boost for common important files
            filename = Path(file_path).name.lower()
            if filename in ['main.py', 'app.py', 'index.js', 'server.py', '__init__.py']:
                score += 2.0
            
            # Slight boost for files in src/lib directories
            if 'src/' in file_path or 'lib/' in file_path:
                score += 0.5
            
            file_scores[file_path] = score
        
        # Sort by score descending
        ranked_files = sorted(file_scores.items(), key=lambda x: x[1], reverse=True)
        return ranked_files
    
    def _build_repo_map(self, file_rankings: List[tuple], 
                       definition_rankings: List[tuple], tags: List[Tag]) -> str:
        """Build the final repository map within token budget."""
        project_root = Path.cwd()
        map_sections = []
        token_count = 0
        
        # Reserve tokens for header and structure
        header = "Repository Structure and Code Map:\n\n"
        header_tokens = self.tokenizer.count_tokens(header).tokens
        available_tokens = self.map_tokens - header_tokens - 50  # Buffer
        
        map_sections.append(header)
        
        # Add important files section
        if file_rankings:
            files_section = "## Key Files (by importance):\n\n"
            files_tokens = self.tokenizer.count_tokens(files_section).tokens
            
            if token_count + files_tokens < available_tokens:
                map_sections.append(files_section)
                token_count += files_tokens
                
                # Add top files with content snippets
                files_added = 0
                for file_path, score in file_rankings[:10]:  # Top 10 files
                    if token_count >= available_tokens * 0.8:  # Reserve 20% for definitions
                        break
                    
                    file_content = self._get_file_summary(file_path, project_root)
                    if file_content:
                        file_section = f"### {file_path} (score: {score:.2f})\n{file_content}\n\n"
                        section_tokens = self.tokenizer.count_tokens(file_section).tokens
                        
                        if token_count + section_tokens < available_tokens * 0.8:
                            map_sections.append(file_section)
                            token_count += section_tokens
                            files_added += 1
                        else:
                            break
                
                logger.info(f"Added {files_added} files to repository map")
        
        # Add important definitions section
        if definition_rankings and token_count < available_tokens * 0.9:
            defs_section = "## Important Definitions:\n\n"
            defs_tokens = self.tokenizer.count_tokens(defs_section).tokens
            
            if token_count + defs_tokens < available_tokens:
                map_sections.append(defs_section)
                token_count += defs_tokens
                
                # Add top definitions
                defs_added = 0
                for (file_path, identifier), rank in definition_rankings[:20]:  # Top 20 definitions
                    if token_count >= available_tokens:
                        break
                    
                    def_line = f"- {identifier} in {file_path} (rank: {rank:.3f})\n"
                    def_tokens = self.tokenizer.count_tokens(def_line).tokens
                    
                    if token_count + def_tokens < available_tokens:
                        map_sections.append(def_line)
                        token_count += def_tokens
                        defs_added += 1
                    else:
                        break
                
                logger.info(f"Added {defs_added} definitions to repository map")
        
        # Add footer with stats
        footer = f"\n\n--- Generated {len(tags)} tags from {len(set(tag.rel_fname for tag in tags))} files ---\n"
        map_sections.append(footer)
        
        final_map = "".join(map_sections)
        final_tokens = self.tokenizer.count_tokens(final_map).tokens
        
        logger.info(f"Generated repository map: {final_tokens}/{self.map_tokens} tokens ({final_tokens/self.map_tokens:.1%})")
        
        return final_map
    
    def _get_file_summary(self, file_path: str, project_root: Path) -> str:
        """Get a summary of file content for the map."""
        try:
            abs_path = project_root / file_path
            if not abs_path.exists() or abs_path.stat().st_size > 50000:  # Skip very large files
                return ""
            
            with open(abs_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            if not lines:
                return ""
            
            # Get first few lines for context, focusing on important parts
            summary_lines = []
            
            # Add imports/requires
            for line in lines[:20]:
                stripped = line.strip()
                if any(stripped.startswith(kw) for kw in ['import ', 'from ', 'require(', 'const ', 'let ', 'var ']):
                    summary_lines.append(line.rstrip())
                elif stripped.startswith('class ') or stripped.startswith('def ') or stripped.startswith('function '):
                    summary_lines.append(line.rstrip())
                
                if len(summary_lines) >= 8:  # Limit lines
                    break
            
            if summary_lines:
                return "```\n" + "\n".join(summary_lines) + "\n```"
            
            return ""
            
        except Exception as e:
            logger.debug(f"Error getting file summary for {file_path}: {e}")
            return ""
    
    def _generate_fallback_map(self, chat_files: Set[str], mentioned_files: Set[str]) -> str:
        """Generate a basic fallback map when modules are unavailable."""
        fallback = ["Repository Map (Fallback Mode):\n\n"]
        
        if chat_files:
            fallback.append("Files in current chat context:\n")
            for file in sorted(chat_files):
                fallback.append(f"- {file}\n")
            fallback.append("\n")
        
        if mentioned_files:
            fallback.append("Recently mentioned files:\n")
            for file in sorted(mentioned_files):
                fallback.append(f"- {file}\n")
            fallback.append("\n")
        
        # Add basic file discovery
        try:
            source_files = self._discover_source_files()
            if source_files:
                fallback.append(f"Discovered {len(source_files)} source files in project.\n")
                fallback.append("Key files:\n")
                for file in sorted(source_files)[:10]:
                    fallback.append(f"- {file}\n")
        except Exception:
            fallback.append("File discovery unavailable in fallback mode.\n")
        
        fallback.append("\n--- Fallback mode: Install tree-sitter modules for enhanced mapping ---\n")
        
        return "".join(fallback)

def parse_input_parameters(input_data: Dict[str, Any]) -> tuple:
    """Parse input parameters from hook data."""
    prompt = input_data.get('prompt', '')
    
    # Extract mentioned files from context (simple heuristic)
    mentioned_files = set()
    mentioned_idents = set()
    
    # Look for file paths in prompt
    import re
    file_patterns = re.findall(r'[\w\-_/]+\.[a-zA-Z]+', prompt)
    for pattern in file_patterns:
        if any(ext in pattern for ext in ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp']):
            mentioned_files.add(pattern)
    
    # Look for identifiers (simple word extraction)
    words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', prompt)
    for word in words:
        if len(word) > 3 and word[0].islower():  # Simple heuristic for identifiers
            mentioned_idents.add(word)
    
    # Chat files would come from session context (placeholder)
    chat_files = set()
    
    # Check for map_tokens parameter
    map_tokens = input_data.get('map_tokens', 1024)
    
    return chat_files, mentioned_files, mentioned_idents, map_tokens

def main():
    """Main hook entry point."""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Parse parameters
        chat_files, mentioned_files, mentioned_idents, map_tokens = parse_input_parameters(input_data)
        
        logger.info(f"Hook parameters: map_tokens={map_tokens}, "
                   f"chat_files={len(chat_files)}, mentioned_files={len(mentioned_files)}, "
                   f"mentioned_idents={len(mentioned_idents)}")
        
        # Generate repository map
        generator = RepoMapGenerator(map_tokens=map_tokens)
        repo_map = generator.generate_repo_map(
            chat_files=chat_files,
            mentioned_files=mentioned_files,
            mentioned_idents=mentioned_idents
        )
        
        # Create hook output
        additional_context = f"""
For your project context, this is the current map of the codebase:

{repo_map}
"""
        
        output = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": additional_context
            }
        }
        
        print(json.dumps(output))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Hook execution error: {e}")
        # On error, provide a minimal fallback
        fallback_context = """
For your project context, this is the current map of the codebase:

Repository map generation encountered an error. Basic file discovery unavailable.
Please ensure tree-sitter dependencies are properly installed.
"""
        
        output = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": fallback_context
            }
        }
        
        print(json.dumps(output))
        sys.exit(0)  # Don't block on errors

if __name__ == '__main__':
    main()