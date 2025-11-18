# browsertools (bt) - Complete Tool Reference

## Overview

Chrome DevTools MCP wrapper. Run `bt daemon start` once, then use commands. State persists across all invocations.

## Critical Concepts

**UIDs (Element Identifiers):**
- Obtained from `bt snap` output (e.g., `uid=1_23`)
- Only valid until page DOM changes
- Must take new snapshot after navigation or DOM-altering clicks

**State Persistence:**
- Daemon maintains: snapshots, console logs, network requests, page state
- All commands share same Chrome instance and MCP session

---

## Daemon Management

### `bt daemon start`
Start persistent daemon. Spawns Chrome with remote debugging.

**No parameters**

**Output:** Status message with PID and socket path

---

### `bt daemon stop`
Stop daemon and kill all Chrome processes cleanly.

**No parameters**

**Important:** Uses process group termination to ensure no orphaned Chrome processes.

---

### `bt daemon status`
Check if daemon is running.

**No parameters**

**Output:** Running status, PID, socket path

---

## Navigation

### `bt nav <url>`
Navigate current page to URL.

**Parameters:**
- `url` (string, required): Target URL

**Output:** Success message with final URL (follows redirects)

**Example:**
```bash
bt nav http://localhost:5173/
bt nav https://example.com
```

---

### `bt wait <text>`
Wait for specified text to appear on page.

**Parameters:**
- `text` (string, required): Text to wait for
- `--timeout` (integer, optional): Max wait time in milliseconds (default: depends on MCP server)

**Output:** Success when text appears, error on timeout

**Example:**
```bash
bt wait "Dashboard"
bt wait "Login successful"
```

**Use cases:** Wait for navigation, async content loading, success messages

---

## Inspection

### `bt snap`
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
bt snap
bt snap --verbose
bt snap --file-path /tmp/page.txt
```

---

### `bt shot [path]`
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
bt shot /tmp/page.png
bt shot --full-page /tmp/full.png
bt shot --format jpeg --quality 80 /tmp/compressed.jpg
```

**Note:** `--uid` and `--full-page` are incompatible

---

### `bt eval <function>`
Execute JavaScript function in page context. Returns JSON-serializable result.

**Parameters:**
- `function` (string, required): JavaScript function declaration
- `--args` (array, optional): Arguments to pass (JSON array of element UIDs)

**Output:** JSON result of function execution

**Examples:**
```bash
bt eval "() => document.title"
bt eval "() => window.location.href"
bt eval "async () => await fetch('/api/user').then(r => r.json())"
bt eval "(el) => el.innerText" --args '["1_23"]'
```

**Important:** Returned values must be JSON-serializable

---

## Interaction

### `bt click <uid>`
Click on element by UID from snapshot.

**Parameters:**
- `uid` (string, required): Element UID from `bt snap` output
- `--double` (boolean, optional): Double-click instead of single click

**Output:** Success message with updated page snapshot

**Example:**
```bash
bt snap
bt click 1_23
bt click 1_45 --double
```

**Important:** Must have valid snapshot first

---

### `bt fill <uid> <value>`
Fill input, textarea, or select element with value.

**Parameters:**
- `uid` (string, required): Element UID from snapshot
- `value` (string, required): Value to fill (min length: 1)

**Output:** Success message

**Example:**
```bash
bt fill 1_23 "user@example.com"
bt fill 1_24 "password123"
bt fill 1_25 "Option2"  # For <select> elements
```

**Supported elements:**
- `<input>` (text, email, password, etc.)
- `<textarea>`
- `<select>` (provide option text or value)

---

### `bt key <key>`
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
bt key Enter
bt key Tab
bt key Control+A
bt key Control++     # Zoom in
```

**Use case:** When `bt fill` cannot be used (keyboard shortcuts, navigation)

---

### `bt hover <uid>`
Hover mouse over element (for tooltips, dropdown menus, etc.)

**Parameters:**
- `uid` (string, required): Element UID from snapshot

**Output:** Success message with updated page snapshot

**Example:**
```bash
bt snap
bt hover 1_23  # Trigger tooltip
bt snap        # See tooltip in new snapshot
```

---

## Page Manipulation

### `bt resize <width> <height>`
Resize page viewport to specified dimensions.

**Parameters:**
- `width` (integer, required): Width in pixels
- `height` (integer, required): Height in pixels

**Output:** Success message

**Example:**
```bash
bt resize 1920 1080    # Full HD
bt resize 375 812      # iPhone 13 Pro
bt resize 1366 768     # Common laptop
```

**Use case:** Test responsive designs, mobile views

---

### `bt dialog <action>`
Handle browser alert, confirm, or prompt dialogs.

**Parameters:**
- `action` (enum, required): `accept` or `dismiss`
- `--text <text>` (string, optional): Text to enter for prompt dialogs

**Output:** Success message

**Example:**
```bash
bt click 1_23                    # Click triggers alert()
bt dialog accept                 # Accept the alert

bt click 1_24                    # Triggers confirm()
bt dialog dismiss                # Cancel

bt click 1_25                    # Triggers prompt()
bt dialog accept --text "Hello"  # Enter text and accept
```

**Important:** Dialog must be open when command runs, or it will error

---

### `bt upload <uid> <file_path>`
Upload file through file input element.

**Parameters:**
- `uid` (string, required): UID of `<input type="file">` element from snapshot
- `file_path` (string, required): Local file path to upload (absolute or relative)

**Output:** Success message

**Example:**
```bash
bt snap
bt upload 1_23 /tmp/document.pdf
bt upload 1_24 ./image.png
bt upload 1_25 ~/Downloads/data.csv
```

**Important:**
- File must exist and be readable
- Element must be file input or trigger file chooser

---

## Debugging

### `bt conslist`
List all console messages since last navigation.

**Parameters:**
- `--types <type>...` (array, optional): Filter by message type
  - Valid types: `log`, `error`, `warn`, `info`, `debug`
  - Example: `--types error warn`
- `--size <N>` (integer, optional): Max messages to return

**Output:** List of console messages with IDs

**Example:**
```bash
bt conslist                    # All messages
bt conslist --types error      # Only errors
bt conslist --types error warn --size 10
```

---

### `bt consget <msgid>`
Get full details of specific console message.

**Parameters:**
- `msgid` (integer, required): Message ID from `bt conslist`

**Output:** Full message details including stack trace (if error)

**Example:**
```bash
bt conslist
bt consget 5  # Get details of message #5
```

---

### `bt netlist`
List all network requests since last navigation.

**Parameters:**
- `--types <type>...` (array, optional): Filter by resource type
  - Valid types: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `xhr`, `fetch`, `websocket`, `other`
  - Example: `--types xhr fetch`
- `--size <N>` (integer, optional): Max requests to return

**Output:** List of requests with IDs, method, URL, status

**Example:**
```bash
bt netlist                        # All requests
bt netlist --types xhr fetch      # Only AJAX
bt netlist --types script --size 5
```

---

### `bt netget [reqid]`
Get full details of network request.

**Parameters:**
- `reqid` (integer, optional): Request ID from `bt netlist`
  - If omitted: returns currently selected request in DevTools Network panel

**Output:** Full request/response details (headers, body, timing)

**Example:**
```bash
bt netlist
bt netget 42  # Get details of request #42
bt netget     # Get currently selected request
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
bash: "uv run .agents/tools/browsertools.py daemon start &"

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
