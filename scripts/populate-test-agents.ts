#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { resolve } from 'path';

// Interface for test agent data
interface TestAgent {
  sessionId: string;
  name: string;
  subagentType: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
  duration?: number;
  tokenCount?: number;
  toolCount?: number;
  summary?: string;
  errorMessage?: string;
}

// Interface for test event data
interface TestEvent {
  sourceApp: string;
  sessionId: string;
  hookEventType: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp: number;
}

// Realistic agent names
const AGENT_NAMES = [
  'JohnSmith', 'SarahJones', 'MikeChang', 'LisaWong', 'TomBrown', 'AmyLee', 'DavidLiu', 
  'EmilyChen', 'JamesTaylor', 'MariaSilva', 'KevinWang', 'RachelGreen', 'SteveMartin',
  'JenniferLee', 'MichaelScott', 'PaulAllen', 'ChrisEvans', 'DianaPrice', 'GeorgeKing',
  'HelenCarter', 'BobJones', 'NancyPark', 'RobertKim', 'AlexJohnson', 'BrianMiller',
  'CarolWhite', 'DanielBrown', 'EvaGarcia', 'FrankWilson', 'GraceNguyen'
];

// Agent types with realistic distributions
const AGENT_TYPES = [
  'general-purpose', 'engineer', 'tester', 'code-reviewer', 'architect', 
  'designer', 'business-analyst', 'deep-researcher', 'planner'
];

// Hook event types for realistic events
const HOOK_EVENTS = [
  'task_started', 'task_completed', 'tool_usage', 'error_occurred', 
  'milestone_reached', 'status_update', 'communication_sent'
];

// Chat message templates
const CHAT_TEMPLATES = [
  { role: 'user', content: 'Please implement the authentication feature according to the specifications.' },
  { role: 'assistant', content: 'I\'ll implement the authentication system. Let me start by analyzing the requirements and current codebase structure.' },
  { role: 'assistant', content: 'I\'ve completed the initial implementation. Running tests now to ensure everything works correctly.' },
  { role: 'user', content: 'Make sure to handle edge cases like expired tokens and invalid credentials.' },
  { role: 'assistant', content: 'Authentication system implemented successfully with comprehensive error handling and test coverage.' }
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDuration(): number {
  // Duration ranges from 500ms to 120000ms (2 minutes)
  const ranges = [
    [500, 2000],      // Quick tasks (30%)
    [2000, 15000],    // Medium tasks (40%)
    [15000, 60000],   // Long tasks (25%)
    [60000, 120000]   // Very long tasks (5%)
  ];
  
  const weights = [0.3, 0.4, 0.25, 0.05];
  let random = Math.random();
  let selectedRange = ranges[0];
  
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      selectedRange = ranges[i];
      break;
    }
    random -= weights[i];
  }
  
  return getRandomInt(selectedRange[0], selectedRange[1]);
}

function getRandomTokenCount(): number {
  // Token counts from 100 to 50000
  const ranges = [
    [100, 1000],      // Small tasks (40%)
    [1000, 5000],     // Medium tasks (35%)
    [5000, 15000],    // Large tasks (20%)
    [15000, 50000]    // Very large tasks (5%)
  ];
  
  const weights = [0.4, 0.35, 0.2, 0.05];
  let random = Math.random();
  let selectedRange = ranges[0];
  
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      selectedRange = ranges[i];
      break;
    }
    random -= weights[i];
  }
  
  return getRandomInt(selectedRange[0], selectedRange[1]);
}

function getRandomToolCount(): number {
  return getRandomInt(1, 30);
}

function generateTestAgents(): TestAgent[] {
  const agents: TestAgent[] = [];
  const now = Date.now();
  
  // Session 1: 5 agents (3 completed, 1 in_progress, 1 pending)
  const session1 = 'session-2024-01-15-auth-feature';
  const session1StartTime = now - (2 * 60 * 60 * 1000); // 2 hours ago
  
  // Completed agents for session 1
  for (let i = 0; i < 3; i++) {
    const completedTime = session1StartTime + (i * 20 * 60 * 1000); // Staggered completion
    agents.push({
      sessionId: session1,
      name: AGENT_NAMES[i],
      subagentType: getRandomElement(AGENT_TYPES),
      status: 'completed',
      createdAt: completedTime,
      duration: getRandomDuration(),
      tokenCount: getRandomTokenCount(),
      toolCount: getRandomToolCount(),
      summary: `Successfully implemented ${getRandomElement(['authentication API', 'user validation', 'session management', 'password hashing', 'JWT tokens'])} with comprehensive test coverage.`
    });
  }
  
  // In-progress agent for session 1
  agents.push({
    sessionId: session1,
    name: AGENT_NAMES[3],
    subagentType: 'engineer',
    status: 'in_progress',
    createdAt: session1StartTime + (3 * 20 * 60 * 1000),
    tokenCount: getRandomTokenCount(),
    toolCount: getRandomToolCount(),
    summary: 'Currently implementing OAuth integration. Progress: 65% complete.'
  });
  
  // Pending agent for session 1
  agents.push({
    sessionId: session1,
    name: AGENT_NAMES[4],
    subagentType: 'tester',
    status: 'pending',
    createdAt: session1StartTime + (4 * 20 * 60 * 1000),
    summary: 'Waiting to begin integration testing once OAuth implementation is complete.'
  });
  
  // Session 2: 3 agents (all completed with different durations/token counts)
  const session2 = 'session-2024-01-15-ui-components';
  const session2StartTime = now - (4 * 60 * 60 * 1000); // 4 hours ago
  
  for (let i = 0; i < 3; i++) {
    const completedTime = session2StartTime + (i * 30 * 60 * 1000);
    agents.push({
      sessionId: session2,
      name: AGENT_NAMES[5 + i],
      subagentType: getRandomElement(['designer', 'engineer', 'code-reviewer']),
      status: 'completed',
      createdAt: completedTime,
      duration: getRandomDuration(),
      tokenCount: getRandomTokenCount(),
      toolCount: getRandomToolCount(),
      summary: `Completed ${getRandomElement(['component library', 'responsive design', 'accessibility features', 'theme system', 'animation framework'])} implementation.`
    });
  }
  
  // Session 3: 2 agents (1 completed, 1 in_progress)
  const session3 = 'session-2024-01-15-database-migration';
  const session3StartTime = now - (1 * 60 * 60 * 1000); // 1 hour ago
  
  // Completed agent
  agents.push({
    sessionId: session3,
    name: AGENT_NAMES[8],
    subagentType: 'architect',
    status: 'completed',
    createdAt: session3StartTime,
    duration: getRandomDuration(),
    tokenCount: getRandomTokenCount(),
    toolCount: getRandomToolCount(),
    summary: 'Database schema migration completed successfully. All tests passing.'
  });
  
  // In-progress agent
  agents.push({
    sessionId: session3,
    name: AGENT_NAMES[9],
    subagentType: 'engineer',
    status: 'in_progress',
    createdAt: session3StartTime + (30 * 60 * 1000),
    tokenCount: getRandomTokenCount(),
    toolCount: getRandomToolCount(),
    summary: 'Updating application queries to match new schema. Progress: 45% complete.'
  });
  
  return agents;
}

function generateTestEvents(agents: TestAgent[]): TestEvent[] {
  const events: TestEvent[] = [];
  
  for (const agent of agents) {
    const baseTime = agent.createdAt;
    
    // Task started event
    events.push({
      sourceApp: 'claude-code',
      sessionId: agent.sessionId,
      hookEventType: 'task_started',
      payload: {
        agent_name: agent.name,
        agent_type: agent.subagentType,
        task_description: `Starting ${agent.subagentType} task`,
        estimated_duration: agent.duration || null
      },
      chat: CHAT_TEMPLATES.slice(0, 2),
      summary: `${agent.name} started working on task`,
      timestamp: baseTime
    });
    
    // Progress updates for in-progress and completed agents
    if (agent.status !== 'pending') {
      const progressTime = baseTime + (agent.duration ? agent.duration * 0.3 : 10000);
      events.push({
        sourceApp: 'claude-code',
        sessionId: agent.sessionId,
        hookEventType: 'status_update',
        payload: {
          agent_name: agent.name,
          status: agent.status === 'completed' ? 'in_progress' : agent.status,
          progress_percentage: agent.status === 'completed' ? 50 : 45,
          tokens_used: Math.floor((agent.tokenCount || 1000) * 0.5),
          tools_used: Math.floor((agent.toolCount || 5) * 0.5)
        },
        chat: CHAT_TEMPLATES.slice(0, 3),
        summary: `${agent.name} progress update`,
        timestamp: progressTime
      });
    }
    
    // Tool usage events
    if (agent.status !== 'pending') {
      const toolTime = baseTime + (agent.duration ? agent.duration * 0.6 : 20000);
      events.push({
        sourceApp: 'claude-code',
        sessionId: agent.sessionId,
        hookEventType: 'tool_usage',
        payload: {
          agent_name: agent.name,
          tool_name: getRandomElement(['Read', 'Write', 'Bash', 'Edit', 'Grep', 'TodoWrite']),
          tool_parameters: {
            file_path: '/src/components/auth.ts',
            operation: 'edit'
          },
          execution_time_ms: getRandomInt(100, 5000)
        },
        summary: `${agent.name} used development tools`,
        timestamp: toolTime
      });
    }
    
    // Completion event for completed agents
    if (agent.status === 'completed') {
      const completionTime = baseTime + (agent.duration || 60000);
      events.push({
        sourceApp: 'claude-code',
        sessionId: agent.sessionId,
        hookEventType: 'task_completed',
        payload: {
          agent_name: agent.name,
          status: 'completed',
          total_duration_ms: agent.duration,
          total_tokens: agent.tokenCount,
          total_tools: agent.toolCount,
          success: true,
          completion_summary: agent.summary
        },
        chat: CHAT_TEMPLATES,
        summary: agent.summary || `${agent.name} completed task successfully`,
        timestamp: completionTime
      });
    }
    
    // Communication events
    const commTime = baseTime + (agent.duration ? agent.duration * 0.4 : 15000);
    events.push({
      sourceApp: 'claude-code',
      sessionId: agent.sessionId,
      hookEventType: 'communication_sent',
      payload: {
        sender: agent.name,
        message_type: 'broadcast',
        message: `Progress update from ${agent.name}: Working on ${agent.subagentType} tasks`,
        recipients: ['team']
      },
      summary: `${agent.name} sent team communication`,
      timestamp: commTime
    });
  }
  
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

async function populateTestData() {
  console.log('🚀 Starting test data population...');
  
  // Connect to database
  const dbPath = resolve('./apps/server/events.db');
  const db = new Database(dbPath);
  
  try {
    console.log(`📊 Connected to database: ${dbPath}`);
    
    // Generate test data
    console.log('📝 Generating test agent data...');
    const agents = generateTestAgents();
    const events = generateTestEvents(agents);
    
    console.log(`Generated ${agents.length} test agents across ${new Set(agents.map(a => a.sessionId)).size} sessions`);
    console.log(`Generated ${events.length} test events`);
    
    // Clear existing test data (optional - comment out to preserve existing data)
    console.log('🧹 Clearing existing test data...');
    db.exec('DELETE FROM subagent_registry WHERE session_id LIKE "session-2024-01-15-%"');
    db.exec('DELETE FROM subagent_messages WHERE sender IN ("' + AGENT_NAMES.join('","') + '")');
    db.exec('DELETE FROM events WHERE session_id LIKE "session-2024-01-15-%"');
    
    // Insert subagent registry entries
    console.log('👥 Inserting subagent registry data...');
    const registerStmt = db.prepare(`
      INSERT INTO subagent_registry (session_id, name, subagent_type, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    for (const agent of agents) {
      registerStmt.run(agent.sessionId, agent.name, agent.subagentType, agent.createdAt);
    }
    
    // Insert events
    console.log('📅 Inserting event data...');
    const eventStmt = db.prepare(`
      INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const event of events) {
      eventStmt.run(
        event.sourceApp,
        event.sessionId,
        event.hookEventType,
        JSON.stringify(event.payload),
        event.chat ? JSON.stringify(event.chat) : null,
        event.summary || null,
        event.timestamp
      );
    }
    
    // Insert some inter-agent messages
    console.log('💬 Inserting inter-agent messages...');
    const messageStmt = db.prepare(`
      INSERT INTO subagent_messages (sender, message, created_at, notified)
      VALUES (?, ?, ?, ?)
    `);
    
    const sampleMessages = [
      {
        sender: agents[0].name,
        message: 'Authentication API endpoints are ready for testing. All unit tests passing.',
        created_at: agents[0].createdAt + 30000,
        notified: [agents[3].name, agents[4].name]
      },
      {
        sender: agents[1].name,
        message: 'User validation logic implemented with comprehensive error handling.',
        created_at: agents[1].createdAt + 45000,
        notified: [agents[0].name]
      },
      {
        sender: agents[3].name,
        message: 'OAuth integration is 65% complete. Encountered some edge cases with token refresh.',
        created_at: agents[3].createdAt + 60000,
        notified: [agents[0].name, agents[1].name]
      },
      {
        sender: agents[5].name,
        message: 'Component library design system is complete. Ready for implementation.',
        created_at: agents[5].createdAt + 20000,
        notified: [agents[6].name, agents[7].name]
      }
    ];
    
    for (const msg of sampleMessages) {
      messageStmt.run(
        msg.sender,
        JSON.stringify(msg.message),
        msg.created_at,
        JSON.stringify(msg.notified)
      );
    }
    
    console.log('✅ Test data population completed successfully!');
    console.log('\nTest Data Summary:');
    console.log('==================');
    console.log(`📋 Sessions: ${new Set(agents.map(a => a.sessionId)).size}`);
    console.log(`👥 Agents: ${agents.length}`);
    console.log(`📊 Events: ${events.length}`);
    console.log(`💬 Messages: ${sampleMessages.length}`);
    console.log('\nSession Breakdown:');
    
    const sessionCounts = agents.reduce((acc, agent) => {
      acc[agent.sessionId] = (acc[agent.sessionId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [sessionId, count] of Object.entries(sessionCounts)) {
      const sessionAgents = agents.filter(a => a.sessionId === sessionId);
      const statusCounts = sessionAgents.reduce((acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`  ${sessionId}: ${count} agents (${Object.entries(statusCounts).map(([status, cnt]) => `${cnt} ${status}`).join(', ')})`);
    }
    
    console.log('\n🎯 UI test scenarios covered:');
    console.log('• Multiple sessions with different agent counts');
    console.log('• All agent statuses (pending, in_progress, completed)');
    console.log('• Wide range of durations (500ms - 120s)');
    console.log('• Varied token counts (100 - 50,000)');
    console.log('• Different tool usage patterns (1-30 tools)');
    console.log('• Realistic agent names and types');
    console.log('• Inter-agent communication examples');
    console.log('• Chat transcripts and summaries');
    
  } catch (error) {
    console.error('❌ Error populating test data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
if (import.meta.main) {
  populateTestData();
}