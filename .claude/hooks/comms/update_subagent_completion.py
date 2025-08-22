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
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.server_config import get_server_url


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        session_id = input_data.get('session_id', 'unknown')
        
        # Check if this is a Task tool use completion
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        tool_response = input_data.get('tool_response', {})
        
        if tool_name == 'Task':
            description = tool_input.get('description', '')
            
            # Extract agent name from description (part before colon)
            if ':' in description:
                agent_name = description.split(':')[0].strip()
                
                # Extract completion metadata from tool_response
                completion_metadata = {}
                
                # Get duration, tokens, and tool use count from tool_response
                if 'totalDurationMs' in tool_response:
                    completion_metadata['total_duration_ms'] = tool_response['totalDurationMs']
                
                if 'totalTokens' in tool_response:
                    completion_metadata['total_tokens'] = tool_response['totalTokens']
                
                if 'totalToolUseCount' in tool_response:
                    completion_metadata['total_tool_use_count'] = tool_response['totalToolUseCount']
                
                # Get usage details if available
                usage = tool_response.get('usage', {})
                if usage:
                    if 'input_tokens' in usage:
                        completion_metadata['input_tokens'] = usage['input_tokens']
                    
                    if 'output_tokens' in usage:
                        completion_metadata['output_tokens'] = usage['output_tokens']
                    
                    if 'cache_creation_input_tokens' in usage:
                        completion_metadata['cache_creation_input_tokens'] = usage['cache_creation_input_tokens']
                    
                    if 'cache_read_input_tokens' in usage:
                        completion_metadata['cache_read_input_tokens'] = usage['cache_read_input_tokens']
                
                # Extract the agent's final response content
                # The response content is typically in the main tool_response as text
                final_response = ''
                if 'content' in tool_response:
                    # If content is a list (standard Claude format)
                    if isinstance(tool_response['content'], list):
                        text_blocks = [block.get('text', '') for block in tool_response['content'] if block.get('type') == 'text']
                        final_response = '\n'.join(text_blocks)
                    # If content is a string
                    elif isinstance(tool_response['content'], str):
                        final_response = tool_response['content']
                elif 'text' in tool_response:
                    # Alternative field name
                    final_response = tool_response['text']
                elif 'response' in tool_response:
                    # Another possible field name
                    final_response = tool_response['response']
                
                # Extract tool calls if available
                tool_calls_data = []
                if 'tool_calls' in tool_response:
                    tool_calls_data = tool_response['tool_calls']
                elif 'toolCalls' in tool_response:
                    tool_calls_data = tool_response['toolCalls']
                
                # Update subagent completion status
                try:
                    response = requests.post(
                        f'{get_server_url()}/subagents/update-completion',
                        json={
                            'session_id': session_id,
                            'name': agent_name,
                            'status': 'completed',
                            'completed_at': None,  # Will be set to current time by server
                            'completion_metadata': completion_metadata,
                            'final_response': final_response,
                            'tool_calls': tool_calls_data
                        },
                        timeout=2
                    )
                    if response.status_code == 200:
                        print(f"Updated completion for subagent: {agent_name}", file=sys.stderr)
                    elif response.status_code == 404:
                        # Agent not found, silently ignore (might be a direct Task not created by subagent)
                        pass
                    else:
                        # Other error, log but don't fail
                        print(f"Failed to update completion for {agent_name}: {response.status_code}", file=sys.stderr)
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