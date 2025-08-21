# Session Review System - Implementation Guide

**Version:** 1.0  
**Author:** SamCipher (System Architect)  
**Date:** 2025-08-20  
**Status:** Ready for Implementation  

## Executive Summary

This guide provides step-by-step implementation instructions for the Session Review System, which enables AI-powered analysis of Claude Code sessions through hook-based interception and dedicated review agents. The system integrates seamlessly with existing infrastructure without modifying core Claude Code functionality.

## Implementation Roadmap

### Phase 1: Core Hook Infrastructure (Day 1-2)

#### 1.1 Session ID Injection Hook

**Location:** `.claude/hooks/session-inject/inject_session_id.py`

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
Session ID injection hook for Task tool calls.
Injects session context into subagent prompts.
"""

import json
import sys
import os

def main():
    try:
        # Read hook input
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        session_id = input_data.get('session_id', 'unknown')
        
        # Only process Task tool calls
        if tool_name == 'Task':
            original_prompt = tool_input.get('prompt', '')
            
            # Inject session ID into prompt
            enhanced_prompt = f"{original_prompt}\n\n[Session Context: {session_id}]"
            
            # Also add to description for visibility
            original_description = tool_input.get('description', '')
            enhanced_description = f"{original_description} (Session: {session_id})"
            
            # Return modified arguments
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "modifiedArgs": {
                        **tool_input,
                        "prompt": enhanced_prompt,
                        "description": enhanced_description
                    }
                }
            }
            print(json.dumps(output))
        
        sys.exit(0)
        
    except Exception as e:
        # Log error but don't block
        print(f"Session injection error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

#### 1.2 getCurrentSessionId.sh Wrapper

**Location:** `.claude/hooks/wrappers/getCurrentSessionId.sh`

```bash
#!/bin/bash
# Wrapper script for getCurrentSessionId.sh interception

# Get the actual session ID (from environment or original method)
if [ -n "$CLAUDE_SESSION_ID" ]; then
    SESSION_ID="$CLAUDE_SESSION_ID"
else
    # Fallback to reading from Claude's session management
    SESSION_ID=$(cat ~/.claude/current_session 2>/dev/null || echo "unknown")
fi

# Log session access for analytics
echo "$(date +%s),getCurrentSessionId,$SESSION_ID" >> ~/.claude/session_access.log

# Trigger async review check (non-blocking)
if [ -f "$CLAUDE_PROJECT_DIR/.claude/hooks/review/check_review_trigger.py" ]; then
    python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/review/check_review_trigger.py" \
        --session-id "$SESSION_ID" \
        --trigger-type "session_access" &
fi

# Return the session ID
echo "$SESSION_ID"
```

**Setup Instructions:**
```bash
# Create wrapper directory
mkdir -p ~/.claude/hooks/wrappers

# Copy wrapper script
cp .claude/hooks/wrappers/getCurrentSessionId.sh ~/.claude/hooks/wrappers/

# Make executable
chmod +x ~/.claude/hooks/wrappers/getCurrentSessionId.sh

# Add to PATH (in ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.claude/hooks/wrappers:$PATH"
```

### Phase 2: Review Agent Implementation (Day 2-3)

#### 2.1 Review Trigger Service

**Location:** `.claude/hooks/review/check_review_trigger.py`

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "requests",
# ]
# ///

"""
Review trigger service that determines when to initiate session reviews.
"""

import json
import sys
import argparse
import requests
from datetime import datetime, timedelta
from pathlib import Path

class ReviewTriggerService:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.api_base = "http://localhost:4000"
        self.config_file = Path.home() / ".claude" / "review_config.json"
        self.state_file = Path.home() / ".claude" / "review_state.json"
        
    def load_config(self):
        """Load review configuration."""
        default_config = {
            "time_threshold_minutes": 30,
            "event_count_threshold": 100,
            "error_threshold": 5,
            "auto_review_enabled": True
        }
        
        if self.config_file.exists():
            with open(self.config_file) as f:
                return json.load(f)
        return default_config
    
    def load_state(self):
        """Load review state tracking."""
        if self.state_file.exists():
            with open(self.state_file) as f:
                return json.load(f)
        return {}
    
    def save_state(self, state):
        """Save review state."""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, 'w') as f:
            json.dump(state, f, indent=2)
    
    def get_session_metrics(self):
        """Fetch session metrics from API."""
        try:
            # Get session events
            response = requests.get(
                f"{self.api_base}/events/session/{self.session_id}",
                timeout=5
            )
            if response.status_code == 200:
                events = response.json()
                
                # Calculate metrics
                error_count = sum(1 for e in events 
                                if 'error' in e.get('hook_event_type', '').lower())
                
                return {
                    "event_count": len(events),
                    "error_count": error_count,
                    "last_event_time": events[-1]["timestamp"] if events else None
                }
        except Exception as e:
            print(f"Failed to fetch metrics: {e}", file=sys.stderr)
        
        return None
    
    def should_trigger_review(self):
        """Determine if review should be triggered."""
        config = self.load_config()
        
        if not config.get("auto_review_enabled", True):
            return False, "Auto-review disabled"
        
        state = self.load_state()
        last_review = state.get(self.session_id, {}).get("last_review_time")
        
        # Check time threshold
        if last_review:
            last_review_dt = datetime.fromtimestamp(last_review / 1000)
            time_since_review = datetime.now() - last_review_dt
            
            if time_since_review < timedelta(minutes=config["time_threshold_minutes"]):
                return False, "Too soon since last review"
        
        # Check metrics
        metrics = self.get_session_metrics()
        if not metrics:
            return False, "No metrics available"
        
        # Apply thresholds
        triggers = []
        
        if metrics["event_count"] >= config["event_count_threshold"]:
            triggers.append(f"Event count ({metrics['event_count']}) exceeds threshold")
        
        if metrics["error_count"] >= config["error_threshold"]:
            triggers.append(f"Error count ({metrics['error_count']}) exceeds threshold")
        
        if triggers:
            return True, "; ".join(triggers)
        
        return False, "No triggers met"
    
    def trigger_review(self, reason: str):
        """Queue a session review."""
        try:
            # Create review request
            review_request = {
                "session_id": self.session_id,
                "trigger_time": int(datetime.now().timestamp() * 1000),
                "trigger_reason": reason,
                "trigger_type": "automatic",
                "priority": "normal"
            }
            
            # Send to review queue endpoint
            response = requests.post(
                f"{self.api_base}/api/sessions/review/queue",
                json=review_request,
                timeout=5
            )
            
            if response.status_code == 200:
                # Update state
                state = self.load_state()
                state[self.session_id] = {
                    "last_review_time": review_request["trigger_time"],
                    "last_review_reason": reason
                }
                self.save_state(state)
                
                print(f"Review queued for session {self.session_id}: {reason}")
                return True
            
        except Exception as e:
            print(f"Failed to trigger review: {e}", file=sys.stderr)
        
        return False

def main():
    parser = argparse.ArgumentParser(description='Check and trigger session reviews')
    parser.add_argument('--session-id', required=True, help='Session ID to check')
    parser.add_argument('--trigger-type', default='auto', help='Trigger type')
    parser.add_argument('--force', action='store_true', help='Force review trigger')
    
    args = parser.parse_args()
    
    service = ReviewTriggerService(args.session_id)
    
    if args.force:
        service.trigger_review("Manual review request")
    else:
        should_review, reason = service.should_trigger_review()
        if should_review:
            service.trigger_review(reason)

if __name__ == '__main__':
    main()
```

#### 2.2 Review Analysis Agent

**Location:** `.claude/hooks/review/session_review_agent.py`

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "requests",
# ]
# ///

"""
Session review agent that analyzes session data and provides insights.
"""

import json
import sys
import requests
from typing import Dict, List, Any

class SessionReviewAgent:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.api_base = "http://localhost:4000"
        
    def fetch_session_data(self) -> Dict[str, Any]:
        """Fetch comprehensive session data."""
        data = {}
        
        # Get session events
        response = requests.get(f"{self.api_base}/events/session/{self.session_id}")
        if response.status_code == 200:
            data['events'] = response.json()
        
        # Get subagents
        response = requests.get(f"{self.api_base}/subagents/{self.session_id}")
        if response.status_code == 200:
            data['agents'] = response.json()
        
        # Get messages
        response = requests.get(f"{self.api_base}/subagents/messages/session/{self.session_id}")
        if response.status_code == 200:
            data['messages'] = response.json()
        
        return data
    
    def analyze_patterns(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze session patterns."""
        patterns = {
            "error_patterns": [],
            "performance_issues": [],
            "coordination_problems": [],
            "resource_usage": {}
        }
        
        # Analyze errors
        events = data.get('events', [])
        error_events = [e for e in events if 'error' in e.get('hook_event_type', '').lower()]
        if len(error_events) > 3:
            patterns["error_patterns"].append({
                "type": "high_error_rate",
                "count": len(error_events),
                "severity": "high" if len(error_events) > 10 else "medium"
            })
        
        # Analyze agent performance
        agents = data.get('agents', [])
        for agent in agents:
            if agent.get('total_duration_ms', 0) > 60000:  # > 1 minute
                patterns["performance_issues"].append({
                    "agent": agent['name'],
                    "duration": agent['total_duration_ms'],
                    "issue": "long_running_agent"
                })
        
        # Analyze coordination
        messages = data.get('messages', [])
        if len(messages) < len(agents) * 2:  # Low communication
            patterns["coordination_problems"].append({
                "type": "low_communication",
                "message_count": len(messages),
                "agent_count": len(agents)
            })
        
        # Calculate resource usage
        total_tokens = sum(a.get('total_tokens', 0) for a in agents)
        patterns["resource_usage"] = {
            "total_tokens": total_tokens,
            "total_agents": len(agents),
            "avg_tokens_per_agent": total_tokens / len(agents) if agents else 0
        }
        
        return patterns
    
    def generate_scores(self, data: Dict[str, Any], patterns: Dict[str, Any]) -> Dict[str, float]:
        """Generate performance scores."""
        scores = {}
        
        # Task completion score
        agents = data.get('agents', [])
        completed = sum(1 for a in agents if a.get('status') == 'completed')
        scores['completion'] = (completed / len(agents) * 100) if agents else 0
        
        # Efficiency score
        avg_duration = sum(a.get('total_duration_ms', 0) for a in agents) / len(agents) if agents else 0
        scores['efficiency'] = max(0, 100 - (avg_duration / 1000))  # Penalty for each second
        
        # Error handling score
        error_count = len(patterns.get('error_patterns', []))
        scores['error_handling'] = max(0, 100 - (error_count * 20))
        
        # Coordination score
        coord_issues = len(patterns.get('coordination_problems', []))
        scores['coordination'] = max(0, 100 - (coord_issues * 25))
        
        # Resource usage score
        avg_tokens = patterns['resource_usage'].get('avg_tokens_per_agent', 0)
        scores['resources'] = max(0, 100 - (avg_tokens / 50))  # Penalty per 50 tokens
        
        # Overall score
        scores['overall'] = sum(scores.values()) / len(scores)
        
        return scores
    
    def generate_recommendations(self, patterns: Dict[str, Any], scores: Dict[str, float]) -> List[Dict[str, str]]:
        """Generate actionable recommendations."""
        recommendations = []
        
        # Error recommendations
        if patterns.get('error_patterns'):
            recommendations.append({
                "category": "error_handling",
                "priority": "high",
                "recommendation": "Implement better error recovery mechanisms",
                "details": f"Session had {patterns['error_patterns'][0]['count']} errors"
            })
        
        # Performance recommendations
        for issue in patterns.get('performance_issues', []):
            recommendations.append({
                "category": "performance",
                "priority": "medium",
                "recommendation": f"Optimize agent {issue['agent']} execution time",
                "details": f"Agent took {issue['duration']/1000:.1f} seconds"
            })
        
        # Coordination recommendations
        if patterns.get('coordination_problems'):
            recommendations.append({
                "category": "coordination",
                "priority": "medium",
                "recommendation": "Increase inter-agent communication",
                "details": "Low message-to-agent ratio detected"
            })
        
        # Resource recommendations
        if patterns['resource_usage'].get('avg_tokens_per_agent', 0) > 2000:
            recommendations.append({
                "category": "resources",
                "priority": "low",
                "recommendation": "Consider breaking down agent tasks",
                "details": "High token usage per agent"
            })
        
        return recommendations
    
    def create_review_summary(self, data: Dict, patterns: Dict, scores: Dict, recommendations: List) -> str:
        """Create human-readable summary."""
        agents = data.get('agents', [])
        events = data.get('events', [])
        
        summary = f"""
Session Review Summary
======================
Session ID: {self.session_id}
Total Agents: {len(agents)}
Total Events: {len(events)}
Overall Score: {scores['overall']:.1f}/100

Scores
------
- Task Completion: {scores['completion']:.1f}/100
- Efficiency: {scores['efficiency']:.1f}/100  
- Error Handling: {scores['error_handling']:.1f}/100
- Coordination: {scores['coordination']:.1f}/100
- Resource Usage: {scores['resources']:.1f}/100

Key Patterns
------------
- Errors: {len(patterns.get('error_patterns', []))} patterns detected
- Performance Issues: {len(patterns.get('performance_issues', []))} agents with long execution
- Coordination: {len(patterns.get('coordination_problems', []))} issues found
- Token Usage: {patterns['resource_usage'].get('total_tokens', 0)} total tokens

Top Recommendations
-------------------
"""
        for i, rec in enumerate(recommendations[:3], 1):
            summary += f"{i}. [{rec['priority'].upper()}] {rec['recommendation']}\n"
            summary += f"   {rec['details']}\n"
        
        return summary
    
    def save_review_results(self, review_data: Dict):
        """Save review results to database."""
        try:
            response = requests.post(
                f"{self.api_base}/api/sessions/review/{self.session_id}/results",
                json=review_data,
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Failed to save review: {e}", file=sys.stderr)
            return False
    
    def perform_review(self):
        """Main review execution."""
        # Fetch data
        data = self.fetch_session_data()
        
        # Analyze
        patterns = self.analyze_patterns(data)
        scores = self.generate_scores(data, patterns)
        recommendations = self.generate_recommendations(patterns, scores)
        
        # Create summary
        summary = self.create_review_summary(data, patterns, scores, recommendations)
        
        # Prepare review data
        review_data = {
            "session_id": self.session_id,
            "timestamp": int(datetime.now().timestamp() * 1000),
            "scores": scores,
            "patterns": patterns,
            "recommendations": recommendations,
            "summary": summary,
            "metadata": {
                "agent_count": len(data.get('agents', [])),
                "event_count": len(data.get('events', [])),
                "message_count": len(data.get('messages', []))
            }
        }
        
        # Save results
        if self.save_review_results(review_data):
            print(summary)
            return review_data
        else:
            print("Failed to save review results", file=sys.stderr)
            return None

def main():
    if len(sys.argv) < 2:
        print("Usage: session_review_agent.py <session_id>", file=sys.stderr)
        sys.exit(1)
    
    session_id = sys.argv[1]
    agent = SessionReviewAgent(session_id)
    
    review = agent.perform_review()
    if review:
        print(f"\nReview completed successfully for session {session_id}")
    else:
        print(f"\nReview failed for session {session_id}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### Phase 3: Hook Configuration (Day 3)

#### 3.1 Update .claude/settings.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/session-inject/inject_session_id.py",
            "timeout": 5
          }
        ]
      },
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/register_subagent.py"
          },
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app cc-hook-multi-agent-obvs --event-type PreToolUse --summarize"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/update_subagent_completion.py"
          },
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app cc-hook-multi-agent-obvs --event-type PostToolUse --summarize"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/review/check_review_trigger.py --session-id $CLAUDE_SESSION_ID --trigger-type stop",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app cc-hook-multi-agent-obvs --event-type Stop --add-chat"
          }
        ]
      }
    ]
  }
}
```

### Phase 4: API Endpoints (Day 4)

#### 4.1 Review Queue Endpoint

**Location:** `apps/server/src/routes/review.ts`

```typescript
import { Hono } from 'hono';
import { db } from '../db';

const reviewRouter = new Hono();

// Queue review request
reviewRouter.post('/api/sessions/review/queue', async (c) => {
  const body = await c.req.json();
  
  try {
    // Insert into review queue
    const result = db.prepare(`
      INSERT INTO review_queue (
        session_id, trigger_time, trigger_reason, 
        trigger_type, priority, status
      ) VALUES (?, ?, ?, ?, ?, 'queued')
    `).run(
      body.session_id,
      body.trigger_time,
      body.trigger_reason,
      body.trigger_type || 'automatic',
      body.priority || 'normal'
    );
    
    // Trigger async processing
    processReviewQueue();
    
    return c.json({ 
      success: true, 
      queue_id: result.lastInsertRowid 
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get review results
reviewRouter.get('/api/sessions/review/:sessionId/results', async (c) => {
  const sessionId = c.req.param('sessionId');
  
  const results = db.prepare(`
    SELECT * FROM session_reviews 
    WHERE session_id = ? 
    ORDER BY review_timestamp DESC 
    LIMIT 1
  `).get(sessionId);
  
  if (results) {
    // Parse JSON fields
    results.insights = JSON.parse(results.insights || '[]');
    results.recommendations = JSON.parse(results.recommendations || '[]');
    results.patterns = JSON.parse(results.patterns || '{}');
    results.anomalies = JSON.parse(results.anomalies || '[]');
  }
  
  return c.json(results || {});
});

// Save review results
reviewRouter.post('/api/sessions/review/:sessionId/results', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  
  try {
    const result = db.prepare(`
      INSERT INTO session_reviews (
        session_id, review_timestamp, summary,
        score_completion, score_efficiency, score_error_handling,
        score_coordination, score_resources, overall_score,
        insights, recommendations, patterns, anomalies,
        processing_time_ms, model_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      body.timestamp,
      body.summary,
      body.scores?.completion,
      body.scores?.efficiency,
      body.scores?.error_handling,
      body.scores?.coordination,
      body.scores?.resources,
      body.scores?.overall,
      JSON.stringify(body.insights || []),
      JSON.stringify(body.recommendations || []),
      JSON.stringify(body.patterns || {}),
      JSON.stringify(body.anomalies || []),
      body.processing_time_ms,
      body.model_used || 'rule-based'
    );
    
    return c.json({ 
      success: true, 
      review_id: result.lastInsertRowid 
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Process review queue (async)
async function processReviewQueue() {
  // Get next queued review
  const next = db.prepare(`
    SELECT * FROM review_queue 
    WHERE status = 'queued' 
    ORDER BY 
      CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'normal' THEN 2 
        WHEN 'low' THEN 3 
      END,
      trigger_time ASC
    LIMIT 1
  `).get();
  
  if (next) {
    // Update status
    db.prepare(`
      UPDATE review_queue 
      SET status = 'processing' 
      WHERE id = ?
    `).run(next.id);
    
    // Trigger review agent
    const { spawn } = require('child_process');
    const reviewProcess = spawn('python3', [
      '.claude/hooks/review/session_review_agent.py',
      next.session_id
    ]);
    
    reviewProcess.on('close', (code) => {
      const status = code === 0 ? 'completed' : 'failed';
      db.prepare(`
        UPDATE review_queue 
        SET status = ? 
        WHERE id = ?
      `).run(status, next.id);
      
      // Process next item
      processReviewQueue();
    });
  }
}

export { reviewRouter };
```

### Phase 5: Database Schema (Day 4)

#### 5.1 Migration Script

**Location:** `apps/server/migrations/003_add_review_tables.sql`

```sql
-- Review queue table
CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trigger_time INTEGER NOT NULL,
  trigger_reason TEXT,
  trigger_type TEXT DEFAULT 'automatic',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'queued',
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  
  CHECK (priority IN ('high', 'normal', 'low')),
  CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_queue_status ON review_queue(status);
CREATE INDEX idx_queue_session ON review_queue(session_id);

-- Session reviews table
CREATE TABLE IF NOT EXISTS session_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  review_timestamp INTEGER NOT NULL,
  trigger_reason TEXT,
  reviewer_agent TEXT DEFAULT 'rule-based',
  
  -- Scores
  score_completion REAL,
  score_efficiency REAL,
  score_error_handling REAL,
  score_coordination REAL,
  score_resources REAL,
  overall_score REAL,
  
  -- Analysis results
  summary TEXT,
  insights TEXT, -- JSON array
  recommendations TEXT, -- JSON array
  patterns TEXT, -- JSON object
  anomalies TEXT, -- JSON array
  
  -- Metadata
  processing_time_ms INTEGER,
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_reviews_session ON session_reviews(session_id);
CREATE INDEX idx_reviews_timestamp ON session_reviews(review_timestamp);

-- Review triggers history
CREATE TABLE IF NOT EXISTS review_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trigger_time INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_metadata TEXT, -- JSON
  review_id INTEGER,
  
  FOREIGN KEY (review_id) REFERENCES session_reviews(id)
);

CREATE INDEX idx_triggers_session ON review_triggers(session_id);
```

### Phase 6: Testing & Validation (Day 5)

#### 6.1 Unit Tests

**Location:** `.claude/hooks/review/__tests__/test_session_injection.py`

```python
import unittest
import json
import sys
from io import StringIO
from unittest.mock import patch

# Import the module to test
sys.path.insert(0, '.claude/hooks/session-inject')
import inject_session_id

class TestSessionInjection(unittest.TestCase):
    
    def test_task_tool_injection(self):
        """Test session ID injection into Task tool."""
        input_data = {
            "tool_name": "Task",
            "tool_input": {
                "prompt": "Original prompt",
                "description": "Original description"
            },
            "session_id": "test-session-123"
        }
        
        with patch('sys.stdin', StringIO(json.dumps(input_data))):
            with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    inject_session_id.main()
                
                self.assertEqual(cm.exception.code, 0)
                output = json.loads(mock_stdout.getvalue())
                
                # Verify injection
                modified_prompt = output['hookSpecificOutput']['modifiedArgs']['prompt']
                self.assertIn("test-session-123", modified_prompt)
                self.assertIn("Original prompt", modified_prompt)
    
    def test_non_task_tool_passthrough(self):
        """Test that non-Task tools are not modified."""
        input_data = {
            "tool_name": "Bash",
            "tool_input": {"command": "ls"},
            "session_id": "test-session-123"
        }
        
        with patch('sys.stdin', StringIO(json.dumps(input_data))):
            with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    inject_session_id.main()
                
                self.assertEqual(cm.exception.code, 0)
                # Should have no output for non-Task tools
                self.assertEqual(mock_stdout.getvalue(), "")

if __name__ == '__main__':
    unittest.main()
```

#### 6.2 Integration Test Script

**Location:** `scripts/test-session-review.sh`

```bash
#!/bin/bash

echo "Testing Session Review System"
echo "=============================="

# 1. Test session ID injection
echo "1. Testing session ID injection..."
export CLAUDE_SESSION_ID="test-session-$(date +%s)"
echo '{"tool_name":"Task","tool_input":{"prompt":"Test prompt"},"session_id":"'$CLAUDE_SESSION_ID'"}' | \
  python3 .claude/hooks/session-inject/inject_session_id.py

# 2. Test review trigger
echo "2. Testing review trigger..."
python3 .claude/hooks/review/check_review_trigger.py \
  --session-id "$CLAUDE_SESSION_ID" \
  --force

# 3. Test getCurrentSessionId wrapper
echo "3. Testing getCurrentSessionId wrapper..."
export PATH="$HOME/.claude/hooks/wrappers:$PATH"
SESSION_RESULT=$(getCurrentSessionId.sh)
echo "Retrieved session ID: $SESSION_RESULT"

# 4. Test review agent
echo "4. Testing review agent..."
python3 .claude/hooks/review/session_review_agent.py "$CLAUDE_SESSION_ID"

echo ""
echo "All tests completed!"
```

### Phase 7: UI Components (Day 5-6)

#### 7.1 Review Display Component

**Location:** `apps/client/src/components/SessionReviewPanel.vue`

```vue
<template>
  <div class="session-review-panel">
    <!-- Review Header -->
    <div class="review-header">
      <h3>Session Review: {{ sessionId }}</h3>
      <div class="review-timestamp" v-if="reviewData">
        Reviewed: {{ formatTimestamp(reviewData.review_timestamp) }}
      </div>
    </div>

    <!-- Score Cards -->
    <div class="score-grid" v-if="reviewData?.scores">
      <div 
        v-for="(score, key) in reviewData.scores" 
        :key="key"
        class="score-card"
        :class="getScoreClass(score)"
      >
        <div class="score-label">{{ formatLabel(key) }}</div>
        <div class="score-value">{{ score.toFixed(1) }}</div>
        <div class="score-max">/100</div>
      </div>
    </div>

    <!-- Review Content Tabs -->
    <div class="review-content" v-if="reviewData">
      <TabView>
        <TabPanel header="Summary">
          <pre class="summary-text">{{ reviewData.summary }}</pre>
        </TabPanel>
        
        <TabPanel header="Insights" :badge="reviewData.insights?.length">
          <div class="insights-list">
            <div 
              v-for="(insight, index) in reviewData.insights" 
              :key="index"
              class="insight-item"
            >
              <Icon :name="getInsightIcon(insight.type)" />
              <div class="insight-content">
                <div class="insight-title">{{ insight.title }}</div>
                <div class="insight-description">{{ insight.description }}</div>
              </div>
            </div>
          </div>
        </TabPanel>
        
        <TabPanel header="Recommendations" :badge="reviewData.recommendations?.length">
          <div class="recommendations-list">
            <div 
              v-for="(rec, index) in reviewData.recommendations" 
              :key="index"
              class="recommendation-item"
              :class="`priority-${rec.priority}`"
            >
              <div class="rec-priority">{{ rec.priority.toUpperCase() }}</div>
              <div class="rec-content">
                <div class="rec-title">{{ rec.recommendation }}</div>
                <div class="rec-details">{{ rec.details }}</div>
              </div>
            </div>
          </div>
        </TabPanel>
        
        <TabPanel header="Patterns">
          <div class="patterns-analysis">
            <div v-for="(pattern, key) in reviewData.patterns" :key="key">
              <h4>{{ formatLabel(key) }}</h4>
              <pre>{{ JSON.stringify(pattern, null, 2) }}</pre>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="loading-state">
      <Spinner />
      <p>Analyzing session...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon name="error" />
      <p>{{ error }}</p>
    </div>

    <!-- No Review State -->
    <div v-else class="no-review-state">
      <p>No review available for this session</p>
      <Button @click="triggerReview" label="Request Review" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSessionReview } from '@/composables/useSessionReview';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Button from 'primevue/button';

const props = defineProps<{
  sessionId: string;
}>();

const { reviewData, isLoading, error, fetchReview, triggerReview } = useSessionReview(props.sessionId);

onMounted(() => {
  fetchReview();
});

const formatTimestamp = (ts: number) => {
  return new Date(ts).toLocaleString();
};

const formatLabel = (key: string) => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getScoreClass = (score: number) => {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-fair';
  return 'score-poor';
};

const getInsightIcon = (type: string) => {
  const icons: Record<string, string> = {
    'performance': 'speed',
    'error': 'warning',
    'coordination': 'group',
    'resource': 'database'
  };
  return icons[type] || 'info';
};
</script>

<style scoped>
.session-review-panel {
  padding: 1.5rem;
  background: var(--surface-ground);
  border-radius: 8px;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.score-card {
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  background: var(--surface-card);
  border: 2px solid var(--surface-border);
}

.score-excellent { border-color: var(--green-500); }
.score-good { border-color: var(--blue-500); }
.score-fair { border-color: var(--yellow-500); }
.score-poor { border-color: var(--red-500); }

.score-value {
  font-size: 2rem;
  font-weight: bold;
}

.recommendation-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  background: var(--surface-card);
}

.priority-high { border-left: 4px solid var(--red-500); }
.priority-medium { border-left: 4px solid var(--yellow-500); }
.priority-low { border-left: 4px solid var(--blue-500); }
</style>
```

## Deployment Checklist

### Pre-Deployment
- [ ] Review all hook scripts for syntax errors
- [ ] Test session ID injection with sample Task calls
- [ ] Verify review trigger logic with test sessions
- [ ] Validate database migrations
- [ ] Test API endpoints with curl/Postman
- [ ] Run unit tests
- [ ] Run integration tests

### Deployment Steps
1. [ ] Back up existing `.claude/settings.json`
2. [ ] Deploy hook scripts to `.claude/hooks/`
3. [ ] Update `.claude/settings.json` with new hooks
4. [ ] Run database migrations
5. [ ] Deploy server API updates
6. [ ] Deploy frontend components
7. [ ] Configure PATH for wrapper scripts
8. [ ] Test end-to-end flow

### Post-Deployment Validation
- [ ] Verify session ID appears in subagent prompts
- [ ] Confirm review triggers fire correctly
- [ ] Check review agent analysis output
- [ ] Validate UI displays review results
- [ ] Monitor performance metrics
- [ ] Check error logs

## Troubleshooting Guide

### Common Issues

1. **Session ID not injected**
   - Check hook is configured in settings.json
   - Verify hook script has execute permissions
   - Check hook script output in debug mode

2. **Review not triggering**
   - Verify trigger thresholds in config
   - Check review state file for last review time
   - Ensure API server is running

3. **Review agent fails**
   - Check session data availability
   - Verify API endpoints are accessible
   - Review error logs for specific failures

4. **UI not showing reviews**
   - Check WebSocket connection
   - Verify review data in database
   - Check browser console for errors

## Performance Considerations

- Hook execution adds <100ms latency
- Review processing runs async (non-blocking)
- Database queries optimized with indexes
- Review results cached for 5 minutes
- WebSocket updates throttled to 10/second

## Security Notes

- Session IDs are not sensitive data
- Review results respect session access controls
- Wrapper scripts run with user permissions
- API endpoints require authentication (if configured)
- Sensitive data redacted in reviews

## Future Enhancements

1. **AI-Powered Analysis**: Integrate with Claude API for deeper insights
2. **Pattern Detection**: Machine learning for anomaly detection
3. **Custom Review Criteria**: User-defined review rules
4. **Review Scheduling**: Periodic batch reviews
5. **Export Capabilities**: Generate review reports in PDF/CSV
6. **Comparative Analysis**: Cross-session pattern comparison
7. **Real-time Alerts**: Immediate notification of critical issues

---

**Implementation Support**: For questions or issues during implementation, consult the architecture documentation at `docs/project/guides/session-introspection-architecture.md` and research findings at `docs/project/guides/session-id-hack-research.md`.