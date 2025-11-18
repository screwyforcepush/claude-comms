# Agent Tools

Collection of specialized tools for agent workflows.

## Available Tools

### chrome-devtools/
Chrome DevTools MCP wrapper for browser automation and UAT.

**Quick start:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
uv run .agents/tools/chrome-devtools/browsertools.py nav http://localhost:5173/
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

**Documentation:**
- [README.md](chrome-devtools/README.md) - Quick start and examples
- [TOOL_REFERENCE.md](chrome-devtools/TOOL_REFERENCE.md) - Complete parameter reference
- [CONFIG.md](chrome-devtools/CONFIG.md) - Environment configuration
- [COVERAGE.md](chrome-devtools/COVERAGE.md) - Tool coverage analysis

**Features:**
- 96% context token reduction vs native MCP
- Persistent state across CLI invocations
- Network/console debugging
- Configurable for any environment (local/sandbox/CI)

---

## Adding New Tools

When creating new agent tools:

1. Create subdirectory: `.agents/tools/<tool-name>/`
2. Add main script (preferably uv-based)
3. Add README.md with usage examples
4. Update this index

**Design principles:**
- Minimize context token usage
- Provide clear documentation
- Support non-interactive CLI usage
- Handle cleanup properly
