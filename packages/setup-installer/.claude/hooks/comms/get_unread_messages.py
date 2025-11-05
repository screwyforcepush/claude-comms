#!/usr/bin/env python3

import json
import sys
import requests
import argparse
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.server_config import get_server_url

def get_unread_messages(subagent_name):
    """
    Get unread messages for a specific subagent.
    
    Args:
        subagent_name: The name/nickname of the subagent requesting messages
    
    Returns:
        List of unread messages with sender, message, and timestamp
    """
    try:
        response = requests.post(
            f'{get_server_url()}/subagents/unread',
            json={
                'subagent_name': subagent_name
            },
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('messages', [])
        else:
            print(f"Error: Server returned status {response.status_code}", file=sys.stderr)
            return []
            
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to observability server at {get_server_url()}", file=sys.stderr)
        return []
    except requests.exceptions.Timeout:
        print("Error: Request timed out", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return []

def main():
    parser = argparse.ArgumentParser(description='Get unread messages for a subagent')
    parser.add_argument('--name', required=True, help='Subagent name/nickname')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    
    messages = get_unread_messages(args.name)
    
    if args.json:
        print(json.dumps(messages, indent=2))
    else:
        if not messages:
            print("No unread messages")
        else:
            print(f"Found {len(messages)} unread message(s):")
            print("-" * 50)
            for msg in messages:
                print(f"From: {msg['sender']}")
                print(f"Time: {msg['created_at']}")
                print(f"Message: {json.dumps(msg['message'], indent=2)}")
                print("-" * 50)

if __name__ == '__main__':
    main()