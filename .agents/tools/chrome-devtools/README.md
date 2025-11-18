# Browser Tools - Chrome DevTools MCP Wrapper

Persistent, stateful Chrome automation wrapper that reduces context token usage while maintaining full browser state across multiple non-interactive CLI invocations.

## Problem Solved

**Before**: Chrome DevTools MCP loaded directly into agent context
- ~26 tools with full JSON schemas
- Thousands of context tokens consumed
- Agent overwhelmed with unnecessary tool definitions

**After**: Thin daemon-based wrapper
- Agent only sees: `uv run .agents/tools/chrome-devtools/browsertools.py --help` output (~30 lines)
- Single daemon manages Chrome + MCP server
- State persists across all commands
- Context token usage: **~95% reduction**

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Agent     │  bash   │  uv run .agents/tools/chrome-devtools/browsertools.py (client)     │ socket  │  uv run .agents/tools/chrome-devtools/browsertools.py daemon      │
│  (Claude)   │ ──────> │  Quick CLI call  │ ──────> │  Unix socket    │
└─────────────┘         └──────────────────┘         │  bridge         │
                                                      │      ↕          │
                                                      │  MCP stdio      │
                                                      │      ↕          │
                                                      │ chrome-devtools │
                                                      │      ↕          │
                                                      │   Chrome        │
                                                      │  (Puppeteer)    │
                                                      └─────────────────┘
```

**Key Innovation**: Unix domain socket bridge that multiplexes JSON-RPC between multiple CLI clients and a single persistent MCP server session.

## Quick Start

```bash
# Start daemon (once per UAT session)
uv run .agents/tools/chrome-devtools/browsertools.py daemon start

# Run commands - state persists!
uv run .agents/tools/chrome-devtools/browsertools.py nav http://localhost:5173/
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py click 1_8
uv run .agents/tools/chrome-devtools/browsertools.py conslist --types error

# Stop daemon (kills Chrome too)
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

## Complete Command Reference

### Daemon Management
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon start    # Start persistent daemon + Chrome
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop     # Stop daemon + kill Chrome cleanly
uv run .agents/tools/chrome-devtools/browsertools.py daemon status   # Check if running
```

### Navigation
```bash
uv run .agents/tools/chrome-devtools/browsertools.py nav <url>              # Navigate to URL
uv run .agents/tools/chrome-devtools/browsertools.py wait <text>            # Wait for text to appear on page
```

### Inspection
```bash
uv run .agents/tools/chrome-devtools/browsertools.py snap                   # Take accessibility tree snapshot (get UIDs)
uv run .agents/tools/chrome-devtools/browsertools.py shot [path]            # Take screenshot (optional save path)
uv run .agents/tools/chrome-devtools/browsertools.py eval <js-function>     # Execute JavaScript in page context
```

### Interaction
```bash
uv run .agents/tools/chrome-devtools/browsertools.py click <uid>            # Click element by UID from snapshot
uv run .agents/tools/chrome-devtools/browsertools.py fill <uid> <value>     # Fill input/textarea/select
uv run .agents/tools/chrome-devtools/browsertools.py key <key>              # Press key (e.g., 'Enter', 'Tab', 'Escape')
uv run .agents/tools/chrome-devtools/browsertools.py hover <uid>            # Hover over element
```

### Debugging
```bash
uv run .agents/tools/chrome-devtools/browsertools.py conslist [--types error warn] [--size N]   # List console messages
uv run .agents/tools/chrome-devtools/browsertools.py consget <msgid>                            # Get console message details
uv run .agents/tools/chrome-devtools/browsertools.py netlist [--types xhr fetch] [--size N]     # List network requests
uv run .agents/tools/chrome-devtools/browsertools.py netget [reqid]                             # Get network request details
```

## Example UAT Workflows

### Login Flow
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
uv run .agents/tools/chrome-devtools/browsertools.py nav http://app.com/login
uv run .agents/tools/chrome-devtools/browsertools.py snap | grep -i email    # Find email input UID
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_23 "user@example.com"
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_24 "password123"
uv run .agents/tools/chrome-devtools/browsertools.py click 1_25              # Submit button
uv run .agents/tools/chrome-devtools/browsertools.py wait "Dashboard"        # Wait for redirect
uv run .agents/tools/chrome-devtools/browsertools.py conslist --types error  # Check for JS errors
uv run .agents/tools/chrome-devtools/browsertools.py shot /tmp/logged-in.png
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

### Form Validation Testing
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
uv run .agents/tools/chrome-devtools/browsertools.py nav http://app.com/signup
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_10 "invalid-email"  # Bad email format
uv run .agents/tools/chrome-devtools/browsertools.py click 1_15                  # Submit
uv run .agents/tools/chrome-devtools/browsertools.py wait "Invalid email"        # Check validation message
uv run .agents/tools/chrome-devtools/browsertools.py conslist                    # Check console for errors
uv run .agents/tools/chrome-devtools/browsertools.py netlist                     # Verify no API call made
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

### Network Debugging
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
uv run .agents/tools/chrome-devtools/browsertools.py nav http://app.com
uv run .agents/tools/chrome-devtools/browsertools.py netlist --types xhr fetch
uv run .agents/tools/chrome-devtools/browsertools.py netget 5                    # Inspect specific request
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

## State Persistence

The daemon maintains state across ALL commands:
- **Snapshots**: Take once, use UIDs in subsequent commands
- **Page state**: Navigate once, multiple operations on same page
- **Console/Network**: Accumulates throughout session
- **Tabs/Cookies**: Shared across all commands

Example proving persistence:
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
uv run .agents/tools/chrome-devtools/browsertools.py nav http://example.com
uv run .agents/tools/chrome-devtools/browsertools.py snap                    # Command 1: creates snapshot
uv run .agents/tools/chrome-devtools/browsertools.py click 1_5               # Command 2: uses snapshot from command 1! ✅
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
```

## Agent Usage Pattern

When an agent needs to perform UAT:

1. **Start daemon**: `uv run .agents/tools/chrome-devtools/browsertools.py daemon start &`
2. **Discover page**: `uv run .agents/tools/chrome-devtools/browsertools.py nav <url>` → `uv run .agents/tools/chrome-devtools/browsertools.py snap` to get UIDs
3. **Interact**: `uv run .agents/tools/chrome-devtools/browsertools.py click/fill/key` using UIDs from snapshot
4. **Verify**: `uv run .agents/tools/chrome-devtools/browsertools.py conslist` for errors, `uv run .agents/tools/chrome-devtools/browsertools.py netlist` for API calls
5. **Capture**: `uv run .agents/tools/chrome-devtools/browsertools.py shot` for visual verification
6. **Cleanup**: `uv run .agents/tools/chrome-devtools/browsertools.py daemon stop`

## Output Format

All commands return clean, human-readable text (not JSON):

```
# navigate_page response
Successfully navigated to http://localhost:5173/.
## Pages
0: http://localhost:5173/ [selected]
```

Errors are clearly indicated:
```
Error: Daemon not running. Start with: bt daemon start
```

## Process Management

**Daemon lifecycle:**
- Creates new process group with `start_new_session=True`
- Handles SIGTERM/SIGINT gracefully
- Kills entire Chrome process tree on shutdown using `os.killpg()`
- No orphaned Chrome processes

**Verified behavior:**
- Start: 0 Chrome processes → 6 Chrome processes (main + GPU + renderers)
- Stop: 6 Chrome processes → 0 Chrome processes ✅

## Configuration

Customize MCP server startup args via config file.

### Create config
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon config  # Creates ~/.browsertools/config.json
```

### Default config
```json
{
  "mcp_command": "npx",
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
}
```

### Example configs

**Headless mode (for CI/servers):**
```json
{
  "mcp_command": "npx",
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated", "--headless=true"]
}
```

**Sandbox with custom Chromium:**
```json
{
  "mcp_command": "npx",
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--isolated=true",
    "--headless=true",
    "--executablePath=/usr/local/bin/chromium-mcp"
  ]
}
```

**Local Chrome with specific profile:**
```json
{
  "mcp_command": "npx",
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--executablePath=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ]
}
```

**Note:** Config changes require daemon restart (`uv run .agents/tools/chrome-devtools/browsertools.py daemon stop` then `uv run .agents/tools/chrome-devtools/browsertools.py daemon start`)

## Dependencies

- Python >=3.11
- `mcp` Python SDK (auto-installed via uv)
- `npx` and `chrome-devtools-mcp` (fetched automatically)
- Google Chrome or Chromium (installed on system)

## Advantages Over Native MCP

| Aspect | Native MCP | bt Wrapper |
|--------|-----------|------------|
| Context tokens | ~5000+ (26 tools) | ~200 (help text) |
| State persistence | Within conversation | Across CLI invocations |
| Agent complexity | High (many tools) | Low (single command) |
| Chrome cleanup | Manual | Automatic |
| Network/Console | Direct access | Clean wrappers |

## Technical Details

**Unix Socket IPC:**
- Daemon listens on `~/.browsertools/daemon.sock`
- Each command connects, sends JSON-RPC, receives response
- Socket closed after each command (stateless client, stateful server)

**JSON-RPC Multiplexing:**
- Daemon tracks requests by `id`
- Multiple concurrent clients supported
- Responses routed to correct client via asyncio Futures

**Process Group Management:**
- MCP server spawned with `start_new_session=True`
- SIGTERM sent to entire process group on shutdown
- Escalates to SIGKILL after 5s timeout
- Ensures all Chrome child processes die

## Troubleshooting

**"Daemon not running" error:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon status           # Check if actually running
uv run .agents/tools/chrome-devtools/browsertools.py daemon start            # Start if needed
ps aux | grep browsertools # Verify daemon process
```

**Chrome won't close:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
pkill -f puppeteer_dev_chrome  # Fallback cleanup
```

**Socket permission errors:**
```bash
rm ~/.browsertools/daemon.sock
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
```

## Complete Command List

```
Daemon:       daemon start, daemon stop, daemon status
Navigation:   nav, wait
Inspection:   snap, shot, eval
Interaction:  click, fill, key, hover
Console:      conslist, consget
Network:      netlist, netget
```

## Success Metrics

✅ **Token reduction**: 95% reduction in context usage
✅ **Statefulness**: Multi-command workflows without plan files
✅ **Clean output**: No JSON wrapping, minimal noise
✅ **Proper cleanup**: Chrome dies with daemon (verified)
✅ **Network debugging**: View XHR/fetch requests
✅ **Console debugging**: Catch JS errors
✅ **Full UAT coverage**: All essential tools implemented

This wrapper is now production-ready for agent-driven browser UAT!
