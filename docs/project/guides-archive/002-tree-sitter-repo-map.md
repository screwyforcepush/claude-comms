# ADR-002: Tree-sitter Based Repository Map Implementation

## Status
ACCEPTED

## Context
The current repository map hook (`repo_map.py`) contains a TODO placeholder for implementing tree-sitter based code analysis. We need a sophisticated system that provides Claude with intelligent code context while managing token limits effectively.

## Decision
We will implement a tree-sitter based repository mapping system using:
1. **Tree-sitter** for language-agnostic AST parsing
2. **NetworkX PageRank** for code importance ranking
3. **Multi-level caching** with diskcache/SQLite
4. **Binary search optimization** for token budget management
5. **Hook-based integration** via UserPromptSubmit

## Rationale

### Why Tree-sitter?
- **36x speedup** over traditional parsers (per research)
- **Incremental parsing** for real-time updates
- **Language agnostic** with 25+ languages supported
- **Error recovery** for incomplete code
- **Pure Python bindings** available (py-tree-sitter-languages)

### Why PageRank?
- **Proven algorithm** for importance ranking in graph structures
- **Handles cyclic dependencies** gracefully
- **Personalization support** for context-aware ranking
- **Efficient implementation** via NetworkX
- **Used successfully** in Aider (reference implementation)

### Why Multi-level Caching?
- **L1 Memory cache**: Sub-millisecond access for hot data
- **L2 Disk cache**: Persistence across sessions
- **L3 Database cache**: Complex query support with SQLite
- **Invalidation strategy**: mtime-based for simplicity

### Why Binary Search Optimization?
- **Efficient convergence**: O(log n) complexity
- **Flexible tolerance**: ±15% acceptable range
- **Token-aware**: Direct optimization for context window
- **Proven approach**: Used in production systems

## Architecture Overview

### Module Structure
```
.claude/hooks/context/
├── repo_map.py           # Hook entry (replace existing)
├── repo_map_core.py      # Core logic
├── repo_map_cache.py     # Caching system
├── language_support.py   # Language configs
├── token_optimizer.py    # Token optimization
└── queries/              # .scm query files
```

### Data Flow
1. Hook receives user prompt
2. Extract session context (chat files, mentions)
3. Parse files with tree-sitter (cached)
4. Build dependency graph
5. Calculate PageRank with personalization
6. Optimize for token budget
7. Format and return map

### Key Interfaces
```python
class RepoMapGenerator:
    def generate_map(
        chat_files: List[str],
        other_files: List[str],
        max_tokens: int = 1024,
        mentioned_fnames: Set[str] = None,
        mentioned_idents: Set[str] = None
    ) -> str
```

## Implementation Plan

### Phase 1: Core (Week 1)
- [ ] Basic tree-sitter parsing for Python
- [ ] Simple PageRank implementation
- [ ] Hook integration
- [ ] Basic caching

### Phase 2: Optimization (Week 2)
- [ ] Token optimization with binary search
- [ ] Multi-level caching
- [ ] Performance tuning
- [ ] Error handling

### Phase 3: Enhancement (Week 3)
- [ ] Multi-language support (JS, TS, Go, Rust)
- [ ] Advanced ranking features
- [ ] Comprehensive testing
- [ ] Documentation

## Performance Targets
- Initial scan: < 3s for 1000 files
- Cached retrieval: < 50ms
- Memory usage: < 50MB typical
- Token accuracy: ±15% of target

## Testing Strategy
- **Unit tests**: 95% coverage for core modules
- **Integration tests**: Hook flow validation
- **Performance tests**: Large repo benchmarks
- **E2E tests**: Real user scenarios

## Risks and Mitigations

### Risk: Performance on Large Repos
**Mitigation**: Implement aggressive caching, file filtering, and lazy loading

### Risk: Language Support Gaps
**Mitigation**: Fallback to pygments for unsupported languages

### Risk: Memory Usage
**Mitigation**: LRU cache eviction, streaming processing

### Risk: Token Counting Accuracy
**Mitigation**: Sample-based estimation for large content

## Dependencies
```toml
tree-sitter = ">=0.20.0"
tree-sitter-languages = ">=1.10.0"  
networkx = ">=3.0"
diskcache = ">=5.6.0"
pathspec = ">=0.12.0"
```

## Alternatives Considered

### Alternative 1: CTags Based
- **Rejected**: Less rich information, requires external binary

### Alternative 2: Simple Regex
- **Rejected**: Language-specific, less accurate

### Alternative 3: LSP Integration
- **Rejected**: Too heavyweight, requires language servers

### Alternative 4: Static Analysis Tools
- **Rejected**: Language-specific, complex integration

## Consequences

### Positive
- Rich contextual information for Claude
- Language-agnostic solution
- Excellent performance with caching
- Proven approach (Aider reference)
- Extensible architecture

### Negative
- Additional dependencies required
- Initial implementation complexity
- Cache storage overhead
- Learning curve for tree-sitter queries

## Success Metrics
- User-perceived improvement in Claude's code understanding
- Sub-second response times for typical queries
- >90% cache hit rate after warm-up
- Support for 10+ programming languages
- <100MB disk usage for cache

## References
- [Aider Tree-sitter Blog Post](docs/tech-docs/aider-treesitter-blog.md)
- [Reference Implementation](aider-treesitter-reference-impl/repomap.py)
- [Research Synthesis](docs/project/guides/tree-sitter-research-synthesis.md)
- [Architecture Document](docs/project/guides/repo-map-architecture.md)
- [Implementation Guide](docs/project/guides/repo-map-implementation-guide.md)
- [Test Architecture](docs/project/guides/repo-map-test-architecture.md)

## Review and Approval
- **Proposed by**: MariaAether (Architect)
- **Research by**: SamirQuantum (Deep Researcher)
- **Analysis by**: CarlosByte (Engineer)
- **Date**: 2024-08-15
- **Status**: ACCEPTED for implementation

---

*This ADR documents the architectural decision to implement tree-sitter based repository mapping for enhanced code context in Claude Code hooks.*