#!/usr/bin/env python3
"""
Test script to verify timeline branch merging fix is working correctly.

This script tests the full data flow:
1. Registers a test agent  
2. Marks it as completed with a realistic completion timestamp
3. Verifies the API returns both completed_at and completion_timestamp fields
4. Checks that the timeline component can properly receive the data
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
SERVER_URL = "http://localhost:4000"
TEST_SESSION_ID = f"test-session-{uuid.uuid4().hex[:8]}"
TEST_AGENT_NAME = f"TestAgent{uuid.uuid4().hex[:4]}"

def log_test_step(step, message):
    """Log a test step with timestamp"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {step}: {message}")

def register_test_agent():
    """Register a test agent"""
    log_test_step("STEP 1", f"Registering test agent '{TEST_AGENT_NAME}'")
    
    payload = {
        "session_id": TEST_SESSION_ID,
        "name": TEST_AGENT_NAME,
        "subagent_type": "tester"
    }
    
    try:
        response = requests.post(f"{SERVER_URL}/subagents/register", json=payload)
        response.raise_for_status()
        
        agent_id = response.json().get("id")
        log_test_step("SUCCESS", f"Agent registered with ID: {agent_id}")
        return agent_id
        
    except requests.exceptions.RequestException as e:
        log_test_step("ERROR", f"Failed to register agent: {e}")
        return None

def mark_agent_completed(completion_timestamp=None):
    """Mark the test agent as completed"""
    if completion_timestamp is None:
        completion_timestamp = int(time.time() * 1000)  # Current time in milliseconds
        
    log_test_step("STEP 2", f"Marking agent '{TEST_AGENT_NAME}' as completed")
    log_test_step("INFO", f"Completion timestamp: {completion_timestamp} ({datetime.fromtimestamp(completion_timestamp/1000)})")
    
    payload = {
        "session_id": TEST_SESSION_ID,
        "name": TEST_AGENT_NAME,
        "completed_at": completion_timestamp,
        "status": "completed",
        "completion_metadata": {
            "total_duration_ms": 45000,  # 45 seconds
            "total_tokens": 1250,
            "total_tool_use_count": 8,
            "input_tokens": 800,
            "output_tokens": 450
        }
    }
    
    try:
        response = requests.post(f"{SERVER_URL}/subagents/update-completion", json=payload)
        response.raise_for_status()
        
        result = response.json()
        success = result.get("success", False)
        
        if success:
            log_test_step("SUCCESS", "Agent marked as completed")
        else:
            log_test_step("ERROR", f"Failed to mark agent as completed: {result}")
            
        return success
        
    except requests.exceptions.RequestException as e:
        log_test_step("ERROR", f"Failed to mark agent as completed: {e}")
        return False

def verify_api_response():
    """Verify that the API returns both completed_at and completion_timestamp"""
    log_test_step("STEP 3", f"Verifying API response for session '{TEST_SESSION_ID}'")
    
    try:
        response = requests.get(f"{SERVER_URL}/subagents/{TEST_SESSION_ID}")
        response.raise_for_status()
        
        agents = response.json()
        log_test_step("INFO", f"Retrieved {len(agents)} agents from API")
        
        # Find our test agent
        test_agent = None
        for agent in agents:
            if agent.get("name") == TEST_AGENT_NAME:
                test_agent = agent
                break
                
        if not test_agent:
            log_test_step("ERROR", f"Test agent '{TEST_AGENT_NAME}' not found in API response")
            return False
            
        # Verify the agent has both fields
        completed_at = test_agent.get("completed_at")
        completion_timestamp = test_agent.get("completion_timestamp")
        
        log_test_step("INFO", f"Agent data: {json.dumps(test_agent, indent=2)}")
        
        # Check for completed_at field
        if completed_at is None:
            log_test_step("ERROR", "Agent missing 'completed_at' field")
            return False
        else:
            log_test_step("SUCCESS", f"Agent has completed_at: {completed_at}")
            
        # Check for completion_timestamp field (mapped from completed_at)
        if completion_timestamp is None:
            log_test_step("ERROR", "Agent missing 'completion_timestamp' field")
            return False
        else:
            log_test_step("SUCCESS", f"Agent has completion_timestamp: {completion_timestamp}")
            
        # Verify they match (completion_timestamp should be mapped from completed_at)
        if completed_at != completion_timestamp:
            log_test_step("ERROR", f"Mismatch: completed_at ({completed_at}) != completion_timestamp ({completion_timestamp})")
            return False
        else:
            log_test_step("SUCCESS", "completed_at and completion_timestamp match correctly")
            
        # Verify agent status
        status = test_agent.get("status")
        if status != "completed":
            log_test_step("ERROR", f"Agent status is '{status}', expected 'completed'")
            return False
        else:
            log_test_step("SUCCESS", f"Agent status is correctly set to 'completed'")
            
        return True
        
    except requests.exceptions.RequestException as e:
        log_test_step("ERROR", f"Failed to retrieve agents: {e}")
        return False

def test_timeline_data_structure():
    """Test that the data structure matches what the timeline component expects"""
    log_test_step("STEP 4", "Testing timeline data structure compatibility")
    
    try:
        response = requests.get(f"{SERVER_URL}/subagents/{TEST_SESSION_ID}")
        response.raise_for_status()
        
        agents = response.json()
        test_agent = None
        for agent in agents:
            if agent.get("name") == TEST_AGENT_NAME:
                test_agent = agent
                break
                
        if not test_agent:
            log_test_step("ERROR", "Test agent not found for timeline testing")
            return False
            
        # Check fields that timeline component uses (from line 585 in InteractiveAgentTimeline.vue)
        required_fields = [
            "id", "name", "subagent_type", "created_at", 
            "completion_timestamp", "status"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in test_agent:
                missing_fields.append(field)
                
        if missing_fields:
            log_test_step("ERROR", f"Timeline required fields missing: {missing_fields}")
            return False
        else:
            log_test_step("SUCCESS", "All timeline required fields present")
            
        # Verify endTime calculation (from line 585: endTime: agent.completion_timestamp || agent.completed_at || null)
        endTime = test_agent.get("completion_timestamp") or test_agent.get("completed_at") or None
        if endTime is None:
            log_test_step("ERROR", "Cannot calculate endTime - no completion timestamp available")
            return False
        else:
            log_test_step("SUCCESS", f"Timeline endTime can be calculated: {endTime}")
            
        # Simulate the timeline component's data transformation
        timeline_agent = {
            "agentId": str(test_agent["id"]),
            "type": test_agent["subagent_type"],
            "name": test_agent["name"],
            "startTime": test_agent["created_at"],
            "endTime": endTime,
            "status": test_agent["status"]
        }
        
        log_test_step("INFO", f"Timeline agent data: {json.dumps(timeline_agent, indent=2)}")
        log_test_step("SUCCESS", "Timeline data structure test passed")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test_step("ERROR", f"Timeline data structure test failed: {e}")
        return False

def check_server_health():
    """Check if the server is running and responsive"""
    log_test_step("SETUP", "Checking server health")
    
    try:
        response = requests.get(f"{SERVER_URL}/", timeout=5)
        response.raise_for_status()
        log_test_step("SUCCESS", "Server is healthy and responsive")
        return True
    except requests.exceptions.RequestException as e:
        log_test_step("ERROR", f"Server health check failed: {e}")
        log_test_step("HINT", "Make sure the server is running with: cd apps/server && bun run dev")
        return False

def cleanup_test_data():
    """Clean up test data (optional)"""
    log_test_step("CLEANUP", f"Test completed for session: {TEST_SESSION_ID}")
    log_test_step("INFO", f"Test agent: {TEST_AGENT_NAME}")
    log_test_step("INFO", "Test data will remain in database for inspection")

def run_comprehensive_test():
    """Run the complete test suite"""
    print("=" * 80)
    print("TIMELINE BRANCH MERGING FIX - COMPREHENSIVE TEST")
    print("=" * 80)
    print()
    
    # Check server health first
    if not check_server_health():
        return False
        
    # Step 1: Register test agent
    agent_id = register_test_agent()
    if not agent_id:
        return False
        
    # Small delay to ensure timestamp differences
    time.sleep(1)
    
    # Step 2: Mark agent as completed
    if not mark_agent_completed():
        return False
        
    # Small delay for database consistency
    time.sleep(0.5)
        
    # Step 3: Verify API response
    if not verify_api_response():
        return False
        
    # Step 4: Test timeline data structure
    if not test_timeline_data_structure():
        return False
        
    # Success!
    print()
    print("=" * 80)
    log_test_step("FINAL RESULT", "✅ ALL TESTS PASSED!")
    print("=" * 80)
    print()
    log_test_step("SUMMARY", "Timeline branch merging fix is working correctly:")
    log_test_step("✓", "API returns both completed_at and completion_timestamp fields")
    log_test_step("✓", "completion_timestamp is properly mapped from completed_at")
    log_test_step("✓", "Timeline component can use completion_timestamp for endTime")
    log_test_step("✓", "Agent status and completion data are correctly stored")
    print()
    log_test_step("NEXT", "The timeline should now show merge-back paths for completed agents")
    
    cleanup_test_data()
    return True

if __name__ == "__main__":
    success = run_comprehensive_test()
    exit(0 if success else 1)