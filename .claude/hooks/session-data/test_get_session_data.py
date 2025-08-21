#!/usr/bin/env python3
"""
Test suite for get_session_data.py
Following TDD principles - tests written BEFORE implementation
"""

import unittest
import json
import sys
import os
from unittest.mock import patch, MagicMock
from io import StringIO

# Add the session-data directory to path for importing
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Mock import since we haven't created the module yet
try:
    import get_session_data
except ImportError:
    # Create a placeholder module for testing
    get_session_data = type('MockModule', (), {})()


class TestGetSessionData(unittest.TestCase):
    """Test cases for session data fetching functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.valid_session_id = "test-session-123"
        self.api_base = "http://localhost:4000"
        
        # Mock successful response data
        self.mock_session_data = {
            "session_id": self.valid_session_id,
            "events": [
                {
                    "id": 1,
                    "hook_event_type": "PreToolUse",
                    "timestamp": 1692518400000,
                    "payload": {"tool_name": "Bash"}
                },
                {
                    "id": 2,
                    "hook_event_type": "PostToolUse", 
                    "timestamp": 1692518405000,
                    "payload": {"tool_name": "Bash"}
                }
            ],
            "agents": [
                {
                    "name": "TestAgent",
                    "status": "completed",
                    "total_duration_ms": 5000,
                    "total_tokens": 1500
                }
            ],
            "messages": [
                {
                    "sender": "TestAgent",
                    "message": "Task completed",
                    "created_at": "2023-08-20T12:00:00Z"
                }
            ],
            "metadata": {
                "start_time": 1692518400000,
                "end_time": 1692518405000,
                "duration_ms": 5000
            }
        }

    def test_fetch_session_data_success(self):
        """Test successful session data fetching"""
        if not hasattr(get_session_data, 'fetch_session_data'):
            self.skipTest("Implementation not yet created")
            
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = self.mock_session_data
            mock_get.return_value = mock_response
            
            result = get_session_data.fetch_session_data(self.valid_session_id)
            
            # Verify API call
            mock_get.assert_called_once_with(
                f"{self.api_base}/api/sessions/{self.valid_session_id}/introspect",
                timeout=10
            )
            
            # Verify response structure
            self.assertEqual(result['session_id'], self.valid_session_id)
            self.assertIn('events', result)
            self.assertIn('agents', result)
            self.assertIn('messages', result)
            self.assertIn('metadata', result)

    def test_fetch_session_data_api_error(self):
        """Test handling of API errors (404, 500, etc.)"""
        if not hasattr(get_session_data, 'fetch_session_data'):
            self.skipTest("Implementation not yet created")
            
        test_cases = [
            (404, "Session not found"),
            (500, "Internal server error"),
            (503, "Service unavailable")
        ]
        
        for status_code, expected_error in test_cases:
            with self.subTest(status_code=status_code):
                with patch('requests.get') as mock_get:
                    mock_response = MagicMock()
                    mock_response.status_code = status_code
                    mock_get.return_value = mock_response
                    
                    result = get_session_data.fetch_session_data(self.valid_session_id)
                    
                    # Should return error structure
                    self.assertIn('error', result)
                    self.assertIn('status_code', result)
                    self.assertEqual(result['status_code'], status_code)

    def test_fetch_session_data_connection_error(self):
        """Test handling of connection errors"""
        if not hasattr(get_session_data, 'fetch_session_data'):
            self.skipTest("Implementation not yet created")
            
        import requests
        
        with patch('requests.get', side_effect=requests.exceptions.ConnectionError("Connection refused")):
            result = get_session_data.fetch_session_data(self.valid_session_id)
            
            # Should return connection error structure
            self.assertIn('error', result)
            self.assertIn('Connection', result['error'])
            self.assertEqual(result['status_code'], 0)  # Connection error code

    def test_fetch_session_data_timeout(self):
        """Test handling of request timeout"""
        if not hasattr(get_session_data, 'fetch_session_data'):
            self.skipTest("Implementation not yet created")
            
        import requests
        
        with patch('requests.get', side_effect=requests.exceptions.Timeout("Request timed out")):
            result = get_session_data.fetch_session_data(self.valid_session_id)
            
            # Should return timeout error structure
            self.assertIn('error', result)
            self.assertIn('timeout', result['error'].lower())
            self.assertEqual(result['status_code'], 0)

    def test_fetch_session_data_invalid_json(self):
        """Test handling of invalid JSON response"""
        if not hasattr(get_session_data, 'fetch_session_data'):
            self.skipTest("Implementation not yet created")
            
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
            mock_get.return_value = mock_response
            
            result = get_session_data.fetch_session_data(self.valid_session_id)
            
            # Should return JSON parse error
            self.assertIn('error', result)
            self.assertIn('JSON', result['error'])

    def test_format_session_data_for_review(self):
        """Test formatting of session data for review agent consumption"""
        if not hasattr(get_session_data, 'format_session_data_for_review'):
            self.skipTest("Implementation not yet created")
            
        formatted = get_session_data.format_session_data_for_review(self.mock_session_data)
        
        # Should have required structure for review agent
        self.assertIn('session_summary', formatted)
        self.assertIn('performance_metrics', formatted)
        self.assertIn('error_analysis', formatted)
        self.assertIn('agent_coordination', formatted)
        
        # Check performance metrics calculation
        metrics = formatted['performance_metrics']
        self.assertIn('total_duration_ms', metrics)
        self.assertIn('total_tokens', metrics)
        self.assertIn('agent_count', metrics)
        self.assertIn('event_count', metrics)

    def test_validate_session_id_format(self):
        """Test session ID validation"""
        if not hasattr(get_session_data, 'validate_session_id'):
            self.skipTest("Implementation not yet created")
            
        # Valid session IDs
        valid_ids = [
            "test-session-123",
            "session_456",
            "valid-session-id-789",
            "abc123def456"
        ]
        
        for session_id in valid_ids:
            with self.subTest(session_id=session_id):
                self.assertTrue(get_session_data.validate_session_id(session_id))
        
        # Invalid session IDs
        invalid_ids = [
            "",
            None,
            "   ",
            "session with spaces",
            "session\nwith\nnewlines",
            "session/with/slashes",
            "a" * 256  # Too long
        ]
        
        for session_id in invalid_ids:
            with self.subTest(session_id=session_id):
                self.assertFalse(get_session_data.validate_session_id(session_id))

    def test_cli_interface_success(self):
        """Test command line interface with valid session ID"""
        if not hasattr(get_session_data, 'main'):
            self.skipTest("Implementation not yet created")
            
        test_args = ['get_session_data.py', '--session-id', self.valid_session_id]
        
        with patch.object(sys, 'argv', test_args):
            with patch.object(get_session_data, 'fetch_session_data') as mock_fetch:
                with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
                    mock_fetch.return_value = self.mock_session_data
                    
                    try:
                        get_session_data.main()
                    except SystemExit as e:
                        self.assertEqual(e.code, 0)
                    
                    output = mock_stdout.getvalue()
                    output_data = json.loads(output)
                    
                    # Verify JSON output structure (formatted data has session_id in session_summary)
                    self.assertEqual(output_data['session_summary']['session_id'], self.valid_session_id)

    def test_cli_interface_missing_session_id(self):
        """Test command line interface without session ID argument"""
        if not hasattr(get_session_data, 'main'):
            self.skipTest("Implementation not yet created")
            
        test_args = ['get_session_data.py']
        
        with patch.object(sys, 'argv', test_args):
            with patch('sys.stderr', new_callable=StringIO) as mock_stderr:
                with self.assertRaises(SystemExit) as cm:
                    get_session_data.main()
                
                self.assertNotEqual(cm.exception.code, 0)
                error_output = mock_stderr.getvalue()
                self.assertIn('session-id', error_output)

    def test_cli_interface_api_error(self):
        """Test command line interface with API error"""
        if not hasattr(get_session_data, 'main'):
            self.skipTest("Implementation not yet created")
            
        test_args = ['get_session_data.py', '--session-id', self.valid_session_id]
        
        with patch.object(sys, 'argv', test_args):
            with patch.object(get_session_data, 'fetch_session_data') as mock_fetch:
                with patch('sys.stderr', new_callable=StringIO) as mock_stderr:
                    mock_fetch.return_value = {
                        'error': 'Session not found',
                        'status_code': 404
                    }
                    
                    with self.assertRaises(SystemExit) as cm:
                        get_session_data.main()
                    
                    self.assertNotEqual(cm.exception.code, 0)
                    error_output = mock_stderr.getvalue()
                    self.assertIn('Session not found', error_output)

    def test_json_output_flag(self):
        """Test --json output format flag"""
        if not hasattr(get_session_data, 'main'):
            self.skipTest("Implementation not yet created")
            
        test_args = ['get_session_data.py', '--session-id', self.valid_session_id, '--json']
        
        with patch.object(sys, 'argv', test_args):
            with patch.object(get_session_data, 'fetch_session_data') as mock_fetch:
                with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
                    mock_fetch.return_value = self.mock_session_data
                    
                    try:
                        get_session_data.main()
                    except SystemExit as e:
                        self.assertEqual(e.code, 0)
                    
                    output = mock_stdout.getvalue()
                    # Should be valid JSON
                    json.loads(output)

    def test_formatted_output_flag(self):
        """Test --formatted output flag for human-readable output"""
        if not hasattr(get_session_data, 'main'):
            self.skipTest("Implementation not yet created")
            
        test_args = ['get_session_data.py', '--session-id', self.valid_session_id, '--formatted']
        
        with patch.object(sys, 'argv', test_args):
            with patch.object(get_session_data, 'fetch_session_data') as mock_fetch:
                with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
                    mock_fetch.return_value = self.mock_session_data
                    
                    try:
                        get_session_data.main()
                    except SystemExit as e:
                        self.assertEqual(e.code, 0)
                    
                    output = mock_stdout.getvalue()
                    # Should contain human-readable formatting
                    self.assertIn('Session:', output)
                    self.assertIn('Events:', output)
                    self.assertIn('Agents:', output)

    def test_error_recovery_mechanisms(self):
        """Test various error recovery scenarios"""
        if not hasattr(get_session_data, 'fetch_session_data'):
            self.skipTest("Implementation not yet created")
            
        # Test partial data scenarios
        partial_data_cases = [
            {'session_id': self.valid_session_id, 'events': []},  # No events
            {'session_id': self.valid_session_id, 'agents': []},  # No agents
            {'session_id': self.valid_session_id},  # Minimal data
        ]
        
        for partial_data in partial_data_cases:
            with self.subTest(data=partial_data):
                with patch('requests.get') as mock_get:
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = partial_data
                    mock_get.return_value = mock_response
                    
                    result = get_session_data.fetch_session_data(self.valid_session_id)
                    
                    # Should still return valid structure
                    self.assertIn('session_id', result)
                    self.assertIsInstance(result.get('events', []), list)
                    self.assertIsInstance(result.get('agents', []), list)


if __name__ == '__main__':
    unittest.main()