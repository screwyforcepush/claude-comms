#!/usr/bin/env python3
"""
PageRank Algorithm Prototype for Code Importance Ranking
WP-1.3 Implementation

Based on analysis from aider-treesitter-reference-impl/repomap.py
Implements personalization for chat files and comprehensive edge weighting.
"""

import math
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Optional

import networkx as nx


@dataclass
class Tag:
    """Represents a code symbol tag from tree-sitter parsing."""
    rel_fname: str
    fname: str
    line: int
    name: str
    kind: str  # 'def' or 'ref'


class PageRankCodeAnalyzer:
    """
    PageRank-based code importance analyzer with personalization.
    
    Key features:
    - NetworkX MultiDiGraph for handling multiple edges between nodes
    - Personalization based on chat files and mentioned identifiers
    - Edge weight calculation with frequency and context awareness
    - Support for self-edges for isolated definitions
    """
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.graph = None
        self.rankings = None
        self.edge_count = 0
        self.personalization_boost = 100  # Base personalization value
        
    def build_dependency_graph(
        self,
        tags: List[Tag],
        chat_files: Set[str] = None,
        mentioned_idents: Set[str] = None
    ) -> nx.MultiDiGraph:
        """
        Build dependency graph from extracted tags.
        
        Graph structure:
        - Nodes: file paths (relative)
        - Edges: referencer -> definer relationships
        - Edge attributes: weight, ident (identifier name)
        """
        if chat_files is None:
            chat_files = set()
        if mentioned_idents is None:
            mentioned_idents = set()
            
        # Organize tags by type
        defines = defaultdict(set)  # identifier -> set of files that define it
        references = defaultdict(list)  # identifier -> list of files that reference it
        
        for tag in tags:
            if tag.kind == "def":
                defines[tag.name].add(tag.rel_fname)
            elif tag.kind == "ref":
                references[tag.name].append(tag.rel_fname)
        
        # Create NetworkX MultiDiGraph
        G = nx.MultiDiGraph()
        
        # Add self-edges for definitions with no references
        # This prevents isolated nodes from having zero rank
        for ident in defines.keys():
            if ident not in references:
                for definer in defines[ident]:
                    G.add_edge(definer, definer, weight=0.1, ident=ident)
                    self.edge_count += 1
        
        # Find identifiers that have both definitions and references
        idents = set(defines.keys()).intersection(set(references.keys()))
        
        # Build edges for each identifier
        for ident in idents:
            definers = defines[ident]
            
            # Calculate base multiplier for this identifier
            mul = self._calculate_identifier_multiplier(ident, mentioned_idents)
            
            # Count references by file
            ref_counts = Counter(references[ident])
            
            for referencer, num_refs in ref_counts.items():
                for definer in definers:
                    # Calculate final weight
                    use_mul = mul
                    
                    # Boost if referencer is in chat files (50x as per reference)
                    if referencer in chat_files:
                        use_mul *= 50
                    
                    # Scale down high frequency references (sqrt dampening)
                    adjusted_refs = math.sqrt(num_refs)
                    
                    final_weight = use_mul * adjusted_refs
                    
                    G.add_edge(referencer, definer, weight=final_weight, ident=ident)
                    self.edge_count += 1
                    
                    if self.verbose:
                        print(f"Edge: {referencer} -> {definer} (ident: {ident}, weight: {final_weight:.2f})")
        
        self.graph = G
        return G
    
    def _calculate_identifier_multiplier(self, ident: str, mentioned_idents: Set[str]) -> float:
        """
        Calculate importance multiplier for an identifier based on various factors.
        
        Factors (from reference implementation):
        - Mentioned in prompt: 10x boost
        - Long snake_case/kebab-case/camelCase: 10x boost  
        - Starts with underscore (private): 0.1x penalty
        - Defined in many files (>5): 0.1x penalty
        """
        mul = 1.0
        
        # Boost mentioned identifiers
        if ident in mentioned_idents:
            mul *= 10
        
        # Boost long, well-formed identifiers
        is_snake = ("_" in ident) and any(c.isalpha() for c in ident)
        is_kebab = ("-" in ident) and any(c.isalpha() for c in ident)
        is_camel = any(c.isupper() for c in ident) and any(c.islower() for c in ident)
        
        if (is_snake or is_kebab or is_camel) and len(ident) >= 8:
            mul *= 10
        
        # Penalize private identifiers
        if ident.startswith("_"):
            mul *= 0.1
        
        # Note: "too many definitions" penalty would require access to defines dict
        # This is handled in the calling context
        
        return mul
    
    def create_personalization_vector(
        self,
        chat_files: Set[str],
        mentioned_files: Set[str] = None,
        mentioned_idents: Set[str] = None,
        all_files: Set[str] = None
    ) -> Dict[str, float]:
        """
        Create personalization vector for PageRank.
        
        Personalization gives higher importance to:
        - Files currently in chat
        - Files mentioned in the current prompt
        - Files with path components matching mentioned identifiers
        """
        if mentioned_files is None:
            mentioned_files = set()
        if mentioned_idents is None:
            mentioned_idents = set()
        if all_files is None:
            all_files = set()
            
        personalization = {}
        
        # Base personalization value (distributed among all files)
        num_files = len(all_files) if all_files else 100  # fallback
        base_personalize = self.personalization_boost / num_files
        
        for file_path in all_files:
            current_pers = 0.0
            
            # Chat files get base boost
            if file_path in chat_files:
                current_pers += base_personalize
            
            # Mentioned files get boost (use max to avoid double counting)
            if file_path in mentioned_files:
                current_pers = max(current_pers, base_personalize)
            
            # Files with path components matching mentioned identifiers
            from pathlib import Path
            import os
            
            path_obj = Path(file_path)
            path_components = set(path_obj.parts)
            basename_with_ext = path_obj.name
            basename_without_ext, _ = os.path.splitext(basename_with_ext)
            components_to_check = path_components.union({basename_with_ext, basename_without_ext})
            
            matched_idents = components_to_check.intersection(mentioned_idents)
            if matched_idents:
                current_pers += base_personalize
            
            if current_pers > 0:
                personalization[file_path] = current_pers
        
        return personalization
    
    def calculate_pagerank(
        self,
        personalization: Dict[str, float] = None,
        alpha: float = 0.85,
        max_iter: int = 100,
        tol: float = 1e-6
    ) -> Dict[str, float]:
        """
        Calculate PageRank scores for the dependency graph.
        
        Args:
            personalization: Dict mapping nodes to personalization values
            alpha: Damping parameter (0.85 is standard)
            max_iter: Maximum iterations for convergence
            tol: Convergence tolerance
            
        Returns:
            Dict mapping file paths to importance scores
        """
        if self.graph is None:
            raise ValueError("Must build dependency graph first")
        
        # Prepare personalization arguments
        pers_args = {}
        if personalization:
            pers_args = dict(
                personalization=personalization,
                dangling=personalization  # Handle dangling nodes
            )
        
        start_time = time.time()
        
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
        except ZeroDivisionError:
            # Fallback without personalization (from reference implementation)
            try:
                rankings = nx.pagerank(
                    self.graph,
                    alpha=alpha,
                    max_iter=max_iter,
                    tol=tol,
                    weight='weight'
                )
            except ZeroDivisionError:
                # Ultimate fallback: empty rankings
                rankings = {}
        
        end_time = time.time()
        
        if self.verbose:
            print(f"PageRank calculation took {end_time - start_time:.3f} seconds")
            print(f"Graph has {self.graph.number_of_nodes()} nodes and {self.edge_count} edges")
        
        self.rankings = rankings
        return rankings
    
    def distribute_ranking_to_definitions(
        self,
        tags: List[Tag],
        rankings: Dict[str, float]
    ) -> List[Tuple[Tuple[str, str], float]]:
        """
        Distribute node rankings across their outgoing edges to specific definitions.
        
        This creates identifier-specific rankings by distributing each file's 
        PageRank score across all identifiers it references, weighted by edge strength.
        
        Returns:
            List of ((file, identifier), rank) tuples sorted by rank
        """
        ranked_definitions = defaultdict(float)
        
        for src_node in self.graph.nodes:
            src_rank = rankings.get(src_node, 0.0)
            
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
        
        # Sort by rank (descending)
        return sorted(
            ranked_definitions.items(),
            key=lambda x: (x[1], x[0]),  # Sort by rank, then by (file, ident)
            reverse=True
        )
    
    def get_top_files_by_rank(
        self,
        rankings: Dict[str, float],
        exclude_files: Set[str] = None,
        limit: int = None
    ) -> List[Tuple[str, float]]:
        """Get files ranked by their PageRank scores."""
        if exclude_files is None:
            exclude_files = set()
            
        ranked_files = [
            (file_path, rank) 
            for file_path, rank in rankings.items()
            if file_path not in exclude_files
        ]
        
        ranked_files.sort(key=lambda x: x[1], reverse=True)
        
        if limit:
            ranked_files = ranked_files[:limit]
            
        return ranked_files
    
    def analyze_graph_properties(self) -> Dict:
        """Analyze graph properties for debugging and optimization."""
        if self.graph is None:
            return {}
        
        # Note: Some metrics don't work with MultiDiGraph, so we convert carefully
        try:
            # Convert to simple directed graph for clustering analysis
            simple_graph = nx.DiGraph(self.graph)
            avg_clustering = nx.average_clustering(simple_graph.to_undirected())
        except:
            avg_clustering = "N/A (MultiDiGraph limitation)"
        
        return {
            "nodes": self.graph.number_of_nodes(),
            "edges": self.graph.number_of_edges(),
            "self_loops": nx.number_of_selfloops(self.graph),
            "is_connected": nx.is_weakly_connected(self.graph),
            "density": nx.density(self.graph),
            "avg_clustering": avg_clustering,
        }


def create_sample_tags() -> List[Tag]:
    """Create sample tags for testing the PageRank algorithm."""
    return [
        # main.py defines main and calls helper functions
        Tag("main.py", "/abs/main.py", 1, "main", "def"),
        Tag("main.py", "/abs/main.py", 5, "process_data", "ref"),
        Tag("main.py", "/abs/main.py", 8, "save_results", "ref"),
        
        # utils.py defines helper functions
        Tag("utils.py", "/abs/utils.py", 10, "process_data", "def"),
        Tag("utils.py", "/abs/utils.py", 20, "save_results", "def"),
        Tag("utils.py", "/abs/utils.py", 25, "log_message", "ref"),
        
        # logger.py defines logging
        Tag("logger.py", "/abs/logger.py", 5, "log_message", "def"),
        
        # config.py defines configuration
        Tag("config.py", "/abs/config.py", 1, "DATABASE_URL", "def"),
        Tag("main.py", "/abs/main.py", 2, "DATABASE_URL", "ref"),
        Tag("utils.py", "/abs/utils.py", 15, "DATABASE_URL", "ref"),
    ]


def run_pagerank_prototype():
    """Run the PageRank prototype with sample data."""
    print("=== PageRank Algorithm Prototype ===")
    print()
    
    # Create analyzer
    analyzer = PageRankCodeAnalyzer(verbose=True)
    
    # Create sample data
    tags = create_sample_tags()
    chat_files = {"main.py"}  # main.py is in current chat
    mentioned_idents = {"process_data"}  # mentioned in current prompt
    all_files = {"main.py", "utils.py", "logger.py", "config.py"}
    
    print("Sample Tags:")
    for tag in tags:
        print(f"  {tag.rel_fname}:{tag.line} - {tag.name} ({tag.kind})")
    print()
    
    # Build dependency graph
    print("Building dependency graph...")
    graph = analyzer.build_dependency_graph(tags, chat_files, mentioned_idents)
    
    # Analyze graph properties
    props = analyzer.analyze_graph_properties()
    print(f"Graph Properties: {props}")
    print()
    
    # Create personalization vector
    print("Creating personalization vector...")
    personalization = analyzer.create_personalization_vector(
        chat_files=chat_files,
        mentioned_idents=mentioned_idents,
        all_files=all_files
    )
    print(f"Personalization: {personalization}")
    print()
    
    # Calculate PageRank
    print("Calculating PageRank...")
    rankings = analyzer.calculate_pagerank(personalization)
    
    print("File Rankings:")
    for file_path, rank in sorted(rankings.items(), key=lambda x: x[1], reverse=True):
        boost = " (CHAT FILE)" if file_path in chat_files else ""
        print(f"  {file_path}: {rank:.6f}{boost}")
    print()
    
    # Distribute rankings to definitions
    print("Distributing rankings to definitions...")
    definition_rankings = analyzer.distribute_ranking_to_definitions(tags, rankings)
    
    print("Top Definitions by Rank:")
    for (file_path, ident), rank in definition_rankings[:10]:
        print(f"  {file_path}:{ident} = {rank:.6f}")
    print()
    
    # Get top files (excluding chat files)
    top_files = analyzer.get_top_files_by_rank(rankings, exclude_files=chat_files, limit=5)
    print("Top Files (excluding chat files):")
    for file_path, rank in top_files:
        print(f"  {file_path}: {rank:.6f}")
    print()
    
    print("=== Prototype Complete ===")


if __name__ == "__main__":
    run_pagerank_prototype()