#!/usr/bin/env python3
"""
Session Data Fetching Script - Simple passthrough for introspect API

Usage:
    python get_session_data.py --session-id <session_id>

Author: RafaelQuantum
Date: 2025-08-20
"""

import json
import sys
import argparse
import requests


def main():
    """Main entry point - just fetch and return raw JSON."""
    parser = argparse.ArgumentParser(
        description='Fetch session data from Claude Code observability API'
    )
    
    parser.add_argument(
        '--session-id',
        required=True,
        help='Session ID to fetch data for'
    )
    
    parser.add_argument(
        '--api-base',
        default='http://localhost:4000',
        help='Base API URL (default: http://localhost:4000)'
    )
    
    args = parser.parse_args()
    
    try:
        # Just fetch and return the raw data
        url = f"{args.api_base}/api/sessions/{args.session_id}/introspect"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            # Direct passthrough of the JSON
            print(json.dumps(response.json(), indent=2))
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
        error_data = {
            'error': f'Could not connect to API server at {args.api_base}',
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