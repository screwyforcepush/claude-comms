#!/usr/bin/env python3
"""
Debug the ranking issue - investigate why chat files aren't ranking highest.
"""

from graph_ranker import GraphRanker, Tag

def debug_ranking_issue():
    """Debug why main.py (chat file) isn't ranking highest."""
    
    tags = [
        # main.py - entry point, references multiple functions
        Tag("main.py", "/abs/main.py", 1, "main", "def"),
        Tag("main.py", "/abs/main.py", 10, "process_data", "ref"),  # mentioned
        Tag("main.py", "/abs/main.py", 15, "save_results", "ref"),
        Tag("main.py", "/abs/main.py", 5, "DATABASE_URL", "ref"),
        Tag("main.py", "/abs/main.py", 8, "log_message", "ref"),
        
        # utils.py - core utilities
        Tag("utils.py", "/abs/utils.py", 20, "process_data", "def"),
        Tag("utils.py", "/abs/utils.py", 50, "save_results", "def"),
        Tag("utils.py", "/abs/utils.py", 80, "validate_input", "def"),
        Tag("utils.py", "/abs/utils.py", 25, "DATABASE_URL", "ref"),
        Tag("utils.py", "/abs/utils.py", 55, "log_message", "ref"),
        
        # config.py - configuration
        Tag("config.py", "/abs/config.py", 1, "DATABASE_URL", "def"),
        Tag("config.py", "/abs/config.py", 10, "API_KEY", "def"),
        Tag("config.py", "/abs/config.py", 15, "validate_input", "ref"),
        
        # logger.py - logging utility
        Tag("logger.py", "/abs/logger.py", 5, "log_message", "def"),
        Tag("logger.py", "/abs/logger.py", 20, "_format_message", "def"),  # private
    ]
    
    chat_files = {"main.py"}
    mentioned_idents = {"process_data"}
    
    ranker = GraphRanker(verbose=True)
    
    print("=== Building Graph ===")
    graph = ranker.build_dependency_graph(tags, chat_files, mentioned_idents)
    
    print("\n=== Graph Analysis ===")
    print("Nodes:", list(graph.nodes()))
    print("Edges with weights:")
    for src, dst, data in graph.edges(data=True):
        weight = data.get('weight', 0)
        ident = data.get('ident', 'unknown')
        print(f"  {src} -> {dst}: weight={weight:.3f}, ident={ident}")
    
    print("\n=== Personalization ===")
    all_files = {tag.rel_fname for tag in tags}
    personalization = ranker.create_personalization_vector(
        chat_files=chat_files,
        mentioned_idents=mentioned_idents,
        all_files=all_files
    )
    print("Personalization vector:", personalization)
    
    print("\n=== PageRank Calculation ===")
    rankings = ranker.calculate_pagerank(personalization)
    
    print("Rankings:")
    for file_path, rank in sorted(rankings.items(), key=lambda x: x[1], reverse=True):
        is_chat = " (CHAT)" if file_path in chat_files else ""
        print(f"  {file_path:15} -> {rank:.6f}{is_chat}")
    
    print("\n=== Issue Analysis ===")
    
    # Check outgoing edges from main.py
    main_out_edges = list(graph.out_edges("main.py", data=True))
    print(f"main.py outgoing edges ({len(main_out_edges)}):")
    total_out_weight = 0
    for src, dst, data in main_out_edges:
        weight = data.get('weight', 0)
        ident = data.get('ident', 'unknown')
        total_out_weight += weight
        print(f"  -> {dst}: weight={weight:.3f}, ident={ident}")
    print(f"Total outgoing weight from main.py: {total_out_weight:.3f}")
    
    # Check incoming edges to main.py
    main_in_edges = list(graph.in_edges("main.py", data=True))
    print(f"\nmain.py incoming edges ({len(main_in_edges)}):")
    total_in_weight = 0
    for src, dst, data in main_in_edges:
        weight = data.get('weight', 0)
        ident = data.get('ident', 'unknown')
        total_in_weight += weight
        print(f"  {src} -> : weight={weight:.3f}, ident={ident}")
    print(f"Total incoming weight to main.py: {total_in_weight:.3f}")
    
    # Check outgoing vs incoming for logger.py
    logger_out_edges = list(graph.out_edges("logger.py", data=True))
    logger_in_edges = list(graph.in_edges("logger.py", data=True))
    print(f"\nlogger.py: {len(logger_out_edges)} out, {len(logger_in_edges)} in")
    logger_out_weight = sum(data.get('weight', 0) for _, _, data in logger_out_edges)
    logger_in_weight = sum(data.get('weight', 0) for _, _, data in logger_in_edges)
    print(f"  Out weight: {logger_out_weight:.3f}, In weight: {logger_in_weight:.3f}")
    
    print("\n=== Possible Issues ===")
    print("1. PageRank favors nodes with fewer outgoing edges (authority)")
    print("2. main.py has many outgoing edges, distributing its rank")
    print("3. logger.py might have few outgoing edges, concentrating rank")
    print("4. Personalization might not be strong enough to overcome graph structure")
    
    print(f"\nPersonalization boost for main.py: {personalization.get('main.py', 0):.3f}")
    print(f"But main.py distributes rank across {len(main_out_edges)} outgoing edges")


if __name__ == "__main__":
    debug_ranking_issue()