import type { AgentStatus, SubagentMessage, HookEvent } from '../types';

/**
 * Sample test data for timeline transformation testing
 */

export const sampleAgents: AgentStatus[] = [
  // Batch 1: Planning agents (spawned simultaneously)
  {
    id: 1,
    name: "AlexArchitect",
    subagent_type: "architect",
    created_at: 1700000000000,
    status: "completed",
    completion_timestamp: 1700000120000,
    duration: 120000,
    token_count: 1500,
    tool_count: 8
  },
  {
    id: 2,
    name: "SarahPlanner", 
    subagent_type: "planner",
    created_at: 1700000001000, // 1ms later - same batch
    status: "completed",
    completion_timestamp: 1700000110000,
    duration: 109000,
    token_count: 1200,
    tool_count: 6
  },
  
  // Batch 2: Implementation agents (spawned 5 minutes later)
  {
    id: 3,
    name: "BobBackend",
    subagent_type: "engineer", 
    created_at: 1700000300000, // 5 minutes later
    status: "completed",
    completion_timestamp: 1700000480000,
    duration: 180000,
    token_count: 2500,
    tool_count: 15
  },
  {
    id: 4,
    name: "AliceFrontend",
    subagent_type: "engineer",
    created_at: 1700000301000, // 1ms later - same batch
    status: "in_progress",
    duration: undefined,
    token_count: 1800,
    tool_count: 12
  },
  {
    id: 5,
    name: "TomTester",
    subagent_type: "tester",
    created_at: 1700000302000, // 2ms later - same batch
    status: "pending",
    duration: undefined,
    token_count: 500,
    tool_count: 3
  },
  
  // Batch 3: Review agents (spawned 10 minutes later)
  {
    id: 6,
    name: "CarolReviewer",
    subagent_type: "code-reviewer",
    created_at: 1700000600000, // 10 minutes later
    status: "pending",
    duration: undefined,
    token_count: 200,
    tool_count: 1
  }
];

export const sampleMessages: SubagentMessage[] = [
  {
    sender: "AlexArchitect",
    message: "System architecture designed. Using microservices pattern with API gateway.",
    created_at: 1700000060000,
    notified: ["SarahPlanner"]
  },
  {
    sender: "SarahPlanner", 
    message: "Work packages created: WP-001 (API endpoints), WP-002 (Frontend components), WP-003 (Tests)",
    created_at: 1700000080000,
    notified: ["AlexArchitect"]
  },
  {
    sender: "BobBackend",
    message: "API endpoints implemented. All tests passing. Ready for integration.",
    created_at: 1700000450000,
    notified: ["AliceFrontend", "TomTester"]
  },
  {
    sender: "AliceFrontend",
    message: "Frontend components 80% complete. Need clarification on user authentication flow.",
    created_at: 1700000520000,
    notified: ["BobBackend", "AlexArchitect"]
  },
  {
    sender: "TomTester",
    message: "Test suite created. Found 3 edge cases in user validation. Documenting findings.",
    created_at: 1700000560000,
    notified: ["BobBackend", "AliceFrontend"]
  }
];

export const sampleEvents: HookEvent[] = [
  {
    id: 1,
    source_app: "claude-code",
    session_id: "test-session-123",
    hook_event_type: "session_start",
    payload: { user: "developer", project: "multi-agent-system" },
    timestamp: 1699999900000,
    summary: "Session started"
  },
  {
    id: 2,
    source_app: "claude-code", 
    session_id: "test-session-123",
    hook_event_type: "user_input",
    payload: { input: "Implement user authentication system with multi-factor auth" },
    timestamp: 1699999950000,
    summary: "User requested authentication system implementation"
  },
  {
    id: 3,
    source_app: "claude-code",
    session_id: "test-session-123", 
    hook_event_type: "task_created",
    payload: { task_id: "task-001", description: "Create architecture design" },
    timestamp: 1699999990000,
    summary: "Architecture task created"
  }
];

/**
 * Test the timeline data transformation
 */
export function testTimelineTransformation() {
  console.log('Testing timeline data transformation...');
  
  // Test batch detection
  console.log('Sample agents:', sampleAgents.length);
  console.log('Sample messages:', sampleMessages.length);
  console.log('Sample events:', sampleEvents.length);
  
  // Verify time ranges
  const agentTimes = sampleAgents.map(a => a.created_at);
  const messageTimes = sampleMessages.map(m => m.created_at);
  const eventTimes = sampleEvents.map(e => e.timestamp).filter(Boolean) as number[];
  
  console.log('Agent time range:', {
    min: Math.min(...agentTimes),
    max: Math.max(...agentTimes)
  });
  
  console.log('Message time range:', {
    min: Math.min(...messageTimes),
    max: Math.max(...messageTimes) 
  });
  
  console.log('Event time range:', {
    min: Math.min(...eventTimes),
    max: Math.max(...eventTimes)
  });
  
  return {
    agents: sampleAgents,
    messages: sampleMessages,
    events: sampleEvents
  };
}

/**
 * Stress test data for performance testing
 */
export function generateStressTestData(agentCount: number = 100): {
  agents: AgentStatus[];
  messages: SubagentMessage[];
  events: HookEvent[];
} {
  const agents: AgentStatus[] = [];
  const messages: SubagentMessage[] = [];
  const events: HookEvent[] = [];
  
  const baseTime = Date.now() - 3600000; // 1 hour ago
  const agentTypes = ['architect', 'engineer', 'tester', 'code-reviewer', 'planner'];
  const statusOptions: ('pending' | 'in_progress' | 'completed')[] = ['pending', 'in_progress', 'completed'];
  
  // Generate agents in batches
  let currentBatchTime = baseTime;
  const batchSize = Math.floor(Math.random() * 8) + 3; // 3-10 agents per batch
  
  for (let i = 0; i < agentCount; i++) {
    // Start new batch every batchSize agents
    if (i % batchSize === 0) {
      currentBatchTime += Math.random() * 300000 + 120000; // 2-7 minutes between batches
    }
    
    const createdAt = currentBatchTime + Math.random() * 50; // Within 50ms for same batch
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
    const completedAt = status === 'completed' 
      ? createdAt + Math.random() * 600000 + 30000 // 30s - 10min completion time
      : undefined;
    
    agents.push({
      id: i + 1,
      name: `Agent${i + 1}`,
      subagent_type: agentTypes[Math.floor(Math.random() * agentTypes.length)],
      created_at: createdAt,
      status,
      completion_timestamp: completedAt,
      duration: completedAt ? completedAt - createdAt : undefined,
      token_count: Math.floor(Math.random() * 3000) + 500,
      tool_count: Math.floor(Math.random() * 20) + 1
    });
    
    // Generate messages for some agents
    if (Math.random() < 0.6) { // 60% chance to send message
      messages.push({
        sender: `Agent${i + 1}`,
        message: `Status update from Agent${i + 1}: ${status}`,
        created_at: createdAt + Math.random() * 60000, // Within 1 minute of spawn
        notified: []
      });
    }
  }
  
  // Generate some user events
  for (let i = 0; i < Math.floor(agentCount / 20); i++) {
    events.push({
      id: i + 1,
      source_app: "claude-code",
      session_id: "stress-test-session",
      hook_event_type: "user_input",
      payload: { input: `User command ${i + 1}` },
      timestamp: baseTime + i * 200000, // Every 3-4 minutes
      summary: `User input ${i + 1}`
    });
  }
  
  console.log(`Generated stress test data: ${agents.length} agents, ${messages.length} messages, ${events.length} events`);
  
  return { agents, messages, events };
}