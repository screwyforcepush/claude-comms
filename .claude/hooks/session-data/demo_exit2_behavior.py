#!/usr/bin/env python3
"""
Demo script showing how the exit(2) mechanism works for blocking Bash calls
and returning session ID information to Claude Code.

This simulates how Claude Code would see the hook behavior.
"""

import json
import subprocess
import sys

def simulate_claude_code_hook_call(command, session_id="demo-session-123"):
    """
    Simulates how Claude Code calls the PreToolUse hook when a Bash command is executed.
    """
    print(f"🔧 Simulating Claude Code calling PreToolUse hook for command: {command}")
    print(f"📍 Session ID: {session_id}")
    print("-" * 60)
    
    # Prepare hook input (this is what Claude Code sends to the hook)
    hook_input = {
        "session_id": session_id,
        "transcript_path": "/path/to/session/transcript.jsonl",
        "cwd": "/current/working/directory", 
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {
            "command": command,
            "description": f"Execute: {command}"
        }
    }
    
    print("📨 Hook Input:")
    print(json.dumps(hook_input, indent=2))
    print()
    
    # Call the hook
    result = subprocess.run([
        "python3",
        "/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/.claude/hooks/session-data/intercept_session_id.py"
    ],
    input=json.dumps(hook_input),
    capture_output=True,
    text=True
    )
    
    # Show results
    print("📤 Hook Result:")
    print(f"Exit Code: {result.returncode}")
    print(f"Stdout: '{result.stdout}'")
    print(f"Stderr: '{result.stderr}'")
    print()
    
    # Interpret results as Claude Code would
    if result.returncode == 0:
        print("✅ Claude Code Behavior: Tool call PROCEEDS normally")
        if result.stdout:
            print(f"   User sees (transcript mode): {result.stdout}")
    elif result.returncode == 2:
        print("🚫 Claude Code Behavior: Tool call BLOCKED")
        print("   Claude receives the stderr content as feedback:")
        print(f"   → '{result.stderr.strip()}'")
        print("   Claude can then process this information automatically")
    else:
        print(f"⚠️  Claude Code Behavior: Non-blocking error (exit {result.returncode})")
        print(f"   User sees error: {result.stderr}")
        print("   Tool call continues anyway")
    
    print("=" * 60)
    return result

def main():
    print("🎭 Demonstrating intercept_session_id.py Hook Behavior")
    print("=" * 60)
    print("This shows how the hook blocks getCurrentSessionId.sh calls")
    print("and returns session IDs using the exit(2) mechanism.")
    print()
    
    # Test 1: Intercepted command
    print("TEST 1: Command that should be intercepted")
    simulate_claude_code_hook_call("./getCurrentSessionId.sh", "live-session-456")
    print()
    
    # Test 2: Normal command that passes through
    print("TEST 2: Command that should pass through normally")
    simulate_claude_code_hook_call("ls -la /tmp", "live-session-456")
    print()
    
    # Test 3: Another intercepted variant
    print("TEST 3: Another intercepted variant")
    simulate_claude_code_hook_call("bash getCurrentSessionId.sh", "live-session-789")
    print()
    
    print("💡 Summary:")
    print("- Exit code 0: Tool proceeds normally")
    print("- Exit code 2: Tool blocked, stderr sent to Claude for processing")
    print("- Other exit codes: Error shown to user, tool proceeds")
    print()
    print("🎯 For getCurrentSessionId.sh calls:")
    print("- Claude receives 'Session ID: <session_id>' via stderr")
    print("- Claude can then use this information in its response")
    print("- The actual shell command never executes")

if __name__ == '__main__':
    main()