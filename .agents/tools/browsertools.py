#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "mcp>=1.1.2",
# ]
# ///
"""
Chrome DevTools MCP wrapper - persistent daemon with Unix socket bridge.

Architecture:
- Daemon spawns chrome-devtools-mcp once, keeps it running
- Daemon listens on Unix socket for client commands
- Multiple CLI invocations connect via socket, share same MCP session
- State (snapshots, tabs, etc.) persists across all commands
"""

import asyncio
import argparse
import json
import os
import signal
import sys
from pathlib import Path
from typing import Any, Dict, Optional

# State directory
STATE_DIR = Path.home() / ".browsertools"
SOCKET_PATH = STATE_DIR / "daemon.sock"
PID_FILE = STATE_DIR / "daemon.pid"

# Global daemon state
mcp_proc = None
mcp_reader = None
mcp_writer = None
pending_requests = {}  # msg_id -> response_future


def ensure_state_dir():
    """Create state directory."""
    STATE_DIR.mkdir(exist_ok=True)


def get_daemon_pid() -> Optional[int]:
    """Get PID of running daemon."""
    if not PID_FILE.exists():
        return None
    try:
        pid = int(PID_FILE.read_text().strip())
        os.kill(pid, 0)  # Check if alive
        return pid
    except (ProcessLookupError, ValueError):
        PID_FILE.unlink(missing_ok=True)
        return None


def is_daemon_running() -> bool:
    """Check if daemon is running."""
    return get_daemon_pid() is not None and SOCKET_PATH.exists()


# ============================================================================
# DAEMON MODE - Bridge between Unix socket and MCP stdio
# ============================================================================

async def read_mcp_responses():
    """Read responses from MCP stdout and route to clients."""
    global mcp_reader, pending_requests

    while True:
        try:
            line = await mcp_reader.readline()
            if not line:
                print("MCP server closed stdout", file=sys.stderr)
                break

            try:
                resp = json.loads(line.decode())
                msg_id = resp.get("id")

                # Route response to waiting client
                if msg_id and msg_id in pending_requests:
                    future = pending_requests.pop(msg_id)
                    future.set_result(resp)
            except json.JSONDecodeError:
                print(f"Invalid JSON from MCP: {line}", file=sys.stderr)

        except Exception as e:
            print(f"Error reading MCP: {e}", file=sys.stderr)
            break


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Handle a client connection."""
    global mcp_writer, pending_requests

    try:
        while True:
            # Read request from client
            line = await reader.readline()
            if not line:
                break

            try:
                req = json.loads(line.decode())
                msg_id = req.get("id")

                # Create future for response
                response_future = asyncio.Future()
                pending_requests[msg_id] = response_future

                # Forward to MCP server
                mcp_writer.write(line)
                await mcp_writer.drain()

                # Wait for response
                try:
                    resp = await asyncio.wait_for(response_future, timeout=30.0)
                    writer.write(json.dumps(resp).encode() + b'\n')
                    await writer.drain()
                except asyncio.TimeoutError:
                    writer.write(json.dumps({
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "error": {"code": -1, "message": "Timeout waiting for MCP response"}
                    }).encode() + b'\n')
                    await writer.drain()
                    pending_requests.pop(msg_id, None)

            except json.JSONDecodeError:
                print(f"Invalid JSON from client: {line}", file=sys.stderr)

    except Exception as e:
        print(f"Client handler error: {e}", file=sys.stderr)
    finally:
        writer.close()


async def shutdown_mcp():
    """Properly shutdown MCP server and all Chrome child processes."""
    global mcp_proc

    if not mcp_proc:
        return

    print("Shutting down MCP server and Chrome...", file=sys.stderr)

    try:
        # Get process group ID
        pgid = os.getpgid(mcp_proc.pid)

        # Send SIGTERM to entire process group (kills Chrome and all children)
        os.killpg(pgid, signal.SIGTERM)

        # Wait for graceful shutdown
        try:
            await asyncio.wait_for(mcp_proc.wait(), timeout=5.0)
            print("MCP server stopped gracefully", file=sys.stderr)
        except asyncio.TimeoutError:
            # Force kill if still running
            print("Force killing MCP server...", file=sys.stderr)
            os.killpg(pgid, signal.SIGKILL)
            await mcp_proc.wait()

    except ProcessLookupError:
        # Already dead
        pass
    except Exception as e:
        print(f"Error during shutdown: {e}", file=sys.stderr)


async def run_daemon():
    """Run the persistent daemon."""
    global mcp_proc, mcp_reader, mcp_writer

    ensure_state_dir()

    # Clean up old socket if exists
    if SOCKET_PATH.exists():
        SOCKET_PATH.unlink()

    print(f"Starting chrome-devtools-mcp...", file=sys.stderr)

    # Start MCP server as subprocess in new process group
    # This ensures we can kill Chrome and all its children together
    mcp_proc = await asyncio.create_subprocess_exec(
        'npx', '-y', 'chrome-devtools-mcp@latest', '--isolated',
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=sys.stderr,
        start_new_session=True,  # Creates new process group
    )

    mcp_reader = mcp_proc.stdout
    mcp_writer = mcp_proc.stdin

    # Write PID file
    PID_FILE.write_text(str(os.getpid()))

    print(f"Starting Unix socket server at {SOCKET_PATH}...", file=sys.stderr)

    # Start Unix socket server
    server = await asyncio.start_unix_server(
        handle_client,
        path=str(SOCKET_PATH)
    )

    print(f"Daemon ready. PID: {os.getpid()}", file=sys.stderr)

    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()

    async def handle_shutdown(sig):
        print(f"\nReceived {sig.name}, shutting down...", file=sys.stderr)
        await shutdown_mcp()
        server.close()
        await server.wait_closed()
        SOCKET_PATH.unlink(missing_ok=True)
        PID_FILE.unlink(missing_ok=True)
        loop.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(
            sig,
            lambda s=sig: asyncio.create_task(handle_shutdown(s))
        )

    # Run both the socket server and MCP response reader
    try:
        await asyncio.gather(
            server.serve_forever(),
            read_mcp_responses(),
        )
    except KeyboardInterrupt:
        print("\nShutting down daemon...", file=sys.stderr)
    finally:
        # Cleanup
        await shutdown_mcp()
        server.close()
        await server.wait_closed()
        SOCKET_PATH.unlink(missing_ok=True)
        PID_FILE.unlink(missing_ok=True)


# ============================================================================
# CLIENT MODE - Connect to daemon and send commands
# ============================================================================

async def send_command(tool_name: str, args: Dict[str, Any]) -> Any:
    """Send a command to the daemon via socket."""
    if not is_daemon_running():
        raise RuntimeError("Daemon not running. Start with: bt daemon start")

    # Connect to daemon's Unix socket
    reader, writer = await asyncio.open_unix_connection(str(SOCKET_PATH))

    try:
        # Create JSON-RPC request
        msg_id = os.urandom(8).hex()
        request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args
            },
            "id": msg_id
        }

        # Send request
        writer.write(json.dumps(request).encode() + b'\n')
        await writer.drain()

        # Read response
        line = await reader.readline()
        response = json.loads(line.decode())

        if "error" in response:
            raise RuntimeError(f"MCP error: {response['error']}")

        return response.get("result")

    finally:
        writer.close()
        await writer.wait_closed()


def clean_output(result: Any) -> str:
    """Extract clean text from MCP result."""
    if isinstance(result, dict):
        if "content" in result:
            content = result["content"]
            if isinstance(content, list):
                texts = []
                for item in content:
                    if isinstance(item, dict) and "text" in item:
                        texts.append(item["text"])
                return "\n".join(texts) if texts else str(content)
        elif "text" in result:
            return result["text"]
    return str(result)


async def execute_command(cmd: str, cmd_args: Dict[str, Any]):
    """Execute a single command via daemon."""

    # Map commands to MCP tools
    tool_name = None
    tool_args = {}

    if cmd == "nav":
        tool_name = "navigate_page"
        tool_args = {"url": cmd_args["url"]}
    elif cmd == "snap":
        tool_name = "take_snapshot"
    elif cmd == "click":
        tool_name = "click"
        tool_args = {"uid": cmd_args["uid"]}
    elif cmd == "fill":
        tool_name = "fill"
        tool_args = {"uid": cmd_args["uid"], "value": cmd_args["value"]}
    elif cmd == "shot":
        tool_name = "take_screenshot"
        if "path" in cmd_args:
            tool_args["filePath"] = cmd_args["path"]
    elif cmd == "wait":
        tool_name = "wait_for"
        tool_args = {"text": cmd_args["text"]}
    elif cmd == "eval":
        tool_name = "evaluate_script"
        tool_args = {"function": cmd_args["function"]}
    elif cmd == "key":
        tool_name = "press_key"
        tool_args = {"key": cmd_args["key"]}
    elif cmd == "hover":
        tool_name = "hover"
        tool_args = {"uid": cmd_args["uid"]}
    elif cmd == "netlist":
        tool_name = "list_network_requests"
        if "resource_types" in cmd_args:
            tool_args["resourceTypes"] = cmd_args["resource_types"]
        if "page_size" in cmd_args:
            tool_args["pageSize"] = cmd_args["page_size"]
    elif cmd == "netget":
        tool_name = "get_network_request"
        if "reqid" in cmd_args:
            tool_args["reqid"] = cmd_args["reqid"]
    elif cmd == "conslist":
        tool_name = "list_console_messages"
        if "types" in cmd_args:
            tool_args["types"] = cmd_args["types"]
        if "page_size" in cmd_args:
            tool_args["pageSize"] = cmd_args["page_size"]
    elif cmd == "consget":
        tool_name = "get_console_message"
        tool_args = {"msgid": cmd_args["msgid"]}
    elif cmd == "resize":
        tool_name = "resize_page"
        tool_args = {"width": cmd_args["width"], "height": cmd_args["height"]}
    elif cmd == "dialog":
        tool_name = "handle_dialog"
        tool_args = {"action": cmd_args["action"]}
        if "prompt_text" in cmd_args:
            tool_args["promptText"] = cmd_args["prompt_text"]
    elif cmd == "upload":
        tool_name = "upload_file"
        tool_args = {"uid": cmd_args["uid"], "filePath": cmd_args["file_path"]}
    else:
        raise ValueError(f"Unknown command: {cmd}")

    # Send to daemon
    result = await send_command(tool_name, tool_args)
    return clean_output(result)


# ============================================================================
# CLI INTERFACE
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(
        prog="bt",
        description="Chrome DevTools MCP wrapper - persistent daemon mode",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
DAEMON MANAGEMENT:
  bt daemon start          Start persistent daemon + Chrome
  bt daemon stop           Stop daemon, kill Chrome cleanly
  bt daemon status         Check if daemon running

NAVIGATION:
  bt nav <url>             Navigate to URL
  bt wait <text>           Wait for text to appear (optional --timeout ms)

INSPECTION:
  bt snap                  Take a11y tree snapshot (get element UIDs)
                           IMPORTANT: Always use latest snapshot for UIDs
  bt shot [path]           Screenshot viewport (optional: save to path)
  bt eval <js>             Execute JavaScript, returns JSON
                           Example: "() => document.title"

INTERACTION:
  bt click <uid>           Click element by UID from snapshot
  bt fill <uid> <value>    Fill input/textarea or select option
  bt key <key>             Press key or combo
                           Examples: "Enter", "Tab", "Control+A", "Control+Shift+R"
  bt hover <uid>           Hover over element

DEBUGGING:
  bt conslist              List console messages (all types)
    --types error warn     Filter by type (log, error, warn, info, debug)
    --size N               Max messages to return

  bt consget <msgid>       Get console message details by ID

  bt netlist               List all network requests since navigation
    --types xhr fetch      Filter by resource type
    --size N               Max requests to return

  bt netget [reqid]        Get network request details (omit for latest)

PAGE MANIPULATION:
  bt resize <width> <height>        Resize viewport (pixels)
  bt dialog <accept|dismiss>        Handle alert/confirm/prompt
    --text <text>                   Text for prompt dialog
  bt upload <uid> <file_path>       Upload file through input element

EXAMPLES:
  # Login workflow
  bt daemon start
  bt nav http://app.com/login
  bt snap | grep email          # Find UIDs
  bt fill 1_23 user@example.com
  bt fill 1_24 password
  bt click 1_25                 # Submit
  bt wait Dashboard
  bt conslist --types error     # Check for errors
  bt shot /tmp/success.png
  bt daemon stop

  # Form validation
  bt snap
  bt fill 1_10 invalid-email
  bt click 1_15
  bt wait "Invalid email"
  bt conslist

IMPORTANT NOTES:
  - UIDs from snapshot only valid until page changes
  - Always take new snapshot after navigation/clicks that change DOM
  - Daemon maintains ALL state: snapshots, network, console logs
  - Stop daemon when done to clean up Chrome processes
        """
    )

    subparsers = parser.add_subparsers(dest="cmd", required=True)

    # Daemon management
    daemon = subparsers.add_parser("daemon", help="Manage daemon")
    daemon_sub = daemon.add_subparsers(dest="daemon_cmd", required=True)
    daemon_sub.add_parser("start", help="Start daemon")
    daemon_sub.add_parser("stop", help="Stop daemon")
    daemon_sub.add_parser("status", help="Check daemon status")

    # Browser commands
    nav = subparsers.add_parser("nav", help="Navigate to URL")
    nav.add_argument("url", help="URL to navigate to")

    subparsers.add_parser("snap", help="Take page snapshot")

    shot = subparsers.add_parser("shot", help="Take screenshot")
    shot.add_argument("path", nargs="?", help="Save path (optional)")

    click = subparsers.add_parser("click", help="Click element")
    click.add_argument("uid", help="Element UID from snapshot")

    fill = subparsers.add_parser("fill", help="Fill input")
    fill.add_argument("uid", help="Element UID")
    fill.add_argument("value", help="Value to fill")

    wait = subparsers.add_parser("wait", help="Wait for text")
    wait.add_argument("text", help="Text to wait for")

    eval_parser = subparsers.add_parser("eval", help="Execute JavaScript")
    eval_parser.add_argument("function", help="JS function to execute")

    # Keyboard & mouse
    key = subparsers.add_parser("key", help="Press keyboard key")
    key.add_argument("key", help="Key to press (e.g., 'Enter', 'Tab', 'Escape')")

    hover_parser = subparsers.add_parser("hover", help="Hover over element")
    hover_parser.add_argument("uid", help="Element UID from snapshot")

    # Network debugging
    netlist = subparsers.add_parser("netlist", help="List network requests")
    netlist.add_argument("--types", nargs="+", help="Filter by resource types")
    netlist.add_argument("--size", type=int, help="Max requests to return")

    netget = subparsers.add_parser("netget", help="Get network request details")
    netget.add_argument("reqid", nargs="?", type=int, help="Request ID (omit for latest)")

    # Console debugging
    conslist = subparsers.add_parser("conslist", help="List console messages")
    conslist.add_argument("--types", nargs="+", help="Filter by types (log, error, warn)")
    conslist.add_argument("--size", type=int, help="Max messages to return")

    consget = subparsers.add_parser("consget", help="Get console message details")
    consget.add_argument("msgid", type=int, help="Message ID")

    # Page manipulation
    resize = subparsers.add_parser("resize", help="Resize page viewport")
    resize.add_argument("width", type=int, help="Width in pixels")
    resize.add_argument("height", type=int, help="Height in pixels")

    dialog = subparsers.add_parser("dialog", help="Handle browser dialog (alert/confirm/prompt)")
    dialog.add_argument("action", choices=["accept", "dismiss"], help="Accept or dismiss dialog")
    dialog.add_argument("--text", dest="prompt_text", help="Text for prompt dialog")

    upload = subparsers.add_parser("upload", help="Upload file through element")
    upload.add_argument("uid", help="File input element UID")
    upload.add_argument("file_path", help="Local file path to upload")

    args = parser.parse_args()

    # Handle daemon commands
    if args.cmd == "daemon":
        if args.daemon_cmd == "start":
            if is_daemon_running():
                print("Daemon already running", file=sys.stderr)
                sys.exit(1)
            await run_daemon()

        elif args.daemon_cmd == "stop":
            pid = get_daemon_pid()
            if not pid:
                print("Daemon not running", file=sys.stderr)
                sys.exit(1)
            os.kill(pid, signal.SIGTERM)
            print(f"Stopped daemon (PID {pid})")

        elif args.daemon_cmd == "status":
            if is_daemon_running():
                print(f"Daemon running (PID {get_daemon_pid()})")
                print(f"Socket: {SOCKET_PATH}")
            else:
                print("Daemon not running")
        return

    # Execute browser command
    try:
        cmd_args_dict = {}

        if args.cmd == "nav":
            cmd_args_dict["url"] = args.url
        elif args.cmd == "click":
            cmd_args_dict["uid"] = args.uid
        elif args.cmd == "fill":
            cmd_args_dict["uid"] = args.uid
            cmd_args_dict["value"] = args.value
        elif args.cmd == "shot" and args.path:
            cmd_args_dict["path"] = args.path
        elif args.cmd == "wait":
            cmd_args_dict["text"] = args.text
        elif args.cmd == "eval":
            cmd_args_dict["function"] = args.function
        elif args.cmd == "key":
            cmd_args_dict["key"] = args.key
        elif args.cmd == "hover":
            cmd_args_dict["uid"] = args.uid
        elif args.cmd == "netlist":
            if args.types:
                cmd_args_dict["resource_types"] = args.types
            if args.size:
                cmd_args_dict["page_size"] = args.size
        elif args.cmd == "netget":
            if args.reqid:
                cmd_args_dict["reqid"] = args.reqid
        elif args.cmd == "conslist":
            if args.types:
                cmd_args_dict["types"] = args.types
            if args.size:
                cmd_args_dict["page_size"] = args.size
        elif args.cmd == "consget":
            cmd_args_dict["msgid"] = args.msgid
        elif args.cmd == "resize":
            cmd_args_dict["width"] = args.width
            cmd_args_dict["height"] = args.height
        elif args.cmd == "dialog":
            cmd_args_dict["action"] = args.action
            if args.prompt_text:
                cmd_args_dict["prompt_text"] = args.prompt_text
        elif args.cmd == "upload":
            cmd_args_dict["uid"] = args.uid
            cmd_args_dict["file_path"] = args.file_path

        output = await execute_command(args.cmd, cmd_args_dict)
        print(output)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
