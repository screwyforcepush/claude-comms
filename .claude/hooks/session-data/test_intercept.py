#!/usr/bin/env python3
"""
Test script for intercept_session_id.py hook
Validates that the hook correctly intercepts getCurrentSessionId.sh calls
and blocks with exit(2) returning the session ID.
"""

import json
import subprocess
import sys
import os

def test_intercept_getCurrentSessionId():
    """Test intercepting ./getCurrentSessionId.sh command"""
    test_data = {
        "session_id": "test-session-12345",
        "tool_name": "Bash",
        "tool_input": {
            "command": "./getCurrentSessionId.sh"
        },
        "hook_event_name": "PreToolUse"
    }
    
    result = subprocess.run([
        "python3", 
        "/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/.claude/hooks/session-data/intercept_session_id.py"
    ], 
    input=json.dumps(test_data), 
    capture_output=True, 
    text=True
    )
    
    print("Test 1: ./getCurrentSessionId.sh")
    print(f"Exit code: {result.returncode}")
    print(f"Stderr: {result.stderr}")
    print(f"Expected: Exit code 2, Session ID in stderr")
    
    assert result.returncode == 2, f"Expected exit code 2, got {result.returncode}"
    assert "test-session-12345" in result.stderr, f"Session ID not found in stderr: {result.stderr}"
    print("✅ PASS\n")

def test_intercept_bash_getCurrentSessionId():
    """Test intercepting bash getCurrentSessionId.sh command"""
    test_data = {
        "session_id": "test-session-67890",
        "tool_name": "Bash", 
        "tool_input": {
            "command": "bash getCurrentSessionId.sh"
        },
        "hook_event_name": "PreToolUse"
    }
    
    result = subprocess.run([
        "python3",
        "/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/.claude/hooks/session-data/intercept_session_id.py"
    ],
    input=json.dumps(test_data),
    capture_output=True,
    text=True
    )
    
    print("Test 2: bash getCurrentSessionId.sh")
    print(f"Exit code: {result.returncode}")
    print(f"Stderr: {result.stderr}")
    
    assert result.returncode == 2, f"Expected exit code 2, got {result.returncode}"
    assert "test-session-67890" in result.stderr, f"Session ID not found in stderr: {result.stderr}"
    print("✅ PASS\n")

def test_passthrough_other_bash():
    """Test that other bash commands pass through normally"""
    test_data = {
        "session_id": "test-session-99999",
        "tool_name": "Bash",
        "tool_input": {
            "command": "ls -la"
        },
        "hook_event_name": "PreToolUse"
    }
    
    result = subprocess.run([
        "python3",
        "/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/.claude/hooks/session-data/intercept_session_id.py"
    ],
    input=json.dumps(test_data),
    capture_output=True,
    text=True
    )
    
    print("Test 3: ls -la (should pass through)")
    print(f"Exit code: {result.returncode}")
    print(f"Stderr: {result.stderr}")
    
    assert result.returncode == 0, f"Expected exit code 0, got {result.returncode}"
    print("✅ PASS\n")

def test_passthrough_non_bash():
    """Test that non-Bash tools pass through normally"""
    test_data = {
        "session_id": "test-session-11111",
        "tool_name": "Read",
        "tool_input": {
            "file_path": "/some/file.txt"
        },
        "hook_event_name": "PreToolUse"
    }
    
    result = subprocess.run([
        "python3",
        "/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/.claude/hooks/session-data/intercept_session_id.py"
    ],
    input=json.dumps(test_data),
    capture_output=True,
    text=True
    )
    
    print("Test 4: Read tool (should pass through)")
    print(f"Exit code: {result.returncode}")
    print(f"Stderr: {result.stderr}")
    
    assert result.returncode == 0, f"Expected exit code 0, got {result.returncode}"
    print("✅ PASS\n")

def test_intercept_path_variants():
    """Test different path variants of getCurrentSessionId.sh"""
    variants = [
        "./getCurrentSessionId.sh",
        "bash getCurrentSessionId.sh", 
        "sh getCurrentSessionId.sh",
        "/usr/local/bin/getCurrentSessionId.sh",
        "~/scripts/getCurrentSessionId.sh"
    ]
    
    for i, command in enumerate(variants):
        test_data = {
            "session_id": f"test-session-variant-{i}",
            "tool_name": "Bash",
            "tool_input": {
                "command": command
            },
            "hook_event_name": "PreToolUse"
        }
        
        result = subprocess.run([
            "python3",
            "/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/.claude/hooks/session-data/intercept_session_id.py"
        ],
        input=json.dumps(test_data),
        capture_output=True,
        text=True
        )
        
        print(f"Test 5.{i+1}: {command}")
        print(f"Exit code: {result.returncode}")
        
        assert result.returncode == 2, f"Expected exit code 2 for '{command}', got {result.returncode}"
        assert f"test-session-variant-{i}" in result.stderr, f"Session ID not found for '{command}'"
        print("✅ PASS")
    print()

def main():
    print("Testing intercept_session_id.py hook")
    print("=" * 50)
    
    try:
        test_intercept_getCurrentSessionId()
        test_intercept_bash_getCurrentSessionId() 
        test_passthrough_other_bash()
        test_passthrough_non_bash()
        test_intercept_path_variants()
        
        print("🎉 All tests passed! Hook is working correctly.")
        
    except AssertionError as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Test error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()