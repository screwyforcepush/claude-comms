#!/usr/bin/env python3
"""
Session Data Fetching Script - Token-based pagination for introspect API

Usage:
    python get_session_data.py --session-id <session_id> [--page <page_number>]

Author: RafaelQuantum
Date: 2025-08-20
"""

import json
import sys
import argparse
import requests
import time
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.server_config import get_server_url

# Maximum tokens per page (easily configurable)
MAX_TOKENS_PER_PAGE = 6000

try:
    import tiktoken
except ImportError:
    print("Error: tiktoken not installed. Run: pip install tiktoken", file=sys.stderr)
    sys.exit(1)


def count_tokens(json_object, encoding):
    """
    Count tokens for a JSON object.
    Converts object to JSON string and counts tokens.
    """
    json_str = json.dumps(json_object, separators=(',', ':'))
    return len(encoding.encode(json_str))


def paginate_timeline(timeline, page, max_tokens=MAX_TOKENS_PER_PAGE):
    """
    Paginate timeline messages into chunks that fit within max_tokens.
    Returns the messages for the requested page or None if out of range.
    Uses tiktoken for accurate token counting, including JSON structure overhead.
    """
    if not timeline:
        return timeline if page == 1 else None
    
    # Get the encoding for token counting (cl100k_base for GPT-3.5/4)
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
    except Exception as e:
        print(f"Error initializing tiktoken: {e}", file=sys.stderr)
        # Fallback to character-based if tiktoken fails
        return paginate_timeline_fallback(timeline, page)
    
    # Calculate overhead for the JSON structure
    # {"sessionId": "...", "timeline": [...], "page": N}
    session_id = "8d90abf7-bd33-4367-985c-b5acb886a63a"  # Example ID for overhead calculation
    overhead_json = {
        "sessionId": session_id,
        "timeline": [],
        "page": 1
    }
    overhead_tokens = len(encoding.encode(json.dumps(overhead_json, separators=(',', ':'))))
    
    pages = []
    current_page = []
    current_tokens = overhead_tokens  # Start with JSON structure overhead
    
    for message in timeline:
        message_tokens = count_tokens(message, encoding)
        # Add tokens for comma separator if not first message
        separator_tokens = 1 if current_page else 0
        
        # Check if adding this message would exceed the limit
        total_with_message = current_tokens + separator_tokens + message_tokens
        
        if total_with_message > max_tokens:
            if current_page:
                # Save current page and start new one
                pages.append(current_page)
                current_page = [message]
                current_tokens = overhead_tokens + message_tokens
            else:
                # Single message exceeds limit, but we need to include it
                current_page = [message]
                current_tokens = overhead_tokens + message_tokens
        else:
            # Add to current page (within limit)
            current_page.append(message)
            current_tokens = total_with_message
    
    # Add the last page if it has content
    if current_page:
        pages.append(current_page)
    
    # Return requested page or None if out of range
    if page > 0 and page <= len(pages):
        return pages[page - 1]
    else:
        return None


def get_total_pages(timeline, max_tokens=MAX_TOKENS_PER_PAGE):
    """
    Calculate total number of pages by checking when paginate returns None.
    """
    if not timeline:
        return 1
    
    page = 1
    while paginate_timeline(timeline, page, max_tokens) is not None:
        page += 1
    
    return page - 1


def paginate_timeline_fallback(timeline, page, max_chars=30000):
    """
    Fallback character-based pagination if tiktoken is unavailable.
    """
    if not timeline:
        return timeline if page == 1 else None
    
    pages = []
    current_page = []
    current_size = 100
    
    for message in timeline:
        message_json = json.dumps(message, indent=2)
        message_size = len(message_json) + 5
        
        if current_size + message_size > max_chars and current_page:
            pages.append(current_page)
            current_page = [message]
            current_size = 100 + message_size
        else:
            current_page.append(message)
            current_size += message_size
    
    if current_page:
        pages.append(current_page)
    
    if page > 0 and page <= len(pages):
        return pages[page - 1]
    else:
        return None


def main():
    """Main entry point - fetch and return paginated JSON."""
    parser = argparse.ArgumentParser(
        description='Fetch session data from Claude Code observability API with pagination'
    )
    
    parser.add_argument(
        '--session-id',
        required=True,
        help='Session ID to fetch data for'
    )
    
    parser.add_argument(
        '--page',
        type=int,
        default=1,
        help='Page number to fetch (default: 1)'
    )
    
    parser.add_argument(
        '--total-pages',
        action='store_true',
        help='Return only the total number of pages instead of page data'
    )
    
    args = parser.parse_args()
    
    # Wait 100ms per page before hitting the DB (as requested)
    if args.page > 1:
        time.sleep(args.page * 0.1)
    
    try:
        # Fetch the data from API
        api_base = get_server_url()
        url = f"{api_base}/api/sessions/{args.session_id}/introspect"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # If --total-pages flag is set, return only the total page count
            if args.total_pages:
                if 'timeline' in data and data['timeline']:
                    total = get_total_pages(data['timeline'])
                    print(total)
                else:
                    print(1)
                sys.exit(0)
            
            # Handle pagination if timeline exists
            if 'timeline' in data and data['timeline']:
                paginated_timeline = paginate_timeline(data['timeline'], args.page)
                
                if paginated_timeline is None:
                    # Page out of range
                    print("//end")
                    sys.exit(0)
                else:
                    # Return paginated data
                    paginated_data = {
                        'sessionId': data.get('sessionId'),
                        'timeline': paginated_timeline,
                        'page': args.page
                    }
                    print(json.dumps(paginated_data, indent=2))
                    sys.exit(0)
            else:
                # No timeline or empty timeline
                if args.page == 1:
                    print(json.dumps(data, indent=2))
                else:
                    print("//end")
                sys.exit(0)
        else:
            # Error case
            error_data = {
                'error': f'API returned status {response.status_code}',
                'status_code': response.status_code,
                'session_id': args.session_id
            }
            print(json.dumps(error_data, indent=2), file=sys.stderr)
            sys.exit(1)
            
    except requests.exceptions.ConnectionError:
        api_base = get_server_url()
        error_data = {
            'error': f'Could not connect to API server at {api_base}',
            'status_code': 0
        }
        print(json.dumps(error_data, indent=2), file=sys.stderr)
        sys.exit(1)
    
    except requests.exceptions.Timeout:
        error_data = {
            'error': 'Request timeout',
            'status_code': 0
        }
        print(json.dumps(error_data, indent=2), file=sys.stderr)
        sys.exit(1)
    
    except Exception as e:
        error_data = {
            'error': f'Unexpected error: {str(e)}',
            'status_code': 0
        }
        print(json.dumps(error_data, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()