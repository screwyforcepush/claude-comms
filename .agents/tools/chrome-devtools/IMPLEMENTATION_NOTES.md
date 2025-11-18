# Chrome DevTools MCP Wrapper - Implementation Notes

## Final Architecture

Successfully implemented a **Unix socket bridge daemon** that solves the original problem while enabling true multi-command statefulness.

## Problem Statement (Solved ✅)

**Original issue**: Chrome DevTools MCP tools loaded into agent context consume ~5000+ tokens even when not needed.

**Solution**: Persistent daemon with Unix socket IPC that maintains state across non-interactive CLI invocations.

## Key Design Decisions

### 1. Unix Domain Socket Bridge (Not HTTP, Not Plan Files)

**Why Unix sockets:**
- Minimal overhead vs HTTP
- Works on macOS/Linux without setup
- Secure (filesystem permissions)
- Standard IPC pattern for local daemons

**Why not HTTP:**
- Overkill for local-only communication
- More code complexity
- Harder to secure

**Why not plan files:**
- User requirement: "multi-step without plan file, without interactive, without upfront planning"
- Needed ad-hoc workflow: snap → analyze → click

### 2. Process Group Management for Clean Shutdown

**Challenge**: Chrome spawns multiple child processes (GPU, renderers, etc.) that don't die when parent MCP server is killed.

**Solution**:
```python
# Start MCP in new process group
mcp_proc = await asyncio.create_subprocess_exec(
    'npx', '-y', 'chrome-devtools-mcp@latest', '--isolated',
    start_new_session=True,  # Creates process group
)

# On shutdown, kill entire group
pgid = os.getpgid(mcp_proc.pid)
os.killpg(pgid, signal.SIGTERM)  # Kills Chrome + all children
```

**Result**: Verified 6 Chrome processes → 0 Chrome processes on daemon stop ✅

### 3. JSON-RPC Multiplexing via asyncio Futures

**Challenge**: Multiple CLI clients need to share one MCP stdio session.

**Solution**:
```python
pending_requests = {}  # msg_id -> asyncio.Future

# Client handler
msg_id = os.urandom(8).hex()
future = asyncio.Future()
pending_requests[msg_id] = future

# Forward to MCP
mcp_writer.write(json.dumps(request).encode() + b'\n')

# Wait for response
resp = await future  # Resolved by read_mcp_responses()

# Response reader
async def read_mcp_responses():
    while True:
        line = await mcp_reader.readline()
        resp = json.loads(line.decode())
        msg_id = resp.get("id")
        if msg_id in pending_requests:
            pending_requests.pop(msg_id).set_result(resp)
```

**Result**: Multiple concurrent clients can send requests; responses correctly routed back.

## Implementation Journey

### Attempt 1: Stateless wrapper (FAILED)
- Each command spawned new MCP server
- Snapshot didn't persist
- Slower due to spawn overhead
- **Lesson**: Need persistent server, not per-command spawn

### Attempt 2: Plan-based sessions (PARTIAL)
- Single MCP session for multi-step plan
- State persisted within plan execution
- **Problem**: User wanted ad-hoc commands, not upfront planning

### Attempt 3: Persistent Chrome with ephemeral MCP servers (FAILED)
- Tried to reuse Chrome via --wsEndpoint
- Each command still spawned new MCP server
- Snapshot state still didn't persist (lived in MCP server, not Chrome)
- **Lesson**: State is in MCP server memory, not just Chrome

### Attempt 4: Daemon with Unix socket bridge (SUCCESS ✅)
- Single MCP server runs continuously
- Unix socket bridge multiplexes client requests
- Full state persistence across commands
- Proper process group cleanup

## Tools Implemented

### Core UAT (7 tools)
1. `nav` - navigate_page
2. `snap` - take_snapshot
3. `click` - click
4. `fill` - fill
5. `shot` - take_screenshot
6. `wait` - wait_for
7. `eval` - evaluate_script

### Extended (6 tools)
8. `key` - press_key
9. `hover` - hover
10. `netlist` - list_network_requests
11. `netget` - get_network_request
12. `conslist` - list_console_messages
13. `consget` - get_console_message

### Not Implemented (Not Needed)
- `list_pages`, `select_page`, `new_page`, `close_page` - Multi-tab management (daemon start/stop covers single-tab use case)

## Performance Characteristics

**Context token reduction:**
- Native MCP: ~5000 tokens (26 tools with schemas)
- bt wrapper: ~200 tokens (help text only)
- **Reduction: 96%**

**Startup time:**
- First command: ~3s (Chrome + MCP server startup)
- Subsequent commands: ~50ms (socket connection only)

**Memory:**
- Single Chrome instance shared across all commands
- MCP server: ~50MB
- Chrome: ~200MB (varies with page complexity)

## Testing Results

**Test 1: State persistence**
```bash
bt nav http://localhost:5173/  # Command 1
bt snap                        # Command 2: creates snapshot
bt click 1_8                   # Command 3: uses snapshot! ✅
```
Result: Click succeeded using UID from previous snapshot

**Test 2: Process cleanup**
```bash
ps aux | grep puppeteer  # 6 processes
bt daemon stop
ps aux | grep puppeteer  # 0 processes ✅
```
Result: All Chrome processes terminated

**Test 3: Network debugging**
```bash
bt nav http://localhost:5173/
bt netlist  # Shows 64 requests (Vite dev server assets)
```
Result: Full network capture working

**Test 4: Console monitoring**
```bash
bt conslist --types error warn
```
Result: Console message filtering working

## Comparison to Original Goals

| Goal | Status | Notes |
|------|--------|-------|
| Reduce context tokens | ✅ | 96% reduction |
| Multi-step without plan files | ✅ | Ad-hoc commands work |
| Non-interactive | ✅ | Each command is independent |
| Stateful across invocations | ✅ | Snapshots persist |
| No upfront planning | ✅ | Commands can be run as needed |
| Clean Chrome shutdown | ✅ | Process groups work |

## Lessons Learned

1. **State lives in MCP server memory, not Chrome** - This is why we needed persistent MCP server, not just persistent Chrome

2. **Unix sockets are perfect for local IPC** - Simple, secure, fast, no overhead

3. **Process groups are essential** - `start_new_session=True` + `os.killpg()` ensures clean shutdown

4. **asyncio handles multiplexing elegantly** - StreamReader/Writer + Futures make JSON-RPC routing simple

5. **The original conversation advice was correct** - "One Chrome, multiple MCP servers" doesn't work because snapshot state lives in MCP server, not Chrome

## Future Enhancements (Not Needed Now)

- [ ] Auto-start daemon on first command (lazy initialization)
- [ ] Daemon log rotation
- [ ] Multi-tab support (new_page, select_page)
- [ ] Screenshot diffing for visual regression
- [ ] HAR export for network analysis
- [ ] Performance metrics (timing, memory)

## Conclusion

The wrapper successfully achieves its goals:
- **Minimal context footprint** - Agent only sees help text
- **Full statefulness** - Snapshots persist across commands
- **Clean architecture** - Unix socket bridge is simple and robust
- **Proper cleanup** - No orphaned Chrome processes
- **Complete UAT coverage** - All essential debugging tools included

This is production-ready for agent-driven browser testing!
