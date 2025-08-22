#!/usr/bin/env python3
"""
Utility module to get the communication server URL from environment variable.
Falls back to default if not set.
"""

import os

def get_server_url():
    """
    Get the communication server URL from CLAUDE_COMMS_SERVER environment variable.
    Falls back to http://localhost:4000 if not set.
    
    Returns:
        str: The server URL
    """
    return os.environ.get('CLAUDE_COMMS_SERVER', 'http://localhost:4000')