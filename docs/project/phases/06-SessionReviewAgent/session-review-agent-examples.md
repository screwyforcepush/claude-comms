# Session Review Agent - Usage Examples

**Version:** 1.0  
**Created by:** DianaFractal  
**Date:** 2025-08-20  

## Overview

This document provides practical examples of how the Session Review Agent operates, including sample workflows, API interactions, and output formats.

## Example 1: Basic Session Analysis

### Agent Invocation
```bash
# Agent automatically gets session ID (user doesn't see this interception)
SESSION_ID=$(./getCurrentSessionId.sh)
echo "Analyzing session: $SESSION_ID"
```

### Data Collection Workflow
```bash
# 1. Fetch session events
EVENTS=$(curl -s "http://localhost:4000/events/session/$SESSION_ID")

# 2. Get agent performance data  
AGENTS=$(curl -s "http://localhost:4000/subagents/$SESSION_ID")

# 3. Retrieve inter-agent messages
MESSAGES=$(curl -s "http://localhost:4000/subagents/messages")

# 4. Get session introspection data
INTROSPECTION=$(curl -s "http://localhost:4000/api/sessions/$SESSION_ID/introspect")
```

### Sample API Response - Session Events
```json
{
  "sessionId": "session-abc123",
  "eventTypes": ["all"],
  "events": [
    {
      "id": 1,
      "session_id": "session-abc123",
      "source_app": "cc-hook-multi-agent-obvs",
      "hook_event_type": "UserPromptSubmit",
      "timestamp": 1724185200000,
      "payload": {
        "user_prompt": "Create a user authentication system with login, registration, and password reset functionality",
        "session_context": "New feature development"
      }
    },
    {
      "id": 2,
      "session_id": "session-abc123", 
      "hook_event_type": "SubagentStart",
      "timestamp": 1724185210000,
      "payload": {
        "agent_name": "AliceAuth",
        "agent_type": "engineer",
        "task_description": "Implement authentication backend APIs"
      }
    },
    {
      "id": 3,
      "session_id": "session-abc123",
      "hook_event_type": "SubagentComplete", 
      "timestamp": 1724185800000,
      "payload": {
        "agent_name": "AliceAuth",
        "status": "completed",
        "duration_ms": 590000,
        "tokens_used": 1250
      }
    }
  ],
  "count": 3
}
```

### Sample API Response - Agent Data
```json
[
  {
    "id": 1,
    "session_id": "session-abc123",
    "name": "AliceAuth",
    "subagent_type": "engineer",
    "status": "completed",
    "created_at": 1724185210000,
    "completed_at": 1724185800000,
    "total_duration_ms": 590000,
    "total_tokens": 1250,
    "input_tokens": 800,
    "output_tokens": 450,
    "initial_prompt": "Implement user authentication system...",
    "final_response": "Authentication system completed with login, registration, and password reset endpoints..."
  }
]
```

### Analysis Output Example
```json
{
  "session_id": "session-abc123",
  "analysis_timestamp": 1724186400000,
  "overall_score": 87.5,
  "dimension_scores": {
    "task_completion": 95.0,
    "efficiency": 82.0,
    "error_handling": 90.0,
    "coordination": 85.0,
    "resource_usage": 88.0
  },
  "executive_summary": "Session successfully completed user authentication requirements with high quality. Minor efficiency concerns due to single-agent approach for complex multi-component task.",
  "key_insights": [
    {
      "category": "performance",
      "insight": "Single agent handled complex multi-component task effectively but took longer than optimal",
      "impact": "medium",
      "confidence": 0.85
    },
    {
      "category": "coordination", 
      "insight": "No inter-agent communication - task could benefit from parallel development",
      "impact": "medium",
      "confidence": 0.90
    }
  ],
  "recommendations": [
    {
      "priority": "medium",
      "category": "efficiency",
      "title": "Implement parallel agent development",
      "description": "Split authentication task into frontend and backend components for parallel development",
      "expected_impact": "30-40% reduction in completion time",
      "implementation_effort": "low"
    }
  ],
  "deviation_analysis": {
    "requirements_coverage": {
      "requested": ["login", "registration", "password_reset"],
      "delivered": ["login", "registration", "password_reset"],
      "coverage_score": 100,
      "missing_items": [],
      "additional_items": ["input_validation", "rate_limiting"]
    },
    "execution_efficiency": {
      "optimal_agent_count": "2-3 agents",
      "actual_agent_count": "1 agent", 
      "efficiency_impact": "Medium - could be 30% faster with parallelization"
    }
  }
}
```

## Example 2: Deviation Detection

### Scenario: Scope Creep Detection

#### User Request
```
"Create a simple todo list app with basic CRUD operations"
```

#### Actual Execution
- Agent created full-featured todo app
- Added user authentication
- Implemented team collaboration features
- Added advanced filtering and search
- Included data export functionality

#### Deviation Analysis Output
```json
{
  "deviation_analysis": {
    "scope_analysis": {
      "requested_scope": {
        "features": ["create_todo", "read_todo", "update_todo", "delete_todo"],
        "complexity": "simple",
        "estimated_effort": "low"
      },
      "actual_scope": {
        "features": [
          "create_todo", "read_todo", "update_todo", "delete_todo",
          "user_authentication", "team_collaboration", 
          "advanced_filtering", "data_export"
        ],
        "complexity": "complex",
        "actual_effort": "high"
      },
      "deviation_type": "scope_creep",
      "deviation_severity": "high",
      "impact_assessment": {
        "time_overhead": "250% of estimated time",
        "resource_overhead": "200% of estimated resources",
        "value_alignment": "medium - added features may provide value but weren't requested"
      }
    },
    "recommendations": [
      {
        "priority": "high",
        "category": "scope_management",
        "title": "Implement scope validation checkpoints",
        "description": "Add validation steps before implementing features beyond core requirements",
        "prevention_strategy": "Require explicit user confirmation before scope expansion"
      }
    ]
  }
}
```

## Example 3: Performance Issue Detection

### Scenario: Inefficient Agent Coordination

#### Event Timeline Analysis
```json
{
  "coordination_analysis": {
    "timeline_issues": [
      {
        "issue_type": "sequential_blocking",
        "description": "Agent B waited 15 minutes for Agent A to complete independent task",
        "impact": "15 minutes unnecessary delay",
        "agents_involved": ["AgentA-DatabaseDesign", "AgentB-APIImplementation"],
        "root_cause": "Poor task dependency analysis"
      },
      {
        "issue_type": "communication_gap",
        "description": "Agent C reimplemented functionality already created by Agent A",
        "impact": "2 hours duplicate work",
        "agents_involved": ["AgentA-AuthService", "AgentC-UserManagement"],
        "root_cause": "Lack of inter-agent status communication"
      }
    ],
    "coordination_score": 45.0,
    "recommendations": [
      {
        "priority": "high",
        "title": "Implement dependency-aware task scheduling",
        "description": "Analyze task dependencies before agent assignment to enable parallel execution",
        "expected_improvement": "40-60% reduction in total completion time"
      },
      {
        "priority": "high", 
        "title": "Enhance inter-agent communication protocols",
        "description": "Implement regular status broadcasts to prevent duplicate work",
        "expected_improvement": "Eliminate 80%+ of duplicate effort"
      }
    ]
  }
}
```

## Example 4: Success Pattern Recognition

### Scenario: Highly Efficient Session

#### Analysis Output
```json
{
  "success_patterns": [
    {
      "pattern_type": "optimal_parallelization",
      "description": "Three agents worked on independent components simultaneously",
      "effectiveness_score": 95.0,
      "time_savings": "65% faster than sequential approach",
      "agents_involved": ["FrontendAgent", "BackendAgent", "DatabaseAgent"],
      "replication_strategy": "Apply similar component-based parallelization to similar tasks"
    },
    {
      "pattern_type": "proactive_communication",
      "description": "Agents exchanged interface definitions early to prevent integration issues",
      "effectiveness_score": 88.0,
      "error_prevention": "Zero integration conflicts",
      "communication_frequency": "Every 30 minutes during development",
      "replication_strategy": "Enforce regular interface alignment checks"
    }
  ],
  "overall_session_quality": "excellent",
  "replication_recommendations": [
    "Use component-based agent assignment for complex features",
    "Implement mandatory interface definition sharing",
    "Schedule regular coordination checkpoints every 30 minutes"
  ]
}
```

## Example 5: Error Pattern Analysis

### Scenario: Recurring Error Detection

#### Error Analysis Output
```json
{
  "error_analysis": {
    "recurring_patterns": [
      {
        "pattern_id": "database_connection_failures",
        "frequency": 3,
        "affected_agents": ["DataAgent1", "DataAgent2", "AnalyticsAgent"],
        "pattern_description": "Multiple agents experiencing database connection timeouts",
        "root_cause_hypothesis": "Connection pool exhaustion or database overload",
        "resolution_effectiveness": "Manual restarts temporarily resolved issues",
        "prevention_recommendations": [
          "Implement connection pooling with proper limits",
          "Add database health monitoring",
          "Implement exponential backoff retry logic"
        ]
      }
    ],
    "error_recovery_quality": {
      "score": 72.0,
      "strengths": ["Agents detected failures quickly", "Automatic retry mechanisms worked"],
      "weaknesses": ["No proactive monitoring", "Manual intervention required"],
      "improvement_areas": [
        "Add predictive failure detection",
        "Implement automatic failover mechanisms"
      ]
    }
  }
}
```

## Agent Prompt Templates

### Template 1: Initial Session Analysis
```
You are analyzing Claude Code session {session_id} to evaluate performance and identify optimization opportunities.

SESSION DATA:
- Total Events: {event_count}
- Active Agents: {agent_count}  
- Session Duration: {duration_minutes} minutes
- User Intent: "{user_prompt}"

AGENT PERFORMANCE SUMMARY:
{agent_performance_data}

TIMELINE HIGHLIGHTS:
{key_timeline_events}

Your analysis should cover:

1. TASK COMPLETION (0-100): Did the session achieve the user's stated objectives?
   - Compare delivered features against requested features
   - Assess quality and completeness of deliverables
   - Identify any missing requirements

2. EFFICIENCY (0-100): Was the task completed optimally?
   - Analyze total time vs expected time
   - Identify unnecessary delays or blocking
   - Evaluate resource utilization

3. ERROR HANDLING (0-100): How well were errors managed?
   - Review error frequency and types
   - Assess recovery mechanisms
   - Evaluate impact on overall progress

4. COORDINATION (0-100): How effectively did agents work together?
   - Analyze communication patterns
   - Identify coordination issues
   - Assess parallel vs sequential work distribution

5. RESOURCE USAGE (0-100): Were computational resources used efficiently?
   - Evaluate token usage patterns
   - Assess agent utilization rates
   - Identify resource waste or optimization opportunities

Provide specific scores and evidence-based insights for each dimension.
```

### Template 2: Deviation Analysis Focus
```
Analyze this session for deviations between user intent and actual execution:

USER REQUEST:
"{original_user_prompt}"

EXECUTION SUMMARY:
{execution_timeline}

DELIVERABLES ANALYSIS:
Requested: {requested_features}
Delivered: {actual_deliverables}

Identify deviations in these categories:

1. SCOPE DEVIATIONS:
   - Features added beyond requirements
   - Requirements not addressed
   - Complexity escalation beyond needs

2. PROCESS DEVIATIONS:
   - Inefficient execution approaches
   - Unnecessary sequential dependencies
   - Suboptimal agent task assignments

3. QUALITY DEVIATIONS:
   - Over-engineering simple requirements
   - Under-delivering on quality expectations
   - Missing validation or error handling

For each deviation found:
- Categorize the type and severity
- Assess the impact (time, resources, quality)
- Determine if the deviation added or detracted value
- Recommend prevention strategies

Focus on actionable insights that improve future session planning.
```

## Integration with Meta-Agent Builder

### Agent Specification Usage
The meta-agent-builder can use this specification to:

1. **Generate Agent Instances**: Create session-review agents with proper capability configuration
2. **Define Tool Access**: Configure bash tool access for API calls and script execution  
3. **Set Analysis Parameters**: Customize analysis depth and focus areas
4. **Configure Output Formats**: Ensure consistent result formatting across agents

### Builder Configuration Example
```json
{
  "agent_type": "session-review-agent",
  "instance_name": "SessionAnalyzer-001",
  "capabilities_config": {
    "deviation_analysis": true,
    "performance_evaluation": true,
    "insights_generation": true,
    "recommendations_engine": true
  },
  "tool_permissions": ["Bash", "Read", "Write"],
  "api_endpoints": [
    "http://localhost:4000/events/session/*",
    "http://localhost:4000/subagents/*", 
    "http://localhost:4000/api/sessions/*/introspect"
  ],
  "output_destinations": ["file", "api_post"]
}
```

This specification provides a comprehensive foundation for creating AI agents capable of sophisticated session analysis while seamlessly integrating with existing observability infrastructure through the hook-based interception mechanism.