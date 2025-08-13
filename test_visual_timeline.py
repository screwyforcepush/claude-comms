#!/usr/bin/env python3
"""
Visual test script for timeline branch merging.

This script creates multiple test agents with realistic timing patterns
to verify that the timeline shows proper merge-back paths visually.
"""

import requests
import json
import time
import uuid
from datetime import datetime, timedelta

# Configuration
SERVER_URL = "http://localhost:4000"
TEST_SESSION_ID = f"visual-test-{uuid.uuid4().hex[:8]}"

def log_test_step(step, message):
    """Log a test step with timestamp"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {step}: {message}")

def create_test_scenario():
    """Create a realistic test scenario with multiple agents"""
    log_test_step("SCENARIO", f"Creating visual test scenario in session '{TEST_SESSION_ID}'")
    
    # Current time
    now = int(time.time() * 1000)
    
    # Test agents with different timing patterns
    test_agents = [
        {
            "name": "FastAgent1",
            "type": "engineer", 
            "start_offset": 0,      # Starts immediately
            "duration": 30000       # 30 seconds
        },
        {
            "name": "SlowAgent2", 
            "type": "tester",
            "start_offset": 5000,   # Starts 5 seconds later
            "duration": 60000       # 60 seconds (overlaps)
        },
        {
            "name": "QuickAgent3",
            "type": "reviewer",
            "start_offset": 10000,  # Starts 10 seconds later
            "duration": 25000       # 25 seconds (finishes early)
        },
        {
            "name": "LongAgent4",
            "type": "architect", 
            "start_offset": 2000,   # Starts 2 seconds later
            "duration": 90000       # 90 seconds (longest)
        }
    ]
    
    registered_agents = []
    
    # Register all agents
    for agent in test_agents:
        log_test_step("REGISTER", f"Registering {agent['name']} ({agent['type']})")
        
        # Simulate the agent being created at the right time
        created_at = now + agent['start_offset']
        
        # Register the agent
        payload = {
            "session_id": TEST_SESSION_ID,
            "name": agent['name'],
            "subagent_type": agent['type']
        }
        
        try:
            response = requests.post(f"{SERVER_URL}/subagents/register", json=payload)
            response.raise_for_status()
            agent_id = response.json().get("id")
            
            registered_agents.append({
                **agent,
                "id": agent_id,
                "created_at": created_at,
                "completed_at": created_at + agent['duration']
            })
            
            log_test_step("SUCCESS", f"{agent['name']} registered with ID {agent_id}")
            
        except requests.exceptions.RequestException as e:
            log_test_step("ERROR", f"Failed to register {agent['name']}: {e}")
            return []
    
    # Mark all agents as completed at their respective completion times
    for agent in registered_agents:
        log_test_step("COMPLETE", f"Marking {agent['name']} as completed")
        
        completion_payload = {
            "session_id": TEST_SESSION_ID,
            "name": agent['name'],
            "completed_at": agent['completed_at'],
            "status": "completed",
            "completion_metadata": {
                "total_duration_ms": agent['duration'],
                "total_tokens": 500 + (agent['duration'] // 1000) * 10,  # Realistic token count
                "total_tool_use_count": 3 + (agent['duration'] // 15000),
                "input_tokens": 300,
                "output_tokens": 200
            }
        }
        
        try:
            response = requests.post(f"{SERVER_URL}/subagents/update-completion", json=completion_payload)
            response.raise_for_status()
            log_test_step("SUCCESS", f"{agent['name']} marked as completed")
            
        except requests.exceptions.RequestException as e:
            log_test_step("ERROR", f"Failed to complete {agent['name']}: {e}")
    
    return registered_agents

def verify_timeline_data():
    """Verify the timeline data shows proper completion timestamps"""
    log_test_step("VERIFY", f"Verifying timeline data for session '{TEST_SESSION_ID}'")
    
    try:
        response = requests.get(f"{SERVER_URL}/subagents/{TEST_SESSION_ID}")
        response.raise_for_status()
        
        agents = response.json()
        log_test_step("INFO", f"Retrieved {len(agents)} agents from timeline API")
        
        # Verify each agent has proper timing data
        for agent in agents:
            name = agent.get("name")
            created_at = agent.get("created_at")
            completed_at = agent.get("completed_at") 
            completion_timestamp = agent.get("completion_timestamp")
            status = agent.get("status")
            
            log_test_step("AGENT", f"{name}: created={created_at}, completed={completed_at}, status={status}")
            
            if status == "completed":
                if not completed_at:
                    log_test_step("ERROR", f"{name} marked completed but missing completed_at")
                    return False
                    
                if not completion_timestamp:
                    log_test_step("ERROR", f"{name} missing completion_timestamp")
                    return False
                    
                if completed_at != completion_timestamp:
                    log_test_step("ERROR", f"{name} timestamp mismatch: {completed_at} != {completion_timestamp}")
                    return False
                    
                # Calculate duration
                duration = completed_at - created_at
                duration_sec = duration / 1000
                log_test_step("TIMING", f"{name} duration: {duration_sec:.1f}s")
                
        log_test_step("SUCCESS", "All timeline data verified correctly")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test_step("ERROR", f"Failed to verify timeline data: {e}")
        return False

def generate_visual_test_report():
    """Generate a report for visual testing"""
    log_test_step("REPORT", "Generating visual test report")
    
    print()
    print("=" * 80)
    print("VISUAL TIMELINE TEST REPORT")
    print("=" * 80)
    print()
    print(f"🎯 Test Session ID: {TEST_SESSION_ID}")
    print()
    print("📊 Expected Timeline Behavior:")
    print("   • FastAgent1 (engineer): Quick 30s branch, merges back early")
    print("   • SlowAgent2 (tester): 60s branch, overlaps with others")  
    print("   • QuickAgent3 (reviewer): 25s branch, finishes before SlowAgent2")
    print("   • LongAgent4 (architect): 90s branch, longest duration")
    print()
    print("🔍 Visual Verification Checklist:")
    print("   □ All agents branch out from orchestrator trunk at spawn time")
    print("   □ FastAgent1 merges back to trunk after 30 seconds")
    print("   □ QuickAgent3 merges back to trunk after 35 seconds (10s + 25s)")
    print("   □ SlowAgent2 merges back to trunk after 65 seconds (5s + 60s)")
    print("   □ LongAgent4 merges back to trunk after 92 seconds (2s + 90s)")
    print("   □ Merge-back paths are visible as curved lines returning to orchestrator")
    print("   □ Completion indicators appear at merge points on orchestrator trunk")
    print()
    print("🌐 Dashboard URL:")
    print(f"   http://localhost:5173")
    print()
    print("📋 Instructions:")
    print("   1. Open the dashboard in your browser")
    print("   2. Navigate to the 'Subagent Communications' tab")
    print("   3. Select the test session from the dropdown")
    print("   4. Verify that completed agents show merge-back paths")
    print("   5. Check that merge points align with completion timestamps")
    print()
    print("=" * 80)

def run_visual_test():
    """Run the complete visual test"""
    print("=" * 80)
    print("TIMELINE VISUAL TEST - BRANCH MERGING VERIFICATION")
    print("=" * 80)
    print()
    
    # Create test scenario
    registered_agents = create_test_scenario()
    if not registered_agents:
        log_test_step("FAILED", "Could not create test scenario")
        return False
    
    # Verify data
    if not verify_timeline_data():
        log_test_step("FAILED", "Timeline data verification failed")
        return False
    
    # Generate visual test report
    generate_visual_test_report()
    
    log_test_step("SUCCESS", "Visual test scenario created successfully!")
    return True

if __name__ == "__main__":
    success = run_visual_test()
    exit(0 if success else 1)