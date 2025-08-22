#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
PreToolUse hook to intercept Bash calls to './getCurrentSessionId.sh' and block
with exit(2) returning the session ID. This enables session introspection by
subagents without requiring actual shell script execution.

Author: AlexStorm
Purpose: Session Review System - Hook Infrastructure
Phase: 06-SessionReviewAgent
"""

import json
import sys
import os


def main():
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract tool information
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        session_id = input_data.get('session_id', 'unknown')
        
        # Only intercept Bash tool calls
        if tool_name != 'Bash':
            # Let all other tools pass through
            sys.exit(0)
        
        # Get the command from the tool input
        command = tool_input.get('command', '').strip()
        
        # Check if this is a call to getCurrentSessionId.sh
        # Support different invocation patterns:
        # - ./getCurrentSessionId.sh
        # - bash getCurrentSessionId.sh
        # - sh getCurrentSessionId.sh  
        # - /path/to/getCurrentSessionId.sh
        if ('getCurrentSessionId.sh' in command):
            
            # This is the command we want to intercept!
            # Block the execution and return session ID via stderr (exit 2 pattern)
            session_message = f"Session ID: {session_id}"
            
            # Exit with code 2 to block the tool call and provide the session ID
            # According to the hook documentation, exit code 2 feeds stderr back to Claude
            print(session_message, file=sys.stderr)
            sys.exit(2)
        
        # For all other bash commands, let them pass through normally
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input in session ID interceptor: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # Log error but don't block other commands
        print(f"Error in session ID interceptor: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()