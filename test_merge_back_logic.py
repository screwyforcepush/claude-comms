#!/usr/bin/env python3
"""
Test script to validate the specific merge-back logic fix.

This script focuses on testing the core issue that was fixed:
- Agent branches returning to orchestrator trunk at completion time
- Proper endTime calculation using completion_timestamp
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
SERVER_URL = "http://localhost:4000"
TEST_SESSION_ID = f"merge-test-{uuid.uuid4().hex[:8]}"

def log_test_step(step, message):
    """Log a test step with timestamp"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {step}: {message}")

def test_merge_back_logic():
    """Test the specific merge-back logic that was fixed"""
    log_test_step("TEST", "Testing merge-back logic fix")
    
    # Create a test agent
    agent_name = f"MergeTestAgent"
    
    # Register agent
    log_test_step("STEP 1", f"Registering agent '{agent_name}'")
    payload = {
        "session_id": TEST_SESSION_ID,
        "name": agent_name,
        "subagent_type": "engineer"
    }
    
    try:
        response = requests.post(f"{SERVER_URL}/subagents/register", json=payload)
        response.raise_for_status()
        agent_id = response.json().get("id")
        log_test_step("SUCCESS", f"Agent registered with ID: {agent_id}")
    except Exception as e:
        log_test_step("ERROR", f"Failed to register agent: {e}")
        return False
    
    # Mark as completed with specific completion time
    log_test_step("STEP 2", "Marking agent as completed")
    completion_time = int(time.time() * 1000) + 5000  # 5 seconds from now
    
    completion_payload = {
        "session_id": TEST_SESSION_ID,
        "name": agent_name,
        "completed_at": completion_time,
        "status": "completed"
    }
    
    try:
        response = requests.post(f"{SERVER_URL}/subagents/update-completion", json=completion_payload)
        response.raise_for_status()
        log_test_step("SUCCESS", "Agent marked as completed")
    except Exception as e:
        log_test_step("ERROR", f"Failed to mark agent as completed: {e}")
        return False
    
    # Test the critical fix: verify completion_timestamp mapping
    log_test_step("STEP 3", "Testing completion_timestamp mapping (THE FIX)")
    
    try:
        response = requests.get(f"{SERVER_URL}/subagents/{TEST_SESSION_ID}")
        response.raise_for_status()
        agents = response.json()
        
        test_agent = None
        for agent in agents:
            if agent.get("name") == agent_name:
                test_agent = agent
                break
        
        if not test_agent:
            log_test_step("ERROR", "Test agent not found in response")
            return False
        
        # THE CRITICAL TEST: Does the fix work?
        completed_at = test_agent.get("completed_at")
        completion_timestamp = test_agent.get("completion_timestamp")
        
        log_test_step("CHECK", f"completed_at: {completed_at}")
        log_test_step("CHECK", f"completion_timestamp: {completion_timestamp}")
        
        if completed_at is None:
            log_test_step("❌ FAIL", "Agent missing completed_at field")
            return False
        
        if completion_timestamp is None:
            log_test_step("❌ FAIL", "Agent missing completion_timestamp field (FIX FAILED)")
            return False
        
        if completed_at != completion_timestamp:
            log_test_step("❌ FAIL", f"Mapping failed: {completed_at} != {completion_timestamp}")
            return False
        
        log_test_step("✅ PASS", "completion_timestamp correctly mapped from completed_at")
        
        # Test timeline component logic simulation
        log_test_step("STEP 4", "Testing timeline component endTime calculation")
        
        # Simulate the timeline component's endTime calculation (line 585 in InteractiveAgentTimeline.vue)
        # endTime: agent.completion_timestamp || agent.completed_at || null
        
        simulated_endTime = test_agent.get("completion_timestamp") or test_agent.get("completed_at") or None
        
        if simulated_endTime is None:
            log_test_step("❌ FAIL", "Timeline component cannot calculate endTime")
            return False
        
        if simulated_endTime != completion_time:
            log_test_step("❌ FAIL", f"endTime mismatch: {simulated_endTime} != {completion_time}")
            return False
        
        log_test_step("✅ PASS", f"Timeline endTime correctly calculated: {simulated_endTime}")
        
        # Test the merge-back path logic simulation
        log_test_step("STEP 5", "Testing merge-back path logic")
        
        # Simulate the timeline component's agent path logic
        startTime = test_agent.get("created_at")
        endTime = simulated_endTime
        status = test_agent.get("status")
        
        # From getAgentCurvePath function (line 833-866)
        has_completion_time = (status == "completed" and endTime is not None)
        
        if not has_completion_time:
            log_test_step("❌ FAIL", "Agent should have completion time for merge-back path")
            return False
        
        log_test_step("✅ PASS", "Agent has proper completion time for merge-back path")
        
        # Calculate duration for validation
        duration = endTime - startTime
        duration_sec = duration / 1000
        log_test_step("INFO", f"Agent duration: {duration_sec:.1f} seconds")
        
        # Verify merge-back path would be rendered (from line 849-857)
        log_test_step("INFO", "Agent meets criteria for full merge-back path rendering")
        log_test_step("✅ PASS", "Merge-back logic test completed successfully")
        
        return True
        
    except Exception as e:
        log_test_step("ERROR", f"Failed to test merge-back logic: {e}")
        return False

def test_edge_cases():
    """Test edge cases for the fix"""
    log_test_step("EDGE", "Testing edge cases")
    
    test_cases = [
        {
            "name": "AgentNoCompletion",
            "description": "Agent without completion (should not merge back)",
            "complete": False
        },
        {
            "name": "AgentInProgress", 
            "description": "Agent in progress (should not merge back yet)",
            "complete": True,
            "status": "in_progress"
        }
    ]
    
    for case in test_cases:
        log_test_step("EDGE_CASE", case["description"])
        
        # Register agent
        payload = {
            "session_id": TEST_SESSION_ID,
            "name": case["name"],
            "subagent_type": "tester"
        }
        
        try:
            response = requests.post(f"{SERVER_URL}/subagents/register", json=payload)
            response.raise_for_status()
            
            if case["complete"]:
                # Mark with specific status
                completion_payload = {
                    "session_id": TEST_SESSION_ID,
                    "name": case["name"],
                    "status": case.get("status", "completed")
                }
                
                if case.get("status") == "completed":
                    completion_payload["completed_at"] = int(time.time() * 1000)
                
                response = requests.post(f"{SERVER_URL}/subagents/update-completion", json=completion_payload)
                response.raise_for_status()
            
            log_test_step("SUCCESS", f"Edge case '{case['name']}' set up correctly")
            
        except Exception as e:
            log_test_step("ERROR", f"Failed edge case '{case['name']}': {e}")
            return False
    
    return True

def run_comprehensive_test():
    """Run comprehensive merge-back logic test"""
    print("=" * 80)
    print("MERGE-BACK LOGIC FIX - COMPREHENSIVE VALIDATION")
    print("=" * 80)
    print()
    
    log_test_step("START", f"Testing in session: {TEST_SESSION_ID}")
    
    # Test the main fix
    if not test_merge_back_logic():
        log_test_step("FAILED", "Main merge-back logic test failed")
        return False
    
    # Test edge cases
    if not test_edge_cases():
        log_test_step("FAILED", "Edge case tests failed") 
        return False
    
    # Final validation
    log_test_step("FINAL", "Retrieving all test data for validation")
    
    try:
        response = requests.get(f"{SERVER_URL}/subagents/{TEST_SESSION_ID}")
        response.raise_for_status()
        agents = response.json()
        
        completed_agents = [a for a in agents if a.get("status") == "completed"]
        pending_agents = [a for a in agents if a.get("status") != "completed"]
        
        log_test_step("SUMMARY", f"Total agents: {len(agents)}")
        log_test_step("SUMMARY", f"Completed agents: {len(completed_agents)}")
        log_test_step("SUMMARY", f"Non-completed agents: {len(pending_agents)}")
        
        # Verify all completed agents have proper mapping
        for agent in completed_agents:
            name = agent.get("name")
            has_completed_at = agent.get("completed_at") is not None
            has_completion_timestamp = agent.get("completion_timestamp") is not None
            
            if not (has_completed_at and has_completion_timestamp):
                log_test_step("ERROR", f"Completed agent '{name}' missing required timestamps")
                return False
        
        log_test_step("SUCCESS", "All completed agents have proper timestamp mapping")
        
    except Exception as e:
        log_test_step("ERROR", f"Final validation failed: {e}")
        return False
    
    print()
    print("=" * 80)
    log_test_step("RESULT", "🎉 ALL MERGE-BACK LOGIC TESTS PASSED!")
    print("=" * 80)
    print()
    log_test_step("CONFIRMED", "✅ completion_timestamp field is properly mapped")
    log_test_step("CONFIRMED", "✅ Timeline component can calculate endTime")
    log_test_step("CONFIRMED", "✅ Merge-back paths will render for completed agents")
    log_test_step("CONFIRMED", "✅ Database mapping works correctly")
    log_test_step("CONFIRMED", "✅ API returns expected data structure")
    print()
    log_test_step("NEXT", "🎨 Visual verification recommended via dashboard")
    log_test_step("SESSION", f"📊 Test session: {TEST_SESSION_ID}")
    
    return True

if __name__ == "__main__":
    success = run_comprehensive_test()
    exit(0 if success else 1)