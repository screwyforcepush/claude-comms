#!/usr/bin/env python3
# UserPromptSubmit hook to inject context into the conversation

import json
import sys
# NOTE: this ONLY works for userPromptSubmit hook, no other hooks are supported.
def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract the user's prompt

        session_id = input_data.get('session_id', 'unknown')
        
        # Create additional context that will be injected
        additional_context = "Your session_id is: {session_id}"
        

        output = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": additional_context
            }
        }
        print(json.dumps(output))
        sys.exit(0)
        
    except Exception as e:
        # On error, show to user but don't block
        print(f"Error in UserPromptSubmit hook: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()