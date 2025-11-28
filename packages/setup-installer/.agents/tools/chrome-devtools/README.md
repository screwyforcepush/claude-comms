# Chrome DevTools Browser Automation Tool

Stateful Chrome automation wrapper that reduces context token usage by 96% while maintaining full browser state across multiple CLI invocations.

## Quick Start

```bash
# From repo root - start daemon in background
uv run .agents/tools/chrome-devtools/browsertools.py daemon start &
sleep 5

# Use commands - state persists across invocations!
uv run .agents/tools/chrome-devtools/browsertools.py nav http://localhost:5173/
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py click 1_7
uv run .agents/tools/chrome-devtools/browsertools.py snap

# Stop when done
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

## Full Command Reference

Run `uv run .agents/tools/chrome-devtools/browsertools.py --help` to see all commands.

**Key commands:**
- `daemon start` - Start browser (run in background with `&`)
- `nav <url>` - Navigate to URL
- `snap` - Get page snapshot with element UIDs
- `click <uid>` - Click element
- `fill <uid> <value>` - Fill input/select
- `shot [path]` - Screenshot
- `conslist`, `netlist` - Debug console/network
- `daemon stop` - Clean shutdown

## Configuration

**Default:** Headless mode (no Chrome window)

**To use visual mode:** Create `~/.browsertools/config.json`:
```json
{
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
}
```

**For sandbox:** See `config.json` in this directory for examples.

## Architecture

- **Persistent daemon** - Single MCP server runs in background
- **Unix socket bridge** - Multiple CLI commands share state via socket
- **Stateful** - Snapshots, tabs, cookies persist across invocations
- **Clean shutdown** - Process groups ensure no orphaned Chrome processes


## Complete UAT Example

```bash
# Start daemon
uv run .agents/tools/chrome-devtools/browsertools.py daemon start &
sleep 5

# Navigate and get page structure
uv run .agents/tools/chrome-devtools/browsertools.py nav http://app.com/login
uv run .agents/tools/chrome-devtools/browsertools.py snap | grep email
# Found: uid=1_23 input "email"

# Fill form
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_23 user@example.com
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_24 password
uv run .agents/tools/chrome-devtools/browsertools.py click 1_25

# Verify
uv run .agents/tools/chrome-devtools/browsertools.py wait "Dashboard"
uv run .agents/tools/chrome-devtools/browsertools.py conslist --types error
uv run .agents/tools/chrome-devtools/browsertools.py shot /tmp/success.png

# Cleanup
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

## Troubleshooting

**Chrome window appears:** Remove `~/.browsertools/config.json` to use default headless mode

**"Daemon not running":**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon status
uv run .agents/tools/chrome-devtools/browsertools.py daemon start &
```

**Timeouts:** Increase with `--timeout` flag on nav/wait commands

## Files

- `browsertools.py` - Main tool (24KB)
- `config.json` - Default config (headless mode)
- `README.md` - This file

User config at `~/.browsertools/config.json` overrides repo defaults.
