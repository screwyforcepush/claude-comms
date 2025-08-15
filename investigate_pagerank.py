#!/usr/bin/env python3
"""
Investigate how PageRank personalization actually works.
This is a fundamental algorithmic issue that needs to be understood.
"""

import networkx as nx
from graph_ranker import Tag, GraphRanker

def test_pagerank_behavior():
    """Test basic PageRank behavior to understand personalization."""
    
    print("=== Understanding PageRank Personalization ===")
    
    # Create a simple test graph
    G = nx.DiGraph()
    
    # Simple case: A -> B, A -> C, B -> A
    # A has 2 outgoing, B has 1 outgoing, C has 0 outgoing
    # Without personalization, C should get the highest rank (sink)
    # With personalization on A, A should get boosted
    
    G.add_edge("A", "B", weight=1)
    G.add_edge("A", "C", weight=1) 
    G.add_edge("B", "A", weight=1)
    
    print("Graph structure:")
    print("  A -> B (weight=1)")
    print("  A -> C (weight=1)")
    print("  B -> A (weight=1)")
    print("  C has no outgoing edges (sink)")
    
    # Test 1: No personalization
    print("\n--- Test 1: No Personalization ---")
    rankings1 = nx.pagerank(G, weight="weight")
    for node, rank in sorted(rankings1.items(), key=lambda x: x[1], reverse=True):
        print(f"  {node}: {rank:.6f}")
    
    # Test 2: Personalize A 
    print("\n--- Test 2: Personalize A (value=1.0) ---")
    personalization2 = {"A": 1.0}
    rankings2 = nx.pagerank(G, weight="weight", personalization=personalization2, dangling=personalization2)
    for node, rank in sorted(rankings2.items(), key=lambda x: x[1], reverse=True):
        print(f"  {node}: {rank:.6f}")
    
    # Test 3: Strong personalization of A
    print("\n--- Test 3: Strong Personalization A (value=10.0) ---")
    personalization3 = {"A": 10.0}
    rankings3 = nx.pagerank(G, weight="weight", personalization=personalization3, dangling=personalization3)
    for node, rank in sorted(rankings3.items(), key=lambda x: x[1], reverse=True):
        print(f"  {node}: {rank:.6f}")
    
    # Test 4: Check actual aider pattern - smaller personalization
    print("\n--- Test 4: Aider-style Personalization (value=0.33) ---")
    personalization4 = {"A": 1.0/3}  # 100/num_files style
    rankings4 = nx.pagerank(G, weight="weight", personalization=personalization4, dangling=personalization4)
    for node, rank in sorted(rankings4.items(), key=lambda x: x[1], reverse=True):
        print(f"  {node}: {rank:.6f}")
    
    print("\n=== Analysis ===")
    print("PageRank personalization affects the 'restart probability'.")
    print("Higher personalization = more likely to restart at that node.")
    print("But if that node has many outgoing edges, it still distributes rank.")
    print("The algorithm balances: restart probability vs. edge structure.")


def test_our_graph_structure():
    """Test our specific graph structure issue."""
    
    print("\n\n=== Testing Our Specific Graph ===")
    
    # Recreate our problematic scenario but simplified
    tags = [
        # main.py - many outgoing edges
        Tag("main.py", "/abs/main.py", 1, "main", "def"),
        Tag("main.py", "/abs/main.py", 5, "func_a", "ref"),
        Tag("main.py", "/abs/main.py", 6, "func_b", "ref"),
        Tag("main.py", "/abs/main.py", 7, "func_c", "ref"),
        
        # file_a.py - few edges
        Tag("file_a.py", "/abs/file_a.py", 1, "func_a", "def"),
        
        # file_b.py - few edges
        Tag("file_b.py", "/abs/file_b.py", 1, "func_b", "def"),
        
        # file_c.py - sink (no outgoing edges)
        Tag("file_c.py", "/abs/file_c.py", 1, "func_c", "def"),
    ]
    
    chat_files = {"main.py"}
    mentioned_idents = set()
    
    ranker = GraphRanker(verbose=False)
    graph = ranker.build_dependency_graph(tags, chat_files, mentioned_idents)
    
    print("Graph structure:")
    for src, dst, data in graph.edges(data=True):
        weight = data.get('weight', 0)
        ident = data.get('ident', 'unknown')
        print(f"  {src} -> {dst}: weight={weight:.1f}, ident={ident}")
    
    # Test different personalization strengths
    all_files = {tag.rel_fname for tag in tags}
    
    strengths = [1.0, 10.0, 100.0, 1000.0]
    
    for strength in strengths:
        print(f"\n--- Personalization Strength: {strength} ---")
        
        # Create personalization vector manually  
        personalization = {"main.py": strength}
        
        rankings = nx.pagerank(graph, weight="weight", personalization=personalization, dangling=personalization)
        
        for node, rank in sorted(rankings.items(), key=lambda x: x[1], reverse=True):
            is_chat = " (CHAT)" if node in chat_files else ""
            print(f"  {node:15} -> {rank:.6f}{is_chat}")
        
        main_rank = rankings.get("main.py", 0)
        max_rank = max(rankings.values())
        main_is_top = (main_rank == max_rank)
        print(f"  Main.py is top: {main_is_top}")


def test_solution_strategies():
    """Test different strategies to make chat files rank higher."""
    
    print("\n\n=== Testing Solution Strategies ===")
    
    # Same test graph
    tags = [
        Tag("main.py", "/abs/main.py", 1, "main", "def"),
        Tag("main.py", "/abs/main.py", 5, "func_a", "ref"),
        Tag("main.py", "/abs/main.py", 6, "func_b", "ref"),
        Tag("main.py", "/abs/main.py", 7, "func_c", "ref"),
        Tag("file_a.py", "/abs/file_a.py", 1, "func_a", "def"),
        Tag("file_b.py", "/abs/file_b.py", 1, "func_b", "def"),
        Tag("file_c.py", "/abs/file_c.py", 1, "func_c", "def"),
    ]
    
    chat_files = {"main.py"}
    ranker = GraphRanker(verbose=False)
    graph = ranker.build_dependency_graph(tags, chat_files, set())
    
    # Strategy 1: Much higher personalization
    print("\n--- Strategy 1: Very High Personalization ---")
    personalization1 = {"main.py": 1000.0}
    rankings1 = nx.pagerank(graph, weight="weight", personalization=personalization1, dangling=personalization1)
    main_is_top1 = rankings1["main.py"] == max(rankings1.values())
    print(f"Main.py is top: {main_is_top1}")
    for node, rank in sorted(rankings1.items(), key=lambda x: x[1], reverse=True):
        print(f"  {node:15} -> {rank:.6f}")
    
    # Strategy 2: Personalize ALL files, but chat files more
    print("\n--- Strategy 2: Personalize All Files ---")
    base_pers = 25.0
    chat_pers = 200.0
    personalization2 = {}
    for node in graph.nodes():
        if node in chat_files:
            personalization2[node] = chat_pers
        else:
            personalization2[node] = base_pers
    
    rankings2 = nx.pagerank(graph, weight="weight", personalization=personalization2, dangling=personalization2)
    main_is_top2 = rankings2["main.py"] == max(rankings2.values())
    print(f"Main.py is top: {main_is_top2}")
    for node, rank in sorted(rankings2.items(), key=lambda x: x[1], reverse=True):
        print(f"  {node:15} -> {rank:.6f}")
    
    # Strategy 3: Check if the issue is in our ranking distribution logic
    print("\n--- Strategy 3: Check Definition Rankings ---")
    
    # Use high personalization that works
    rankings = rankings1  # The very high personalization
    
    ranker.rankings = rankings  # Set internal state
    definition_rankings = ranker.distribute_ranking_to_definitions(tags, rankings)
    
    print("Definition rankings:")
    for (file_path, ident), rank in definition_rankings[:5]:
        print(f"  {file_path}:{ident:15} -> {rank:.6f}")
    
    print(f"\nMain.py file rank: {rankings['main.py']:.6f}")
    print(f"Main definitions in top 5: {any('main.py' in str(item[0]) for item in definition_rankings[:5])}")


if __name__ == "__main__":
    test_pagerank_behavior()
    test_our_graph_structure() 
    test_solution_strategies()