#!/usr/bin/env python3

import json
import sys
import requests
import argparse
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.server_config import get_server_url

def send_message(sender_name, message):
    """
    Send a message from a subagent to all other subagents.
    
    Args:
        sender_name: The name/nickname of the sending subagent
        message: The message to send (can be string or dict)
    
    Returns:
        True if message was sent successfully, False otherwise
    """
    try:
        # Parse message if it's a JSON string
        if isinstance(message, str):
            try:
                message = json.loads(message)
            except json.JSONDecodeError:
                # Keep as string if not valid JSON
                pass
        
        response = requests.post(
            f'{get_server_url()}/subagents/message',
            json={
                'sender': sender_name,
                'message': message
            },
            timeout=5
        )
        
        if response.status_code == 200:
            return True
        else:
            print(f"Error: Server returned status {response.status_code}", file=sys.stderr)
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to observability server at {get_server_url()}", file=sys.stderr)
        return False
    except requests.exceptions.Timeout:
        print("Error: Request timed out", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description='Send a message from a subagent')
    parser.add_argument('--sender', required=True, help='Sender subagent name/nickname')
    parser.add_argument('--message', required=True, help='Message to send (string or JSON)')
    parser.add_argument('--type', help='Message type (optional)')
    parser.add_argument('--data', help='Additional data (JSON format)')
    
    args = parser.parse_args()
    
    # Build message structure if type is provided
    if args.type:
        message = {
            'type': args.type,
            'content': args.message
        }
        if args.data:
            try:
                message['data'] = json.loads(args.data)
            except json.JSONDecodeError:
                message['data'] = args.data
    else:
        message = args.message
    
    success = send_message(args.sender, message)
    
    if success:
        print("Message sent successfully")
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()