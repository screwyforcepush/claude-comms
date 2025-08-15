#!/usr/bin/env python3
"""
Comprehensive test suite for PageRank algorithm prototype.
Tests edge weight calculations, personalization, and performance.
"""

import time
import random
from typing import List, Set
from pagerank_prototype import PageRankCodeAnalyzer, Tag, create_sample_tags


class TestPageRankAlgorithm:
    """Test suite for PageRank code importance ranking."""
    
    def __init__(self):
        self.analyzer = PageRankCodeAnalyzer(verbose=False)
        self.results = []
    
    def test_edge_weight_calculation(self):
        """Test edge weight calculation with various identifier types."""
        print("=== Testing Edge Weight Calculation ===")
        
        test_cases = [
            # (identifier, mentioned_idents, expected_multiplier_range)
            ("simple_var", set(), (0.9, 1.1)),  # base case
            ("mentioned_func", {"mentioned_func"}, (9, 11)),  # mentioned boost
            ("long_snake_case_function", set(), (9, 11)),  # long name boost
            ("longCamelCaseFunction", set(), (9, 11)),  # camelCase boost
            ("long-kebab-case-name", set(), (9, 11)),  # kebab-case boost
            ("_private_method", set(), (0.05, 0.15)),  # private penalty
            ("mentioned_long_snake_case", {"mentioned_long_snake_case"}, (90, 110)),  # both boosts
        ]
        
        for ident, mentioned_idents, expected_range in test_cases:
            multiplier = self.analyzer._calculate_identifier_multiplier(ident, mentioned_idents)
            low, high = expected_range
            
            success = low <= multiplier <= high
            status = "PASS" if success else "FAIL"
            
            print(f"  {ident:25} -> {multiplier:6.1f} ({status})")
            self.results.append(("edge_weight", ident, success))
        
        print()
    
    def test_personalization_vector(self):
        """Test personalization vector creation."""
        print("=== Testing Personalization Vector ===")
        
        chat_files = {"main.py", "core.py"}
        mentioned_files = {"utils.py"}
        mentioned_idents = {"calculate"}
        all_files = {"main.py", "core.py", "utils.py", "helper.py", "calc_data.py"}
        
        personalization = self.analyzer.create_personalization_vector(
            chat_files=chat_files,
            mentioned_files=mentioned_files,
            mentioned_idents=mentioned_idents,
            all_files=all_files
        )
        
        # Test expectations
        tests = [
            ("main.py in personalization", "main.py" in personalization),
            ("core.py in personalization", "core.py" in personalization),
            ("utils.py in personalization", "utils.py" in personalization),
            ("calc_data.py in personalization (matches 'calculate')", "calc_data.py" in personalization),
            ("helper.py not in personalization", "helper.py" not in personalization),
        ]
        
        for test_name, condition in tests:
            status = "PASS" if condition else "FAIL"
            print(f"  {test_name:50} ({status})")
            self.results.append(("personalization", test_name, condition))
        
        print(f"  Personalization values: {personalization}")
        print()
    
    def test_graph_construction(self):
        """Test dependency graph construction."""
        print("=== Testing Graph Construction ===")
        
        tags = create_sample_tags()
        chat_files = {"main.py"}
        mentioned_idents = {"process_data"}
        
        graph = self.analyzer.build_dependency_graph(tags, chat_files, mentioned_idents)
        
        tests = [
            ("Graph has nodes", graph.number_of_nodes() > 0),
            ("Graph has edges", graph.number_of_edges() > 0),
            ("main.py node exists", "main.py" in graph.nodes),
            ("utils.py node exists", "utils.py" in graph.nodes),
            ("Has main.py -> utils.py edge", graph.has_edge("main.py", "utils.py")),
            ("Edge has weight attribute", len([data for _, _, data in graph.edges(data=True) if 'weight' in data]) > 0),
            ("Edge has ident attribute", len([data for _, _, data in graph.edges(data=True) if 'ident' in data]) > 0),
        ]
        
        for test_name, condition in tests:
            status = "PASS" if condition else "FAIL"
            print(f"  {test_name:40} ({status})")
            self.results.append(("graph_construction", test_name, condition))
        
        # Print graph structure
        print(f"  Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
        print()
    
    def test_pagerank_ranking(self):
        """Test PageRank ranking behavior."""
        print("=== Testing PageRank Ranking ===")
        
        tags = create_sample_tags()
        chat_files = {"main.py"}
        mentioned_idents = {"process_data"}
        all_files = {"main.py", "utils.py", "logger.py", "config.py"}
        
        # Build graph and calculate rankings
        graph = self.analyzer.build_dependency_graph(tags, chat_files, mentioned_idents)
        personalization = self.analyzer.create_personalization_vector(
            chat_files=chat_files,
            mentioned_idents=mentioned_idents,
            all_files=all_files
        )
        rankings = self.analyzer.calculate_pagerank(personalization)
        
        # Test expectations
        tests = [
            ("main.py has highest rank (chat file)", 
             rankings.get("main.py", 0) == max(rankings.values())),
            ("All files have positive ranks", 
             all(rank > 0 for rank in rankings.values())),
            ("Ranks sum approximately to 1", 
             abs(sum(rankings.values()) - 1.0) < 0.01),
            ("utils.py has higher rank than logger.py (more connections)",
             rankings.get("utils.py", 0) > rankings.get("logger.py", 0)),
        ]
        
        for test_name, condition in tests:
            status = "PASS" if condition else "FAIL"
            print(f"  {test_name:50} ({status})")
            self.results.append(("pagerank_ranking", test_name, condition))
        
        # Print rankings
        sorted_rankings = sorted(rankings.items(), key=lambda x: x[1], reverse=True)
        for file_path, rank in sorted_rankings:
            boost = " (CHAT)" if file_path in chat_files else ""
            print(f"    {file_path:15} -> {rank:.6f}{boost}")
        print()
    
    def test_definition_distribution(self):
        """Test ranking distribution to specific definitions."""
        print("=== Testing Definition Distribution ===")
        
        tags = create_sample_tags()
        chat_files = {"main.py"}
        mentioned_idents = {"process_data"}
        all_files = {"main.py", "utils.py", "logger.py", "config.py"}
        
        # Full pipeline
        graph = self.analyzer.build_dependency_graph(tags, chat_files, mentioned_idents)
        personalization = self.analyzer.create_personalization_vector(
            chat_files=chat_files,
            mentioned_idents=mentioned_idents,
            all_files=all_files
        )
        rankings = self.analyzer.calculate_pagerank(personalization)
        definition_rankings = self.analyzer.distribute_ranking_to_definitions(tags, rankings)
        
        tests = [
            ("Definition rankings exist", len(definition_rankings) > 0),
            ("process_data has high rank (mentioned)", 
             any("process_data" in str(item[0]) for item in definition_rankings[:3])),
            ("Rankings are sorted descending", 
             all(definition_rankings[i][1] >= definition_rankings[i+1][1] 
                 for i in range(len(definition_rankings)-1))),
        ]
        
        for test_name, condition in tests:
            status = "PASS" if condition else "FAIL"
            print(f"  {test_name:40} ({status})")
            self.results.append(("definition_distribution", test_name, condition))
        
        # Print top definitions
        print("  Top definitions:")
        for (file_path, ident), rank in definition_rankings[:5]:
            print(f"    {file_path}:{ident:15} -> {rank:.6f}")
        print()
    
    def test_performance_scaling(self):
        """Test performance with different graph sizes."""
        print("=== Testing Performance Scaling ===")
        
        sizes = [10, 50, 100, 500]
        timings = []
        
        for size in sizes:
            # Generate synthetic data
            tags = self.generate_synthetic_tags(size)
            
            start_time = time.time()
            
            graph = self.analyzer.build_dependency_graph(tags)
            rankings = self.analyzer.calculate_pagerank()
            
            end_time = time.time()
            elapsed = end_time - start_time
            timings.append((size, elapsed))
            
            print(f"  {size:3d} files -> {elapsed:6.3f}s ({graph.number_of_edges()} edges)")
        
        # Check scaling efficiency
        scaling_tests = []
        for i in range(1, len(timings)):
            size_ratio = timings[i][0] / timings[i-1][0]
            time_ratio = timings[i][1] / timings[i-1][1]
            efficiency = size_ratio / time_ratio
            scaling_tests.append(efficiency > 0.1)  # Should not be exponential
        
        good_scaling = all(scaling_tests)
        status = "PASS" if good_scaling else "FAIL"
        print(f"  Scaling efficiency: {status}")
        self.results.append(("performance", "scaling_efficiency", good_scaling))
        print()
    
    def generate_synthetic_tags(self, num_files: int) -> List[Tag]:
        """Generate synthetic tags for performance testing."""
        tags = []
        
        for i in range(num_files):
            file_name = f"file_{i:03d}.py"
            
            # Each file defines a few functions
            for j in range(random.randint(1, 5)):
                func_name = f"func_{i}_{j}"
                tags.append(Tag(file_name, f"/abs/{file_name}", j*10, func_name, "def"))
            
            # Each file references some functions from other files
            for _ in range(random.randint(1, 8)):
                other_file = random.randint(0, num_files-1)
                func_ref = f"func_{other_file}_{random.randint(0, 4)}"
                line = random.randint(50, 100)
                tags.append(Tag(file_name, f"/abs/{file_name}", line, func_ref, "ref"))
        
        return tags
    
    def test_edge_cases(self):
        """Test edge cases and error conditions."""
        print("=== Testing Edge Cases ===")
        
        tests = [
            ("Empty tags list", self.test_empty_tags),
            ("Single file", self.test_single_file),
            ("No references", self.test_no_references),
            ("Circular dependencies", self.test_circular_deps),
            ("Large identifier names", self.test_large_identifiers),
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                status = "PASS" if result else "FAIL"
            except Exception as e:
                result = False
                status = f"ERROR: {str(e)[:50]}"
            
            print(f"  {test_name:25} ({status})")
            self.results.append(("edge_cases", test_name, result))
        
        print()
    
    def test_empty_tags(self) -> bool:
        """Test with empty tags list."""
        analyzer = PageRankCodeAnalyzer()
        graph = analyzer.build_dependency_graph([])
        return graph.number_of_nodes() == 0
    
    def test_single_file(self) -> bool:
        """Test with single file."""
        tags = [Tag("solo.py", "/abs/solo.py", 1, "lonely_func", "def")]
        analyzer = PageRankCodeAnalyzer()
        graph = analyzer.build_dependency_graph(tags)
        rankings = analyzer.calculate_pagerank()
        return len(rankings) >= 0  # Should handle gracefully
    
    def test_no_references(self) -> bool:
        """Test with only definitions, no references."""
        tags = [
            Tag("file1.py", "/abs/file1.py", 1, "func1", "def"),
            Tag("file2.py", "/abs/file2.py", 1, "func2", "def"),
        ]
        analyzer = PageRankCodeAnalyzer()
        graph = analyzer.build_dependency_graph(tags)
        rankings = analyzer.calculate_pagerank()
        return len(rankings) > 0
    
    def test_circular_deps(self) -> bool:
        """Test with circular dependencies."""
        tags = [
            Tag("a.py", "/abs/a.py", 1, "func_a", "def"),
            Tag("b.py", "/abs/b.py", 1, "func_b", "def"),
            Tag("a.py", "/abs/a.py", 5, "func_b", "ref"),
            Tag("b.py", "/abs/b.py", 5, "func_a", "ref"),
        ]
        analyzer = PageRankCodeAnalyzer()
        graph = analyzer.build_dependency_graph(tags)
        rankings = analyzer.calculate_pagerank()
        return abs(sum(rankings.values()) - 1.0) < 0.01
    
    def test_large_identifiers(self) -> bool:
        """Test with very long identifier names."""
        long_name = "very_long_function_name_that_exceeds_normal_length" * 3
        tags = [
            Tag("file.py", "/abs/file.py", 1, long_name, "def"),
            Tag("other.py", "/abs/other.py", 1, long_name, "ref"),
        ]
        analyzer = PageRankCodeAnalyzer()
        graph = analyzer.build_dependency_graph(tags)
        rankings = analyzer.calculate_pagerank()
        return len(rankings) > 0
    
    def run_all_tests(self):
        """Run all test suites."""
        print("PageRank Algorithm Test Suite")
        print("=" * 50)
        print()
        
        test_suites = [
            self.test_edge_weight_calculation,
            self.test_personalization_vector,
            self.test_graph_construction,
            self.test_pagerank_ranking,
            self.test_definition_distribution,
            self.test_performance_scaling,
            self.test_edge_cases,
        ]
        
        for test_suite in test_suites:
            test_suite()
        
        # Summary
        print("=== Test Summary ===")
        passed = sum(1 for _, _, result in self.results if result)
        total = len(self.results)
        
        print(f"Tests passed: {passed}/{total} ({passed/total*100:.1f}%)")
        
        # Show failures
        failures = [(category, test, result) for category, test, result in self.results if not result]
        if failures:
            print("\nFailures:")
            for category, test, _ in failures:
                print(f"  {category}: {test}")
        
        print("\n=== Test Complete ===")


if __name__ == "__main__":
    tester = TestPageRankAlgorithm()
    tester.run_all_tests()