#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
Session ID injection hook for Task tool calls.
Injects session context into subagent prompts.

Author: JennaVoid (based on implementation guide)
Purpose: Session Review System - Task Tool Session Injection
Phase: 06-SessionReviewAgent
"""

import json
import sys
import os

def main():
    try:
        # Read hook input
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        session_id = input_data.get('session_id', 'unknown')
        
        # Only process Task tool calls
        if tool_name == 'Task':
            original_prompt = tool_input.get('prompt', '')
            
            # Inject session ID into prompt
            enhanced_prompt = f"{original_prompt}\n\n[Session Context: {session_id}]"
            
            # Also add to description for visibility
            original_description = tool_input.get('description', '')
            enhanced_description = f"{original_description} (Session: {session_id})"
            
            # Return modified arguments
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "modifiedArgs": {
                        **tool_input,
                        "prompt": enhanced_prompt,
                        "description": enhanced_description
                    }
                }
            }
            print(json.dumps(output))
        
        sys.exit(0)
        
    except Exception as e:
        # Log error but don't block
        print(f"Session injection error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()