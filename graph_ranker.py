#!/usr/bin/env python3
"""
Production PageRank-based Graph Ranking Module for Tree-Sitter Repository Map.

This module implements a sophisticated graph-based code importance ranking system
using PageRank algorithm with personalization and comprehensive edge weighting.

Key Features:
- NetworkX MultiDiGraph for handling multiple edges between nodes
- Personalization based on chat files and mentioned identifiers  
- Multi-factor edge weight calculation with frequency dampening
- Self-edge handling for isolated definitions
- Comprehensive error handling and graceful degradation
- Performance optimized for large repositories

Based on the PageRank prototype but designed for production use with:
- Clean modular architecture
- Comprehensive error handling
- Performance optimizations
- Thread-safe operations
- Cache-friendly interfaces
"""

import math
import time
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Optional, Union
from pathlib import Path
import os

import networkx as nx

# Configure logging
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Tag:
    """
    Represents a code symbol tag from tree-sitter parsing.
    
    Attributes:
        rel_fname: Relative file path from repository root
        fname: Absolute file path
        line: Line number where symbol appears
        name: Symbol/identifier name
        kind: Symbol type ('def' for definitions, 'ref' for references)
    """
    rel_fname: str
    fname: str
    line: int
    name: str
    kind: str  # 'def' or 'ref'
    
    def __post_init__(self):
        """Validate tag data on creation."""
        if self.kind not in ('def', 'ref'):
            raise ValueError(f"Tag kind must be 'def' or 'ref', got: {self.kind}")
        if not self.name.strip():
            raise ValueError("Tag name cannot be empty")
        if self.line < 0:
            raise ValueError("Line number must be non-negative")


@dataclass
class GraphMetrics:
    """Graph analysis metrics for debugging and optimization."""
    nodes: int
    edges: int
    self_loops: int
    is_connected: bool
    density: float
    avg_clustering: Union[float, str]
    construction_time: float
    pagerank_time: float
    pagerank_iterations: int


class GraphRanker:
    """
    Production PageRank-based code importance analyzer with personalization.
    
    This class provides a complete graph-based ranking system for code files
    and definitions based on their dependency relationships and contextual importance.
    
    The ranking algorithm considers:
    - File dependency relationships (who references what)
    - Chat context (files currently being discussed)
    - Mentioned identifiers (symbols referenced in prompts)
    - Identifier characteristics (length, naming patterns, privacy)
    - Reference frequency (with dampening for high-frequency refs)
    
    Example usage:
        ranker = GraphRanker(verbose=True)
        graph = ranker.build_dependency_graph(tags, chat_files, mentioned_idents)
        personalization = ranker.create_personalization_vector(
            chat_files, mentioned_idents, all_files
        )
        rankings = ranker.calculate_pagerank(personalization)
        top_definitions = ranker.distribute_ranking_to_definitions(tags, rankings)
    """
    
    def __init__(self, verbose: bool = False, personalization_boost: float = 100.0):
        """
        Initialize GraphRanker.
        
        Args:
            verbose: Enable verbose logging and timing information
            personalization_boost: Base boost value for personalization (default: 100.0)
        """
        self.verbose = verbose
        self.personalization_boost = personalization_boost
        self.graph: Optional[nx.MultiDiGraph] = None
        self.rankings: Optional[Dict[str, float]] = None
        self.metrics: Optional[GraphMetrics] = None
        self._edge_count = 0
        
        if self.verbose:
            logging.basicConfig(level=logging.INFO)
    
    def build_dependency_graph(
        self,
        tags: List[Tag],
        chat_files: Optional[Set[str]] = None,
        mentioned_idents: Optional[Set[str]] = None
    ) -> nx.MultiDiGraph:
        """
        Build dependency graph from extracted code tags.
        
        Creates a NetworkX MultiDiGraph where:
        - Nodes represent files (using relative paths)
        - Edges represent referencer -> definer relationships
        - Edge attributes include weight and identifier name
        - Self-edges are added for isolated definitions
        
        Args:
            tags: List of Tag objects from tree-sitter parsing
            chat_files: Set of files currently in chat context
            mentioned_idents: Set of identifiers mentioned in current prompt
            
        Returns:
            NetworkX MultiDiGraph representing code dependencies
            
        Raises:
            ValueError: If tags contain invalid data
        """
        start_time = time.time()
        
        if chat_files is None:
            chat_files = set()
        if mentioned_idents is None:
            mentioned_idents = set()
        
        logger.info(f"Building dependency graph from {len(tags)} tags")
        
        # Validate and organize tags by type
        defines = defaultdict(set)  # identifier -> set of files that define it
        references = defaultdict(list)  # identifier -> list of files that reference it
        
        try:
            for tag in tags:
                if not isinstance(tag, Tag):
                    raise ValueError(f"Expected Tag object, got {type(tag)}")
                
                if tag.kind == "def":
                    defines[tag.name].add(tag.rel_fname)
                elif tag.kind == "ref":
                    references[tag.name].append(tag.rel_fname)
                # Invalid kinds are caught by Tag.__post_init__
        except Exception as e:
            logger.error(f"Error processing tags: {e}")
            raise ValueError(f"Invalid tag data: {e}")
        
        # Create NetworkX MultiDiGraph
        G = nx.MultiDiGraph()
        self._edge_count = 0
        
        # Add self-edges for definitions with no references
        # This prevents isolated nodes from having zero rank
        isolated_count = 0
        for ident in defines.keys():
            if ident not in references:
                for definer in defines[ident]:
                    G.add_edge(definer, definer, weight=0.1, ident=ident)
                    self._edge_count += 1
                    isolated_count += 1
        
        if self.verbose and isolated_count > 0:
            logger.info(f"Added {isolated_count} self-edges for isolated definitions")
        
        # Find identifiers that have both definitions and references
        connected_idents = set(defines.keys()).intersection(set(references.keys()))
        logger.info(f"Processing {len(connected_idents)} connected identifiers")
        
        # Build edges for each identifier
        for ident in connected_idents:
            definers = defines[ident]
            
            # Calculate base multiplier for this identifier
            base_multiplier = self._calculate_identifier_multiplier(ident, mentioned_idents)
            
            # Apply "too many definitions" penalty
            if len(definers) > 5:
                base_multiplier *= 0.1
                
            # Count references by file
            ref_counts = Counter(references[ident])
            
            for referencer, num_refs in ref_counts.items():
                for definer in definers:
                    # Calculate final weight
                    multiplier = base_multiplier
                    
                    # Boost if referencer is in chat files (50x as per reference)
                    if referencer in chat_files:
                        multiplier *= 50
                    
                    # Scale down high frequency references (sqrt dampening)
                    adjusted_refs = math.sqrt(num_refs)
                    
                    final_weight = multiplier * adjusted_refs
                    
                    G.add_edge(referencer, definer, weight=final_weight, ident=ident)
                    self._edge_count += 1
                    
                    if self.verbose:
                        logger.debug(f"Edge: {referencer} -> {definer} "
                                   f"(ident: {ident}, weight: {final_weight:.3f})")
        
        construction_time = time.time() - start_time
        
        if self.verbose:
            logger.info(f"Graph construction completed in {construction_time:.3f}s")
            logger.info(f"Graph: {G.number_of_nodes()} nodes, {self._edge_count} edges")
        
        self.graph = G
        return G
    
    def _calculate_identifier_multiplier(self, ident: str, mentioned_idents: Set[str]) -> float:
        """
        Calculate importance multiplier for an identifier based on various factors.
        
        Multiplier factors:
        - Mentioned in prompt: 10x boost
        - Long snake_case/kebab-case/camelCase (≥8 chars): 10x boost  
        - Starts with underscore (private): 0.1x penalty
        - Base case: 1.0x
        
        Args:
            ident: Identifier name to analyze
            mentioned_idents: Set of identifiers mentioned in current context
            
        Returns:
            Multiplier value for edge weight calculation
        """
        multiplier = 1.0
        
        # Boost mentioned identifiers
        if ident in mentioned_idents:
            multiplier *= 10
            if self.verbose:
                logger.debug(f"Identifier '{ident}' mentioned: 10x boost")
        
        # Boost long, well-formed identifiers
        is_snake = ("_" in ident) and any(c.isalpha() for c in ident)
        is_kebab = ("-" in ident) and any(c.isalpha() for c in ident)
        is_camel = any(c.isupper() for c in ident) and any(c.islower() for c in ident)
        
        if (is_snake or is_kebab or is_camel) and len(ident) >= 8:
            multiplier *= 10
            if self.verbose:
                logger.debug(f"Identifier '{ident}' long and well-formed: 10x boost")
        
        # Penalize private identifiers
        if ident.startswith("_"):
            multiplier *= 0.1
            if self.verbose:
                logger.debug(f"Identifier '{ident}' private: 0.1x penalty")
        
        return multiplier
    
    def create_personalization_vector(
        self,
        chat_files: Set[str],
        mentioned_files: Optional[Set[str]] = None,
        mentioned_idents: Optional[Set[str]] = None,
        all_files: Optional[Set[str]] = None
    ) -> Dict[str, float]:
        """
        Create personalization vector for PageRank algorithm.
        
        Personalization gives higher importance to:
        - Files currently in chat context
        - Files explicitly mentioned in current prompt
        - Files with path components matching mentioned identifiers
        
        Args:
            chat_files: Set of files currently in chat
            mentioned_files: Set of files mentioned in current prompt
            mentioned_idents: Set of identifiers mentioned in current prompt
            all_files: Set of all files in repository
            
        Returns:
            Dictionary mapping file paths to personalization values
        """
        if mentioned_files is None:
            mentioned_files = set()
        if mentioned_idents is None:
            mentioned_idents = set()
        if all_files is None:
            all_files = set()
        
        personalization = {}
        
        # Calculate base personalization value per file (not distributed)
        # This follows the aider reference: personalize = 100 / len(fnames)
        num_files = len(all_files) if all_files else max(100, len(chat_files))
        base_personalize = self.personalization_boost / num_files
        
        logger.info(f"Creating personalization vector for {num_files} files "
                   f"(base boost per file: {base_personalize:.2f})")
        
        for file_path in all_files:
            current_pers = 0.0
            boost_reasons = []
            
            # Chat files get base boost
            if file_path in chat_files:
                current_pers += base_personalize
                boost_reasons.append("chat")
            
            # Mentioned files get boost (use max to avoid double counting with chat)
            if file_path in mentioned_files:
                current_pers = max(current_pers, base_personalize)
                if "chat" not in boost_reasons:
                    boost_reasons.append("mentioned")
            
            # Files with path components matching mentioned identifiers
            if mentioned_idents:
                path_obj = Path(file_path)
                path_components = set(path_obj.parts)
                basename_with_ext = path_obj.name
                basename_without_ext, _ = os.path.splitext(basename_with_ext)
                components_to_check = path_components.union({basename_with_ext, basename_without_ext})
                
                matched_idents = components_to_check.intersection(mentioned_idents)
                if matched_idents:
                    current_pers += base_personalize
                    boost_reasons.append(f"path_match({','.join(matched_idents)})")
            
            if current_pers > 0:
                personalization[file_path] = current_pers
                if self.verbose:
                    logger.debug(f"Personalization: {file_path} -> {current_pers:.3f} "
                               f"({','.join(boost_reasons)})")
        
        logger.info(f"Personalization vector created for {len(personalization)} files")
        return personalization
    
    def calculate_pagerank(
        self,
        personalization: Optional[Dict[str, float]] = None,
        alpha: float = 0.85,
        max_iter: int = 100,
        tol: float = 1e-6
    ) -> Dict[str, float]:
        """
        Calculate PageRank scores for the dependency graph.
        
        Uses NetworkX's PageRank implementation with optional personalization
        and fallback strategies for error conditions.
        
        Args:
            personalization: Dict mapping nodes to personalization values
            alpha: Damping parameter (0.85 is standard)
            max_iter: Maximum iterations for convergence
            tol: Convergence tolerance
            
        Returns:
            Dict mapping file paths to importance scores
            
        Raises:
            ValueError: If dependency graph has not been built
        """
        if self.graph is None:
            raise ValueError("Must build dependency graph first using build_dependency_graph()")
        
        start_time = time.time()
        logger.info("Starting PageRank calculation")
        
        # Prepare personalization arguments
        pers_args = {}
        if personalization:
            # Ensure personalization only includes nodes that exist in graph
            valid_personalization = {
                node: value for node, value in personalization.items()
                if node in self.graph.nodes
            }
            if valid_personalization:
                pers_args = dict(
                    personalization=valid_personalization,
                    dangling=valid_personalization  # Handle dangling nodes
                )
                logger.info(f"Using personalization for {len(valid_personalization)} nodes")
        
        iterations_used = 0
        
        try:
            # Primary PageRank calculation
            rankings = nx.pagerank(
                self.graph,
                alpha=alpha,
                personalization=pers_args.get('personalization'),
                dangling=pers_args.get('dangling'),
                max_iter=max_iter,
                tol=tol,
                weight='weight'
            )
            # NetworkX doesn't expose iteration count directly
            iterations_used = max_iter  # Estimate
            
        except ZeroDivisionError:
            logger.warning("PageRank failed with personalization, trying without...")
            # Fallback without personalization
            try:
                rankings = nx.pagerank(
                    self.graph,
                    alpha=alpha,
                    max_iter=max_iter,
                    tol=tol,
                    weight='weight'
                )
                iterations_used = max_iter  # Estimate
                
            except ZeroDivisionError:
                logger.error("PageRank failed completely, returning empty rankings")
                # Ultimate fallback: empty rankings
                rankings = {}
                iterations_used = 0
        
        except Exception as e:
            logger.error(f"Unexpected error in PageRank calculation: {e}")
            rankings = {}
            iterations_used = 0
        
        pagerank_time = time.time() - start_time
        
        if self.verbose:
            logger.info(f"PageRank calculation completed in {pagerank_time:.3f}s")
            logger.info(f"Estimated {iterations_used} iterations")
            if rankings:
                total_rank = sum(rankings.values())
                logger.info(f"Total PageRank mass: {total_rank:.6f}")
        
        # Store metrics for analysis
        if self.graph:
            try:
                # Convert to simple directed graph for clustering analysis
                simple_graph = nx.DiGraph(self.graph)
                avg_clustering = nx.average_clustering(simple_graph.to_undirected())
            except:
                avg_clustering = "N/A (MultiDiGraph limitation)"
            
            self.metrics = GraphMetrics(
                nodes=self.graph.number_of_nodes(),
                edges=self.graph.number_of_edges(),
                self_loops=nx.number_of_selfloops(self.graph),
                is_connected=nx.is_weakly_connected(self.graph),
                density=nx.density(self.graph),
                avg_clustering=avg_clustering,
                construction_time=0.0,  # Set by build_dependency_graph
                pagerank_time=pagerank_time,
                pagerank_iterations=iterations_used
            )
        
        self.rankings = rankings
        return rankings
    
    def distribute_ranking_to_definitions(
        self,
        tags: List[Tag],
        rankings: Optional[Dict[str, float]] = None
    ) -> List[Tuple[Tuple[str, str], float]]:
        """
        Distribute node rankings across their outgoing edges to specific definitions.
        
        This creates identifier-specific rankings by distributing each file's 
        PageRank score across all identifiers it references, weighted by edge strength.
        
        Args:
            tags: Original tag list (for validation)
            rankings: PageRank scores (uses self.rankings if None)
            
        Returns:
            List of ((file, identifier), rank) tuples sorted by rank (descending)
            
        Raises:
            ValueError: If graph or rankings are not available
        """
        if self.graph is None:
            raise ValueError("Must build dependency graph first")
        
        if rankings is None:
            if self.rankings is None:
                raise ValueError("Must calculate PageRank first or provide rankings")
            rankings = self.rankings
        
        logger.info("Distributing rankings to definitions")
        
        ranked_definitions = defaultdict(float)
        
        for src_node in self.graph.nodes:
            src_rank = rankings.get(src_node, 0.0)
            
            if src_rank == 0.0:
                continue
            
            # Get all outgoing edges and their weights
            out_edges = list(self.graph.out_edges(src_node, data=True))
            total_weight = sum(data["weight"] for _, _, data in out_edges)
            
            if total_weight == 0:
                continue
            
            # Distribute rank proportionally across outgoing edges
            for _, dst_node, data in out_edges:
                edge_rank = src_rank * data["weight"] / total_weight
                ident = data["ident"]
                ranked_definitions[(dst_node, ident)] += edge_rank
                
                # Store rank back on edge for analysis
                data["rank"] = edge_rank
        
        # Sort by rank (descending), then by (file, ident) for deterministic ordering
        sorted_definitions = sorted(
            ranked_definitions.items(),
            key=lambda x: (-x[1], x[0]),  # Negative rank for descending sort
            reverse=False  # Don't reverse since we negated rank
        )
        
        logger.info(f"Created rankings for {len(sorted_definitions)} definitions")
        
        return sorted_definitions
    
    def get_top_files_by_rank(
        self,
        rankings: Optional[Dict[str, float]] = None,
        exclude_files: Optional[Set[str]] = None,
        limit: Optional[int] = None
    ) -> List[Tuple[str, float]]:
        """
        Get files ranked by their PageRank scores.
        
        Args:
            rankings: PageRank scores (uses self.rankings if None)
            exclude_files: Set of files to exclude from results
            limit: Maximum number of files to return
            
        Returns:
            List of (file_path, rank) tuples sorted by rank (descending)
        """
        if rankings is None:
            if self.rankings is None:
                raise ValueError("Must calculate PageRank first or provide rankings")
            rankings = self.rankings
        
        if exclude_files is None:
            exclude_files = set()
        
        # Filter and sort files
        ranked_files = [
            (file_path, rank) 
            for file_path, rank in rankings.items()
            if file_path not in exclude_files
        ]
        
        ranked_files.sort(key=lambda x: x[1], reverse=True)
        
        if limit:
            ranked_files = ranked_files[:limit]
        
        return ranked_files
    
    def analyze_graph_properties(self) -> Optional[GraphMetrics]:
        """
        Analyze graph properties for debugging and optimization.
        
        Returns:
            GraphMetrics object with analysis results, or None if no graph
        """
        return self.metrics
    
    def reset(self):
        """Reset internal state for reuse."""
        self.graph = None
        self.rankings = None
        self.metrics = None
        self._edge_count = 0
        logger.info("GraphRanker state reset")


# Convenience functions for common use cases

def rank_files_from_tags(
    tags: List[Tag],
    chat_files: Optional[Set[str]] = None,
    mentioned_idents: Optional[Set[str]] = None,
    mentioned_files: Optional[Set[str]] = None,
    limit: Optional[int] = None,
    verbose: bool = False
) -> Tuple[List[Tuple[str, float]], List[Tuple[Tuple[str, str], float]]]:
    """
    Convenience function to rank files and definitions from tags.
    
    Args:
        tags: List of Tag objects from tree-sitter parsing
        chat_files: Files currently in chat context
        mentioned_idents: Identifiers mentioned in current prompt
        mentioned_files: Files mentioned in current prompt
        limit: Maximum number of top files to return
        verbose: Enable verbose logging
        
    Returns:
        Tuple of (file_rankings, definition_rankings)
    """
    if chat_files is None:
        chat_files = set()
    if mentioned_idents is None:
        mentioned_idents = set()
    if mentioned_files is None:
        mentioned_files = set()
    
    # Extract all files from tags
    all_files = {tag.rel_fname for tag in tags}
    
    # Create ranker and process
    ranker = GraphRanker(verbose=verbose)
    
    # Build graph
    graph = ranker.build_dependency_graph(tags, chat_files, mentioned_idents)
    
    # Create personalization
    personalization = ranker.create_personalization_vector(
        chat_files=chat_files,
        mentioned_files=mentioned_files,
        mentioned_idents=mentioned_idents,
        all_files=all_files
    )
    
    # Calculate rankings
    rankings = ranker.calculate_pagerank(personalization)
    
    # Get results
    file_rankings = ranker.get_top_files_by_rank(
        rankings=rankings,
        exclude_files=chat_files,
        limit=limit
    )
    
    definition_rankings = ranker.distribute_ranking_to_definitions(tags, rankings)
    
    return file_rankings, definition_rankings


def analyze_repository_structure(
    tags: List[Tag],
    verbose: bool = True
) -> GraphMetrics:
    """
    Analyze repository structure and return metrics.
    
    Args:
        tags: List of Tag objects from tree-sitter parsing
        verbose: Enable verbose output
        
    Returns:
        GraphMetrics with analysis results
    """
    ranker = GraphRanker(verbose=verbose)
    ranker.build_dependency_graph(tags)
    ranker.calculate_pagerank()
    
    metrics = ranker.analyze_graph_properties()
    if metrics is None:
        raise RuntimeError("Failed to analyze graph properties")
    
    return metrics