# browsertools (bt) - Complete Tool Reference

## Overview

Chrome DevTools MCP wrapper. Run `uv run .agents/tools/chrome-devtools/browsertools.py daemon start` once, then use commands. State persists across all invocations.

## Critical Concepts

**UIDs (Element Identifiers):**
- Obtained from `uv run .agents/tools/chrome-devtools/browsertools.py snap` output (e.g., `uid=1_23`)
- Only valid until page DOM changes
- Must take new snapshot after navigation or DOM-altering clicks

**State Persistence:**
- Daemon maintains: snapshots, console logs, network requests, page state
- All commands share same Chrome instance and MCP session

---

## Daemon Management

### `uv run .agents/tools/chrome-devtools/browsertools.py daemon start`
Start persistent daemon. Spawns Chrome with remote debugging.

**No parameters**

**Output:** Status message with PID and socket path

---

### `uv run .agents/tools/chrome-devtools/browsertools.py daemon stop`
Stop daemon and kill all Chrome processes cleanly.

**No parameters**

**Important:** Uses process group termination to ensure no orphaned Chrome processes.

---

### `uv run .agents/tools/chrome-devtools/browsertools.py daemon status`
Check if daemon is running.

**No parameters**

**Output:** Running status, PID, socket path

---

## Navigation

### `uv run .agents/tools/chrome-devtools/browsertools.py nav <url>`
Navigate current page to URL.

**Parameters:**
- `url` (string, required): Target URL

**Output:** Success message with final URL (follows redirects)

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py nav http://localhost:5173/
uv run .agents/tools/chrome-devtools/browsertools.py nav https://example.com
```

---

### `uv run .agents/tools/chrome-devtools/browsertools.py wait <text>`
Wait for specified text to appear on page.

**Parameters:**
- `text` (string, required): Text to wait for
- `--timeout` (integer, optional): Max wait time in milliseconds (default: depends on MCP server)

**Output:** Success when text appears, error on timeout

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py wait "Dashboard"
uv run .agents/tools/chrome-devtools/browsertools.py wait "Login successful"
```

**Use cases:** Wait for navigation, async content loading, success messages

---

## Inspection

### `uv run .agents/tools/chrome-devtools/browsertools.py snap`
Take accessibility tree snapshot of current page. Returns text representation with element UIDs.

**Parameters:**
- `--file-path` (string, optional): Save to file instead of stdout
- `--verbose` (boolean, optional): Include full a11y tree details

**Output:** Text snapshot with structure:
```
uid=1_0 RootWebArea "Page Title" url="http://..."
  uid=1_1 banner
    uid=1_2 heading "HEADER" level="1"
    uid=1_3 button "Click Me"
    uid=1_4 StaticText "Some text"
  uid=1_5 main
    uid=1_6 link "Link text" url="http://..."
```

**Important:**
- ALWAYS use latest snapshot
- UIDs invalidate when DOM changes
- Prefer snapshot over screenshot (cheaper, more semantic)

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py snap --verbose
uv run .agents/tools/chrome-devtools/browsertools.py snap --file-path /tmp/page.txt
```

---

### `uv run .agents/tools/chrome-devtools/browsertools.py shot [path]`
Take screenshot of viewport or specific element.

**Parameters:**
- `path` (string, optional): Save path (if omitted, returns base64)
- `--format` (enum: png|jpeg|webp, optional): Image format (default: png)
- `--quality` (integer, optional): Compression quality 0-100 for jpeg/webp
- `--full-page` (boolean, optional): Capture full page, not just viewport
- `--uid` (string, optional): Screenshot specific element instead of viewport

**Output:** Success message with save path or base64 data

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py shot /tmp/page.png
uv run .agents/tools/chrome-devtools/browsertools.py shot --full-page /tmp/full.png
uv run .agents/tools/chrome-devtools/browsertools.py shot --format jpeg --quality 80 /tmp/compressed.jpg
```

**Note:** `--uid` and `--full-page` are incompatible

---

### `uv run .agents/tools/chrome-devtools/browsertools.py eval <function>`
Execute JavaScript function in page context. Returns JSON-serializable result.

**Parameters:**
- `function` (string, required): JavaScript function declaration
- `--args` (array, optional): Arguments to pass (JSON array of element UIDs)

**Output:** JSON result of function execution

**Examples:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py eval "() => document.title"
uv run .agents/tools/chrome-devtools/browsertools.py eval "() => window.location.href"
uv run .agents/tools/chrome-devtools/browsertools.py eval "async () => await fetch('/api/user').then(r => r.json())"
uv run .agents/tools/chrome-devtools/browsertools.py eval "(el) => el.innerText" --args '["1_23"]'
```

**Important:** Returned values must be JSON-serializable

---

## Interaction

### `uv run .agents/tools/chrome-devtools/browsertools.py click <uid>`
Click on element by UID from snapshot.

**Parameters:**
- `uid` (string, required): Element UID from `uv run .agents/tools/chrome-devtools/browsertools.py snap` output
- `--double` (boolean, optional): Double-click instead of single click

**Output:** Success message with updated page snapshot

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py click 1_23
uv run .agents/tools/chrome-devtools/browsertools.py click 1_45 --double
```

**Important:** Must have valid snapshot first

---

### `uv run .agents/tools/chrome-devtools/browsertools.py fill <uid> <value>`
Fill input, textarea, or select element with value.

**Parameters:**
- `uid` (string, required): Element UID from snapshot
- `value` (string, required): Value to fill (min length: 1)

**Output:** Success message

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_23 "user@example.com"
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_24 "password123"
uv run .agents/tools/chrome-devtools/browsertools.py fill 1_25 "Option2"  # For <select> elements
```

**Supported elements:**
- `<input>` (text, email, password, etc.)
- `<textarea>`
- `<select>` (provide option text or value)

---

### `uv run .agents/tools/chrome-devtools/browsertools.py key <key>`
Press keyboard key or key combination.

**Parameters:**
- `key` (string, required): Key or combination

**Valid keys:**
- Single: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Modifiers: `Control`, `Shift`, `Alt`, `Meta`
- Combinations: `Control+A`, `Control+C`, `Control+V`, `Control+Shift+R`

**Output:** Success message

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py key Enter
uv run .agents/tools/chrome-devtools/browsertools.py key Tab
uv run .agents/tools/chrome-devtools/browsertools.py key Control+A
uv run .agents/tools/chrome-devtools/browsertools.py key Control++     # Zoom in
```

**Use case:** When `uv run .agents/tools/chrome-devtools/browsertools.py fill` cannot be used (keyboard shortcuts, navigation)

---

### `uv run .agents/tools/chrome-devtools/browsertools.py hover <uid>`
Hover mouse over element (for tooltips, dropdown menus, etc.)

**Parameters:**
- `uid` (string, required): Element UID from snapshot

**Output:** Success message with updated page snapshot

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py hover 1_23  # Trigger tooltip
uv run .agents/tools/chrome-devtools/browsertools.py snap        # See tooltip in new snapshot
```

---

## Page Manipulation

### `uv run .agents/tools/chrome-devtools/browsertools.py resize <width> <height>`
Resize page viewport to specified dimensions.

**Parameters:**
- `width` (integer, required): Width in pixels
- `height` (integer, required): Height in pixels

**Output:** Success message

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py resize 1920 1080    # Full HD
uv run .agents/tools/chrome-devtools/browsertools.py resize 375 812      # iPhone 13 Pro
uv run .agents/tools/chrome-devtools/browsertools.py resize 1366 768     # Common laptop
```

**Use case:** Test responsive designs, mobile views

---

### `uv run .agents/tools/chrome-devtools/browsertools.py dialog <action>`
Handle browser alert, confirm, or prompt dialogs.

**Parameters:**
- `action` (enum, required): `accept` or `dismiss`
- `--text <text>` (string, optional): Text to enter for prompt dialogs

**Output:** Success message

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py click 1_23                    # Click triggers alert()
uv run .agents/tools/chrome-devtools/browsertools.py dialog accept                 # Accept the alert

uv run .agents/tools/chrome-devtools/browsertools.py click 1_24                    # Triggers confirm()
uv run .agents/tools/chrome-devtools/browsertools.py dialog dismiss                # Cancel

uv run .agents/tools/chrome-devtools/browsertools.py click 1_25                    # Triggers prompt()
uv run .agents/tools/chrome-devtools/browsertools.py dialog accept --text "Hello"  # Enter text and accept
```

**Important:** Dialog must be open when command runs, or it will error

---

### `uv run .agents/tools/chrome-devtools/browsertools.py upload <uid> <file_path>`
Upload file through file input element.

**Parameters:**
- `uid` (string, required): UID of `<input type="file">` element from snapshot
- `file_path` (string, required): Local file path to upload (absolute or relative)

**Output:** Success message

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py snap
uv run .agents/tools/chrome-devtools/browsertools.py upload 1_23 /tmp/document.pdf
uv run .agents/tools/chrome-devtools/browsertools.py upload 1_24 ./image.png
uv run .agents/tools/chrome-devtools/browsertools.py upload 1_25 ~/Downloads/data.csv
```

**Important:**
- File must exist and be readable
- Element must be file input or trigger file chooser

---

## Debugging

### `uv run .agents/tools/chrome-devtools/browsertools.py conslist`
List all console messages since last navigation.

**Parameters:**
- `--types <type>...` (array, optional): Filter by message type
  - Valid types: `log`, `error`, `warn`, `info`, `debug`
  - Example: `--types error warn`
- `--size <N>` (integer, optional): Max messages to return

**Output:** List of console messages with IDs

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py conslist                    # All messages
uv run .agents/tools/chrome-devtools/browsertools.py conslist --types error      # Only errors
uv run .agents/tools/chrome-devtools/browsertools.py conslist --types error warn --size 10
```

---

### `uv run .agents/tools/chrome-devtools/browsertools.py consget <msgid>`
Get full details of specific console message.

**Parameters:**
- `msgid` (integer, required): Message ID from `uv run .agents/tools/chrome-devtools/browsertools.py conslist`

**Output:** Full message details including stack trace (if error)

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py conslist
uv run .agents/tools/chrome-devtools/browsertools.py consget 5  # Get details of message #5
```

---

### `uv run .agents/tools/chrome-devtools/browsertools.py netlist`
List all network requests since last navigation.

**Parameters:**
- `--types <type>...` (array, optional): Filter by resource type
  - Valid types: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `xhr`, `fetch`, `websocket`, `other`
  - Example: `--types xhr fetch`
- `--size <N>` (integer, optional): Max requests to return

**Output:** List of requests with IDs, method, URL, status

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py netlist                        # All requests
uv run .agents/tools/chrome-devtools/browsertools.py netlist --types xhr fetch      # Only AJAX
uv run .agents/tools/chrome-devtools/browsertools.py netlist --types script --size 5
```

---

### `uv run .agents/tools/chrome-devtools/browsertools.py netget [reqid]`
Get full details of network request.

**Parameters:**
- `reqid` (integer, optional): Request ID from `uv run .agents/tools/chrome-devtools/browsertools.py netlist`
  - If omitted: returns currently selected request in DevTools Network panel

**Output:** Full request/response details (headers, body, timing)

**Example:**
```bash
uv run .agents/tools/chrome-devtools/browsertools.py netlist
uv run .agents/tools/chrome-devtools/browsertools.py netget 42  # Get details of request #42
uv run .agents/tools/chrome-devtools/browsertools.py netget     # Get currently selected request
```

---

## NOT Implemented (Use Native MCP if Needed)

These tools exist in chrome-devtools-mcp but are NOT in bt wrapper:

**Multi-tab management:**
- `list_pages` - List open tabs
- `select_page` - Switch tabs
- `new_page` - Open new tab
- `close_page` - Close specific tab

**Advanced interaction:**
- `drag` - Drag and drop elements
- `fill_form` - Fill multiple fields at once

**Emulation:**
- `emulate` - CPU/network throttling

**Performance:**
- `performance_start_trace` - Start performance recording
- `performance_stop_trace` - Stop recording
- `performance_analyze_insight` - Analyze performance metrics

**Rationale:** bt focuses on core UAT workflows. For advanced features, use native `mcp__chrome-devtools__*` tools directly.

---

## Token Comparison

**Native MCP (all 26 tools):** ~5000 tokens
**bt wrapper (13 tools + help):** ~500 tokens (this document)
**bt wrapper (--help only):** ~200 tokens

**Reduction:** 90-96% depending on what agent reads

---

## Workflow Pattern for Agents

```python
# 1. Start daemon (once)
bash: "uv run .agents/tools/chrome-devtools/browsertools.py daemon start &"

# 2. Navigate
bash: "bt nav http://app.com/login"

# 3. Get page structure
bash: "bt snap > /tmp/page.txt"
read: /tmp/page.txt  # Parse to find UIDs

# 4. Interact
bash: "bt fill 1_23 user@example.com"
bash: "bt fill 1_24 password"
bash: "bt click 1_25"

# 5. Verify
bash: "bt wait Dashboard"
bash: "bt conslist --types error"
bash: "bt netlist --types xhr"

# 6. Capture evidence
bash: "bt shot /tmp/result.png"
read: /tmp/result.png  # Visual verification

# 7. Cleanup
bash: "bt daemon stop"
```

This workflow maintains state across all steps while keeping context usage minimal.
