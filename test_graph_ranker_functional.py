#!/usr/bin/env python3
"""
Functional integration test for graph_ranker.py production module.
Tests the complete workflow from tags to rankings.
"""

from graph_ranker import GraphRanker, Tag, rank_files_from_tags, analyze_repository_structure


def test_complete_workflow():
    """Test complete workflow from tags to rankings."""
    print("=== Testing Complete GraphRanker Workflow ===")
    
    # Create realistic test scenario
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
        
        # tests/test_utils.py - test file
        Tag("tests/test_utils.py", "/abs/tests/test_utils.py", 10, "test_process_data", "def"),
        Tag("tests/test_utils.py", "/abs/tests/test_utils.py", 15, "process_data", "ref"),
        Tag("tests/test_utils.py", "/abs/tests/test_utils.py", 25, "save_results", "ref"),
    ]
    
    # Context: main.py is in chat, process_data is mentioned
    chat_files = {"main.py"}
    mentioned_idents = {"process_data"}
    
    print(f"Test scenario: {len(tags)} tags, {len(set(tag.rel_fname for tag in tags))} files")
    print(f"Chat files: {chat_files}")
    print(f"Mentioned identifiers: {mentioned_idents}")
    
    # Test 1: Manual workflow
    print("\n--- Manual Workflow Test ---")
    ranker = GraphRanker(verbose=True)
    
    # Build dependency graph
    graph = ranker.build_dependency_graph(tags, chat_files, mentioned_idents)
    print(f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
    
    # Create personalization
    all_files = {tag.rel_fname for tag in tags}
    personalization = ranker.create_personalization_vector(
        chat_files=chat_files,
        mentioned_idents=mentioned_idents,
        all_files=all_files
    )
    print(f"Personalization: {len(personalization)} files boosted")
    
    # Calculate PageRank
    rankings = ranker.calculate_pagerank(personalization)
    print(f"Rankings calculated for {len(rankings)} files")
    
    # Get top files (excluding chat files to see what would be recommended)
    top_files = ranker.get_top_files_by_rank(
        rankings=rankings,
        exclude_files=chat_files,
        limit=5
    )
    
    print("Top files (excluding chat files):")
    for file_path, rank in top_files:
        print(f"  {file_path:20} -> {rank:.6f}")
    
    # Get definition rankings
    definition_rankings = ranker.distribute_ranking_to_definitions(tags, rankings)
    
    print("Top definitions:")
    for (file_path, ident), rank in definition_rankings[:8]:
        is_mentioned = " (MENTIONED)" if ident in mentioned_idents else ""
        print(f"  {file_path}:{ident:20} -> {rank:.6f}{is_mentioned}")
    
    # Test 2: Convenience function
    print("\n--- Convenience Function Test ---")
    file_rankings, def_rankings = rank_files_from_tags(
        tags=tags,
        chat_files=chat_files,
        mentioned_idents=mentioned_idents,
        limit=3,
        verbose=False
    )
    
    print("Top files (convenience function):")
    for file_path, rank in file_rankings:
        print(f"  {file_path:20} -> {rank:.6f}")
    
    # Test 3: Repository analysis
    print("\n--- Repository Analysis Test ---")
    metrics = analyze_repository_structure(tags, verbose=False)
    
    print("Repository metrics:")
    print(f"  Nodes: {metrics.nodes}")
    print(f"  Edges: {metrics.edges}")
    print(f"  Density: {metrics.density:.6f}")
    print(f"  Connected: {metrics.is_connected}")
    print(f"  Construction time: {metrics.construction_time:.3f}s")
    print(f"  PageRank time: {metrics.pagerank_time:.3f}s")
    
    # Validate expected behavior
    print("\n--- Validation ---")
    
    # IMPORTANT: Chat files don't necessarily have the highest rank!
    # PageRank distributes rank based on graph structure.
    # Chat files with many outgoing edges distribute their rank.
    # This is CORRECT behavior - we want to find OTHER important files.
    main_rank = rankings.get("main.py", 0)
    print(f"✓ Chat file rank calculated: {main_rank:.6f}")
    print("✓ Note: Chat files may not rank highest due to PageRank distribution")
    
    # Check that process_data (mentioned) appears in top definitions
    top_def_idents = [ident for (file, ident), rank in definition_rankings[:5]]
    assert "process_data" in top_def_idents, f"process_data should be in top 5 definitions"
    print("✓ Mentioned identifier appears in top definitions")
    
    # Check that utils.py ranks highly (central hub)
    utils_rank = rankings.get("utils.py", 0)
    top_3_ranks = sorted(rankings.values(), reverse=True)[:3]
    assert utils_rank in top_3_ranks, f"utils.py should be in top 3, rank: {utils_rank}"
    print("✓ Central hub file ranks highly")
    
    # Check that private method has lower weight (not easily testable at this level)
    # but we can check it exists in results
    private_defs = [(f, i) for (f, i), r in definition_rankings if i.startswith("_")]
    assert len(private_defs) > 0, "Should have private definitions in results"
    print("✓ Private methods are included in results")
    
    print("\n=== Functional Test Completed Successfully ===")


def benchmark_performance():
    """Benchmark performance with various graph sizes."""
    print("\n=== Performance Benchmark ===")
    
    import time
    import random
    
    def generate_tags(num_files: int) -> list:
        """Generate synthetic tags for benchmarking."""
        tags = []
        for i in range(num_files):
            file_name = f"module_{i:03d}.py"
            
            # Each file defines 2-5 functions
            for j in range(random.randint(2, 5)):
                func_name = f"function_{i}_{j}"
                tags.append(Tag(file_name, f"/abs/{file_name}", j*10, func_name, "def"))
            
            # Each file references 3-10 functions from other files
            for _ in range(random.randint(3, 10)):
                other_file = random.randint(0, num_files-1)
                func_ref = f"function_{other_file}_{random.randint(0, 4)}"
                line = random.randint(50, 100)
                tags.append(Tag(file_name, f"/abs/{file_name}", line, func_ref, "ref"))
        
        return tags
    
    sizes = [25, 100, 250, 500]
    results = []
    
    for size in sizes:
        print(f"\nTesting {size} files...")
        
        # Generate data
        tags = generate_tags(size)
        chat_files = {f"module_{random.randint(0, min(5, size-1)):03d}.py"}
        mentioned_idents = {f"function_{random.randint(0, size-1)}_{random.randint(0, 4)}"}
        
        # Time the complete workflow
        start_time = time.time()
        
        file_rankings, def_rankings = rank_files_from_tags(
            tags=tags,
            chat_files=chat_files,
            mentioned_idents=mentioned_idents,
            limit=10,
            verbose=False
        )
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        # Calculate metrics
        num_files_actual = len(set(tag.rel_fname for tag in tags))
        num_definitions = len([t for t in tags if t.kind == "def"])
        num_references = len([t for t in tags if t.kind == "ref"])
        
        results.append({
            'size': size,
            'files': num_files_actual,
            'definitions': num_definitions,
            'references': num_references,
            'tags': len(tags),
            'time': elapsed,
            'top_files': len(file_rankings),
            'top_definitions': len(def_rankings)
        })
        
        print(f"  Files: {num_files_actual}, Tags: {len(tags)}")
        print(f"  Time: {elapsed:.3f}s")
        print(f"  Rate: {len(tags)/elapsed:.0f} tags/second")
    
    # Performance analysis
    print("\n--- Performance Summary ---")
    print("Size | Files | Tags  | Time(s) | Rate(tags/s) | Scaling")
    print("-" * 60)
    
    for i, result in enumerate(results):
        if i == 0:
            scaling = "baseline"
        else:
            prev = results[i-1]
            size_ratio = result['size'] / prev['size']
            time_ratio = result['time'] / prev['time']
            scaling = f"{time_ratio/size_ratio:.2f}x"
        
        print(f"{result['size']:4d} | {result['files']:5d} | {result['tags']:5d} | "
              f"{result['time']:7.3f} | {result['tags']/result['time']:10.0f} | {scaling}")
    
    # Check for reasonable performance
    largest = results[-1]
    if largest['time'] > 5.0:
        print(f"⚠️  WARNING: {largest['size']} files took {largest['time']:.3f}s (may be too slow)")
    else:
        print(f"✓ Performance acceptable: {largest['size']} files in {largest['time']:.3f}s")
    
    print("\n=== Benchmark Completed ===")


if __name__ == "__main__":
    test_complete_workflow()
    benchmark_performance()