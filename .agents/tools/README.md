# Browser Tools - Chrome DevTools MCP Wrapper

Persistent, stateful Chrome automation wrapper that reduces context token usage while maintaining full browser state across multiple non-interactive CLI invocations.

## Problem Solved

**Before**: Chrome DevTools MCP loaded directly into agent context
- ~26 tools with full JSON schemas
- Thousands of context tokens consumed
- Agent overwhelmed with unnecessary tool definitions

**After**: Thin daemon-based wrapper
- Agent only sees: `bt --help` output (~30 lines)
- Single daemon manages Chrome + MCP server
- State persists across all commands
- Context token usage: **~95% reduction**

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Agent     │  bash   │  bt (client)     │ socket  │  bt daemon      │
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
uv run .agents/tools/browsertools.py daemon start

# Run commands - state persists!
uv run .agents/tools/browsertools.py nav http://localhost:5173/
uv run .agents/tools/browsertools.py snap
uv run .agents/tools/browsertools.py click 1_8
uv run .agents/tools/browsertools.py conslist --types error

# Stop daemon (kills Chrome too)
uv run .agents/tools/browsertools.py daemon stop
```

## Complete Command Reference

### Daemon Management
```bash
bt daemon start    # Start persistent daemon + Chrome
bt daemon stop     # Stop daemon + kill Chrome cleanly
bt daemon status   # Check if running
```

### Navigation
```bash
bt nav <url>              # Navigate to URL
bt wait <text>            # Wait for text to appear on page
```

### Inspection
```bash
bt snap                   # Take accessibility tree snapshot (get UIDs)
bt shot [path]            # Take screenshot (optional save path)
bt eval <js-function>     # Execute JavaScript in page context
```

### Interaction
```bash
bt click <uid>            # Click element by UID from snapshot
bt fill <uid> <value>     # Fill input/textarea/select
bt key <key>              # Press key (e.g., 'Enter', 'Tab', 'Escape')
bt hover <uid>            # Hover over element
```

### Debugging
```bash
bt conslist [--types error warn] [--size N]   # List console messages
bt consget <msgid>                            # Get console message details
bt netlist [--types xhr fetch] [--size N]     # List network requests
bt netget [reqid]                             # Get network request details
```

## Example UAT Workflows

### Login Flow
```bash
bt daemon start
bt nav http://app.com/login
bt snap | grep -i email    # Find email input UID
bt fill 1_23 "user@example.com"
bt fill 1_24 "password123"
bt click 1_25              # Submit button
bt wait "Dashboard"        # Wait for redirect
bt conslist --types error  # Check for JS errors
bt shot /tmp/logged-in.png
bt daemon stop
```

### Form Validation Testing
```bash
bt daemon start
bt nav http://app.com/signup
bt snap
bt fill 1_10 "invalid-email"  # Bad email format
bt click 1_15                  # Submit
bt wait "Invalid email"        # Check validation message
bt conslist                    # Check console for errors
bt netlist                     # Verify no API call made
bt daemon stop
```

### Network Debugging
```bash
bt daemon start
bt nav http://app.com
bt netlist --types xhr fetch
bt netget 5                    # Inspect specific request
bt daemon stop
```

## State Persistence

The daemon maintains state across ALL commands:
- **Snapshots**: Take once, use UIDs in subsequent commands
- **Page state**: Navigate once, multiple operations on same page
- **Console/Network**: Accumulates throughout session
- **Tabs/Cookies**: Shared across all commands

Example proving persistence:
```bash
bt daemon start
bt nav http://example.com
bt snap                    # Command 1: creates snapshot
bt click 1_5               # Command 2: uses snapshot from command 1! ✅
bt daemon stop
```

## Agent Usage Pattern

When an agent needs to perform UAT:

1. **Start daemon**: `uv run .agents/tools/browsertools.py daemon start &`
2. **Discover page**: `bt nav <url>` → `bt snap` to get UIDs
3. **Interact**: `bt click/fill/key` using UIDs from snapshot
4. **Verify**: `bt conslist` for errors, `bt netlist` for API calls
5. **Capture**: `bt shot` for visual verification
6. **Cleanup**: `bt daemon stop`

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

## Dependencies

- Python >=3.11
- `mcp` Python SDK (auto-installed via uv)
- `npx` and `chrome-devtools-mcp` (fetched automatically)
- Google Chrome (installed on system)

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
bt daemon status           # Check if actually running
bt daemon start            # Start if needed
ps aux | grep browsertools # Verify daemon process
```

**Chrome won't close:**
```bash
bt daemon stop
pkill -f puppeteer_dev_chrome  # Fallback cleanup
```

**Socket permission errors:**
```bash
rm ~/.browsertools/daemon.sock
bt daemon start
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
