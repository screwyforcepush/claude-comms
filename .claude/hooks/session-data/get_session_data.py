#!/usr/bin/env python3
"""
Session Data Fetching Script for Claude Code Multi-Agent Observability

Fetches comprehensive session data from the observability API for analysis
by review agents. Provides both raw and formatted output options.

Usage:
    python get_session_data.py --session-id <session_id> [--json|--formatted]

Author: RafaelQuantum
Date: 2025-08-20
"""

import json
import sys
import re
import argparse
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List


def validate_session_id(session_id: Optional[str]) -> bool:
    """
    Validate session ID format.
    
    Args:
        session_id: Session ID to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not session_id or not isinstance(session_id, str):
        return False
    
    # Remove whitespace
    session_id = session_id.strip()
    
    # Check for empty or too long
    if not session_id or len(session_id) > 255:
        return False
    
    # Check for invalid characters (only allow alphanumeric, hyphens, underscores)
    if not re.match(r'^[a-zA-Z0-9_-]+$', session_id):
        return False
    
    return True


def fetch_session_data(session_id: str, api_base: str = "http://localhost:4000") -> Dict[str, Any]:
    """
    Fetch comprehensive session data from the API.
    
    Args:
        session_id: Session ID to fetch data for
        api_base: Base API URL
        
    Returns:
        Dictionary containing session data or error information
    """
    if not validate_session_id(session_id):
        return {
            'error': 'Invalid session ID format',
            'status_code': 400
        }
    
    try:
        # Construct API endpoint URL
        url = f"{api_base}/api/sessions/{session_id}/introspect"
        
        # Make request with timeout
        response = requests.get(url, timeout=10)
        
        # Handle different status codes
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Ensure required structure exists
                if not isinstance(data, dict):
                    return {
                        'error': 'Invalid response format from API',
                        'status_code': 200
                    }
                
                # Ensure required fields with defaults
                session_data = {
                    'session_id': data.get('session_id', session_id),
                    'events': data.get('events', []),
                    'agents': data.get('agents', []),
                    'messages': data.get('messages', []),
                    'metadata': data.get('metadata', {}),
                    'status': 'success',
                    'fetched_at': int(datetime.now().timestamp() * 1000)
                }
                
                return session_data
                
            except json.JSONDecodeError as e:
                return {
                    'error': f'Failed to parse JSON response: {str(e)}',
                    'status_code': response.status_code
                }
        
        elif response.status_code == 404:
            return {
                'error': 'Session not found',
                'status_code': 404,
                'session_id': session_id
            }
        
        elif response.status_code == 500:
            return {
                'error': 'Internal server error',
                'status_code': 500
            }
        
        elif response.status_code == 503:
            return {
                'error': 'Service unavailable',
                'status_code': 503
            }
        
        else:
            return {
                'error': f'API returned status {response.status_code}',
                'status_code': response.status_code
            }
            
    except requests.exceptions.ConnectionError as e:
        return {
            'error': f'Connection error: Could not connect to API server at {api_base}',
            'status_code': 0,
            'details': str(e)
        }
    
    except requests.exceptions.Timeout:
        return {
            'error': 'Request timeout: API server did not respond within 10 seconds',
            'status_code': 0
        }
    
    except Exception as e:
        return {
            'error': f'Unexpected error: {str(e)}',
            'status_code': 0
        }


def format_session_data_for_review(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format session data for consumption by review agents.
    
    Args:
        session_data: Raw session data from API
        
    Returns:
        Formatted data structure optimized for review analysis
    """
    events = session_data.get('events', [])
    agents = session_data.get('agents', [])
    messages = session_data.get('messages', [])
    metadata = session_data.get('metadata', {})
    
    # Calculate performance metrics
    total_duration = sum(agent.get('total_duration_ms', 0) for agent in agents)
    total_tokens = sum(agent.get('total_tokens', 0) for agent in agents)
    
    # Analyze errors
    error_events = [e for e in events if 'error' in e.get('hook_event_type', '').lower()]
    
    # Agent status analysis
    completed_agents = [a for a in agents if a.get('status') == 'completed']
    failed_agents = [a for a in agents if a.get('status') == 'failed']
    
    formatted = {
        'session_summary': {
            'session_id': session_data.get('session_id'),
            'total_events': len(events),
            'total_agents': len(agents),
            'total_messages': len(messages),
            'start_time': metadata.get('start_time'),
            'end_time': metadata.get('end_time'),
            'duration_ms': metadata.get('duration_ms', total_duration)
        },
        
        'performance_metrics': {
            'total_duration_ms': total_duration,
            'total_tokens': total_tokens,
            'agent_count': len(agents),
            'event_count': len(events),
            'message_count': len(messages),
            'avg_tokens_per_agent': total_tokens / len(agents) if agents else 0,
            'avg_duration_per_agent': total_duration / len(agents) if agents else 0
        },
        
        'error_analysis': {
            'error_count': len(error_events),
            'error_rate': len(error_events) / len(events) if events else 0,
            'error_types': list(set(e.get('hook_event_type', '') for e in error_events)),
            'failed_agents': len(failed_agents)
        },
        
        'agent_coordination': {
            'completion_rate': len(completed_agents) / len(agents) if agents else 0,
            'message_to_agent_ratio': len(messages) / len(agents) if agents else 0,
            'agent_statuses': {
                'completed': len(completed_agents),
                'failed': len(failed_agents),
                'other': len(agents) - len(completed_agents) - len(failed_agents)
            }
        },
        
        'raw_data': session_data  # Include raw data for detailed analysis
    }
    
    return formatted


def format_human_readable(session_data: Dict[str, Any]) -> str:
    """
    Format session data for human-readable output.
    
    Args:
        session_data: Session data dictionary
        
    Returns:
        Human-readable formatted string
    """
    if 'error' in session_data:
        return f"Error: {session_data['error']}\nStatus Code: {session_data['status_code']}"
    
    events = session_data.get('events', [])
    agents = session_data.get('agents', [])
    messages = session_data.get('messages', [])
    metadata = session_data.get('metadata', {})
    
    output = []
    output.append(f"Session: {session_data.get('session_id', 'Unknown')}")
    output.append(f"Status: {session_data.get('status', 'Unknown')}")
    output.append(f"Fetched: {datetime.fromtimestamp(session_data.get('fetched_at', 0) / 1000)}")
    output.append("")
    
    # Summary statistics
    output.append("Summary Statistics:")
    output.append(f"  Events: {len(events)}")
    output.append(f"  Agents: {len(agents)}")
    output.append(f"  Messages: {len(messages)}")
    
    if metadata:
        output.append("  Duration: {} ms".format(metadata.get('duration_ms', 'Unknown')))
    output.append("")
    
    # Agent details
    if agents:
        output.append("Agents:")
        for agent in agents[:5]:  # Show first 5 agents
            status = agent.get('status', 'unknown')
            duration = agent.get('total_duration_ms', 0)
            tokens = agent.get('total_tokens', 0)
            output.append(f"  - {agent.get('name', 'Unknown')} ({status}) - {duration}ms, {tokens} tokens")
        
        if len(agents) > 5:
            output.append(f"  ... and {len(agents) - 5} more agents")
        output.append("")
    
    # Recent events
    if events:
        output.append("Recent Events:")
        for event in events[-5:]:  # Show last 5 events
            event_type = event.get('hook_event_type', 'Unknown')
            timestamp = event.get('timestamp', 0)
            dt = datetime.fromtimestamp(timestamp / 1000) if timestamp else "Unknown"
            output.append(f"  - {event_type} at {dt}")
        output.append("")
    
    return "\n".join(output)


def main():
    """Main entry point for command line interface."""
    parser = argparse.ArgumentParser(
        description='Fetch session data from Claude Code observability API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --session-id session-123 --json
  %(prog)s --session-id session-123 --formatted
        """
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
    
    output_group = parser.add_mutually_exclusive_group()
    output_group.add_argument(
        '--json',
        action='store_true',
        help='Output raw JSON data'
    )
    output_group.add_argument(
        '--formatted',
        action='store_true',
        help='Output human-readable formatted data'
    )
    
    args = parser.parse_args()
    
    # Validate session ID
    if not validate_session_id(args.session_id):
        print("Error: Invalid session ID format", file=sys.stderr)
        print("Session ID must contain only letters, numbers, hyphens, and underscores", file=sys.stderr)
        sys.exit(1)
    
    # Fetch session data
    session_data = fetch_session_data(args.session_id, args.api_base)
    
    # Handle errors
    if 'error' in session_data:
        error_msg = f"Failed to fetch session data: {session_data['error']}"
        if session_data.get('status_code'):
            error_msg += f" (HTTP {session_data['status_code']})"
        print(error_msg, file=sys.stderr)
        sys.exit(1)
    
    # Output data in requested format
    if args.formatted:
        print(format_human_readable(session_data))
    elif args.json:
        # Raw JSON output
        print(json.dumps(session_data, indent=2))
    else:
        # Default: Formatted for review agent consumption but include session_id at top level
        formatted_data = format_session_data_for_review(session_data)
        print(json.dumps(formatted_data, indent=2))
    
    sys.exit(0)


if __name__ == '__main__':
    main()