#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "requests",
# ]
# ///

import json
import sys
import requests


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        session_id = input_data.get('session_id', 'unknown')
        
        # Check if this is a Task tool use and register the subagent
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        
        if tool_name == 'Task':
            description = tool_input.get('description', '')
            subagent_type = tool_input.get('subagent_type', '')
            
            # Extract nickname from description (part before colon)
            if ':' in description:
                nickname = description.split(':')[0].strip()
                
                # Register the subagent with the server
                try:
                    response = requests.post(
                        'http://localhost:4000/subagents/register',
                        json={
                            'session_id': session_id,
                            'name': nickname,
                            'subagent_type': subagent_type
                        },
                        timeout=2
                    )
                    if response.status_code == 200:
                        print(f"Registered subagent: {nickname} ({subagent_type})", file=sys.stderr)
                except Exception as e:
                    # Silently fail if server is not available
                    pass
        
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Gracefully handle JSON decode errors
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)

if __name__ == '__main__':
    main()