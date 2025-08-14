/**
 * Mock Data Generator for Multi-Session Testing
 * TestTiger - Realistic test data creation utilities
 */

import type {
  SessionTimelineData,
  MultiSessionTimelineData,
  SessionMetrics,
  SessionStatus,
  SessionTimeWindow
} from '../../types/multi-session';
import type {
  AgentPath,
  AgentBatch,
  TimelineMessage,
  UserPrompt,
  OrchestratorEvent,
  AgentStatus
} from '../../types/timeline';
// Local type definitions for mock data generation
interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  timestamp?: number;
}

interface Subagent {
  id?: number;
  session_id: string;
  name: string;
  subagent_type: string;
  created_at: number;
  status?: string;
  completed_at?: number;
  total_duration_ms?: number;
  total_tokens?: number;
}

interface SubagentMessage {
  sender: string;
  message: any;
  created_at: number;
}

export class MockDataGenerator {
  private currentTime = Date.now();
  private sessionCounter = 0;
  private agentCounter = 0;
  private messageCounter = 0;
  private eventCounter = 0;

  constructor(baseTime?: number) {
    if (baseTime) {
      this.currentTime = baseTime;
    }
  }

  /**
   * Generate a single realistic session with agents
   */
  generateSession(options: {
    sessionId?: string;
    agentCount?: number;
    status?: SessionStatus;
    durationMinutes?: number;
    startTimeOffset?: number; // Minutes from current time
    includeFailures?: boolean;
    complexity?: 'simple' | 'moderate' | 'complex';
  } = {}): SessionTimelineData {
    const {
      sessionId = `session-${++this.sessionCounter}`,
      agentCount = this.randomBetween(3, 8),
      status = this.randomChoice(['active', 'completed', 'failed']),
      durationMinutes = this.randomBetween(15, 120),
      startTimeOffset = -this.randomBetween(10, 300),
      includeFailures = Math.random() < 0.2,
      complexity = this.randomChoice(['simple', 'moderate', 'complex'])
    } = options;

    const startTime = this.currentTime + (startTimeOffset * 60 * 1000);
    const endTime = status === 'active' ? undefined : startTime + (durationMinutes * 60 * 1000);

    // Generate agents based on complexity
    const agentPaths = this.generateAgentPaths(sessionId, agentCount, startTime, endTime, includeFailures, complexity);
    
    // Generate orchestrator events
    const orchestratorEvents = this.generateOrchestratorEvents(sessionId, startTime, endTime, agentPaths.length);
    
    // Generate user prompts
    const userPrompts = this.generateUserPrompts(sessionId, startTime, endTime);
    
    // Generate agent batches
    const agentBatches = this.generateAgentBatches(sessionId, startTime, endTime, agentPaths);
    
    // Generate inter-agent messages
    const messages = this.generateMessages(sessionId, agentPaths, startTime, endTime);

    // Calculate metrics
    const metrics = this.calculateSessionMetrics(agentPaths, messages, startTime, endTime);

    return {
      sessionId,
      displayName: this.generateDisplayName(sessionId, complexity),
      startTime,
      endTime,
      status,
      orchestratorEvents,
      userPrompts,
      agentBatches,
      agentPaths,
      messages,
      sessionLaneOffset: 0, // Will be set by layout manager
      sessionLaneHeight: 120,
      metrics,
      color: this.generateSessionColor(sessionId)
    };
  }

  /**
   * Generate multiple sessions for testing
   */
  generateMultipleSessions(count: number, options: {
    timeSpreadHours?: number;
    statusDistribution?: { active: number; completed: number; failed: number };
    complexityMix?: boolean;
  } = {}): SessionTimelineData[] {
    const {
      timeSpreadHours = 24,
      statusDistribution = { active: 0.3, completed: 0.6, failed: 0.1 },
      complexityMix = true
    } = options;

    const sessions: SessionTimelineData[] = [];
    const timeSpread = timeSpreadHours * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const timeOffset = -Math.random() * timeSpread;
      const status = this.randomChoiceWeighted(['active', 'completed', 'failed'], [
        statusDistribution.active,
        statusDistribution.completed,
        statusDistribution.failed
      ]) as 'active' | 'completed' | 'failed';
      
      const complexity = (complexityMix 
        ? this.randomChoice(['simple', 'moderate', 'complex'])
        : 'moderate') as 'simple' | 'moderate' | 'complex';

      const session = this.generateSession({
        startTimeOffset: timeOffset / (60 * 1000),
        status,
        complexity
      });

      sessions.push(session);
    }

    return sessions.sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Generate MultiSessionTimelineData
   */
  generateMultiSessionData(sessionCount: number = 10): MultiSessionTimelineData {
    const sessions = this.generateMultipleSessions(sessionCount);
    
    const allTimes = sessions.flatMap(s => [s.startTime, s.endTime].filter((t): t is number => typeof t === 'number'));
    const minTime = allTimes.length > 0 ? Math.min(...allTimes) : Date.now();
    const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : Date.now();
    const timeRange = {
      start: minTime,
      end: maxTime,
      duration: maxTime - minTime
    };

    // Add session lane offsets
    sessions.forEach((session, index) => {
      session.sessionLaneOffset = index * 120;
    });

    return {
      sessions,
      timeRange,
      sessionLayout: 'swim_lanes',
      lastUpdated: this.currentTime,
      totalSessions: sessions.length,
      totalAgents: sessions.reduce((sum, s) => sum + s.agentPaths.length, 0)
    };
  }

  /**
   * Generate agent paths for a session
   */
  private generateAgentPaths(
    sessionId: string,
    count: number,
    sessionStart: number,
    sessionEnd: number | undefined,
    includeFailures: boolean,
    complexity: string
  ): AgentPath[] {
    const agents: AgentPath[] = [];
    const agentTypes = complexity === 'simple' 
      ? ['engineer', 'tester']
      : complexity === 'moderate'
      ? ['engineer', 'tester', 'code-reviewer', 'planner']
      : ['engineer', 'tester', 'code-reviewer', 'planner', 'architect', 'business-analyst'];

    // Always start with orchestrator
    const orchestratorDuration = sessionEnd ? sessionEnd - sessionStart : this.randomBetween(30, 120) * 60 * 1000;
    agents.push({
      agentId: ++this.agentCounter,
      agentName: 'Primary-Orchestrator',
      agentType: 'orchestrator',
      startTime: sessionStart,
      endTime: sessionEnd,
      status: sessionEnd ? 'completed' : 'active',
      path: this.generateAgentPath(sessionStart, sessionStart + orchestratorDuration, 'orchestrator'),
      metadata: {
        totalDuration: orchestratorDuration,
        totalTokens: this.randomBetween(1000, 5000),
        inputTokens: this.randomBetween(500, 2000),
        outputTokens: this.randomBetween(500, 3000)
      }
    });

    // Generate other agents in batches
    let currentTime = sessionStart + this.randomBetween(1, 5) * 60 * 1000; // Start 1-5 minutes after orchestrator

    for (let i = 1; i < count; i++) {
      const agentType = this.randomChoice(agentTypes);
      const agentName = this.generateAgentName(agentType, i);
      
      const duration = this.randomBetween(10, 90) * 60 * 1000;
      const startTime = currentTime + this.randomBetween(0, 30) * 1000; // Stagger starts
      const endTime = sessionEnd && startTime + duration > sessionEnd 
        ? sessionEnd 
        : startTime + duration;

      const status: AgentStatus = includeFailures && Math.random() < 0.15
        ? 'failed'
        : endTime && endTime <= this.currentTime
        ? 'completed'
        : 'active';

      agents.push({
        agentId: ++this.agentCounter,
        agentName,
        agentType,
        startTime,
        endTime: status === 'active' ? undefined : endTime,
        status,
        path: this.generateAgentPath(startTime, endTime, agentType),
        metadata: {
          totalDuration: endTime ? endTime - startTime : undefined,
          totalTokens: this.randomBetween(500, 3000),
          inputTokens: this.randomBetween(200, 1500),
          outputTokens: this.randomBetween(300, 1500),
          toolUseCount: this.randomBetween(5, 25),
          errorCount: status === 'failed' ? this.randomBetween(1, 5) : 0
        }
      });

      // Next agent starts slightly after this one for realistic batching
      currentTime = startTime + this.randomBetween(5, 15) * 1000;
    }

    return agents;
  }

  /**
   * Generate realistic agent path coordinates
   */
  private generateAgentPath(startTime: number, endTime: number | undefined, agentType: string): Array<{x: number; y: number}> {
    const duration = endTime ? endTime - startTime : 60 * 60 * 1000; // Default 1 hour for active
    const pointCount = Math.max(5, Math.floor(duration / (5 * 60 * 1000))); // Point every 5 minutes
    
    const path: Array<{x: number; y: number}> = [];
    const baseY = this.getAgentTypeY(agentType);
    
    for (let i = 0; i <= pointCount; i++) {
      const x = startTime + (duration * i / pointCount);
      const y = baseY + (Math.sin(i * 0.5) * 10); // Slight variation
      path.push({ x, y });
    }
    
    return path;
  }

  /**
   * Generate orchestrator events
   */
  private generateOrchestratorEvents(
    sessionId: string,
    startTime: number,
    endTime: number | undefined,
    agentCount: number
  ): OrchestratorEvent[] {
    const events: OrchestratorEvent[] = [];
    const duration = endTime ? endTime - startTime : 60 * 60 * 1000;
    
    // Session start
    events.push({
      eventId: ++this.eventCounter,
      timestamp: startTime,
      eventType: 'session_start',
      description: 'Multi-agent session initiated',
      metadata: { plannedAgents: agentCount }
    });

    // Batch launches
    const batchCount = Math.ceil(agentCount / 4);
    for (let i = 0; i < batchCount; i++) {
      events.push({
        eventId: ++this.eventCounter,
        timestamp: startTime + (duration * (i + 1) / (batchCount + 1)),
        eventType: 'batch_launch',
        description: `Agent batch ${i + 1} launched`,
        metadata: { batchId: i + 1, agentCount: Math.min(4, agentCount - i * 4) }
      });
    }

    // Session end (if completed)
    if (endTime) {
      events.push({
        eventId: ++this.eventCounter,
        timestamp: endTime,
        eventType: 'session_complete',
        description: 'Multi-agent session completed',
        metadata: { totalAgents: agentCount, duration: endTime - startTime }
      });
    }

    return events;
  }

  /**
   * Generate user prompts
   */
  private generateUserPrompts(sessionId: string, startTime: number, endTime: number | undefined): UserPrompt[] {
    const prompts: UserPrompt[] = [];
    const promptCount = this.randomBetween(1, 3);

    for (let i = 0; i < promptCount; i++) {
      const timestamp = startTime + (Math.random() * (endTime ? endTime - startTime : 60 * 60 * 1000));
      prompts.push({
        promptId: `prompt-${++this.eventCounter}`,
        timestamp,
        content: this.generateUserPromptText(i),
        metadata: {
          wordCount: this.randomBetween(50, 300),
          complexity: this.randomChoice(['simple', 'moderate', 'complex'])
        }
      });
    }

    return prompts.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate agent batches
   */
  private generateAgentBatches(
    sessionId: string,
    startTime: number,
    endTime: number | undefined,
    agents: AgentPath[]
  ): AgentBatch[] {
    const batches: AgentBatch[] = [];
    const batchSize = 4;
    const agentGroups = agents.slice(1).reduce((groups, agent, index) => { // Skip orchestrator
      const groupIndex = Math.floor(index / batchSize);
      if (!groups[groupIndex]) groups[groupIndex] = [];
      groups[groupIndex].push(agent);
      return groups;
    }, [] as AgentPath[][]);

    agentGroups.forEach((group, batchIndex) => {
      const batchStartTime = Math.min(...group.map(a => a.startTime));
      const groupEndTimes = group.map(a => a.endTime).filter((t): t is number => t !== null);
      const batchEndTime = endTime && groupEndTimes.length > 0 
        ? Math.min(endTime, Math.max(...groupEndTimes)) 
        : endTime;

      batches.push({
        batchId: `batch-${batchIndex + 1}`,
        startTime: batchStartTime,
        endTime: batchEndTime,
        agents: group.map(a => a.agentId),
        batchType: this.randomChoice(['parallel', 'sequential']),
        metadata: {
          agentCount: group.length,
          purpose: this.generateBatchPurpose(batchIndex)
        }
      });
    });

    return batches;
  }

  /**
   * Generate inter-agent messages
   */
  private generateMessages(
    sessionId: string,
    agents: AgentPath[],
    startTime: number,
    endTime: number | undefined
  ): TimelineMessage[] {
    const messages: TimelineMessage[] = [];
    const messageCount = this.randomBetween(agents.length * 2, agents.length * 5);
    const duration = endTime ? endTime - startTime : 60 * 60 * 1000;

    for (let i = 0; i < messageCount; i++) {
      const sender = this.randomChoice(agents.filter(a => a.agentName !== 'Primary-Orchestrator'));
      const timestamp = startTime + Math.random() * duration;

      messages.push({
        messageId: ++this.messageCounter,
        timestamp,
        sender: sender.agentName,
        recipients: this.randomChoice(['broadcast', 'orchestrator', 'peer']),
        content: this.generateMessageContent(sender.agentType, i),
        messageType: this.randomChoice(['status_update', 'request_help', 'data_share', 'completion']),
        metadata: {
          urgency: this.randomChoice(['low', 'medium', 'high']),
          category: this.randomChoice(['progress', 'blocker', 'discovery', 'coordination'])
        }
      });
    }

    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate session metrics
   */
  private calculateSessionMetrics(
    agents: AgentPath[],
    messages: TimelineMessage[],
    startTime: number,
    endTime: number | undefined
  ): SessionMetrics {
    const completedAgents = agents.filter(a => a.status === 'completed');
    const failedAgents = agents.filter(a => a.status === 'failed');
    const durations = agents
      .map(a => a.metadata?.totalDuration)
      .filter(d => d !== undefined) as number[];

    return {
      totalDuration: endTime ? endTime - startTime : Date.now() - startTime,
      agentCount: agents.length,
      messageCount: messages.length,
      batchCount: Math.ceil((agents.length - 1) / 4), // Exclude orchestrator, group by 4
      averageAgentDuration: durations.length > 0 
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
        : 0,
      completionRate: agents.length > 0 ? completedAgents.length / agents.length : 0,
      errorRate: agents.length > 0 ? failedAgents.length / agents.length : 0
    };
  }

  /**
   * Generate realistic HookEvents for server testing
   */
  generateHookEvents(sessionId: string, count: number = 20): HookEvent[] {
    const events: HookEvent[] = [];
    const eventTypes = [
      'tool_use_start',
      'tool_use_end', 
      'agent_spawn',
      'agent_completion',
      'message_send',
      'error_occurred'
    ];

    for (let i = 0; i < count; i++) {
      const timestamp = this.currentTime + (i * 30000) + this.randomBetween(-5000, 5000);
      const eventType = this.randomChoice(eventTypes);

      events.push({
        id: ++this.eventCounter,
        source_app: 'claude-code',
        session_id: sessionId,
        hook_event_type: eventType,
        payload: this.generateEventPayload(eventType),
        timestamp,
        chat: Math.random() < 0.3 ? this.generateChatHistory() : undefined,
        summary: this.generateEventSummary(eventType)
      });
    }

    return events;
  }

  /**
   * Generate Subagent records for server testing
   */
  generateSubagents(sessionId: string, count: number = 5): Subagent[] {
    const agents: Subagent[] = [];
    const types = ['engineer', 'tester', 'code-reviewer', 'planner', 'architect'];

    for (let i = 0; i < count; i++) {
      const createdAt = this.currentTime - this.randomBetween(60, 300) * 60 * 1000;
      const isCompleted = Math.random() < 0.7;
      const completedAt = isCompleted ? createdAt + this.randomBetween(10, 120) * 60 * 1000 : undefined;

      agents.push({
        id: ++this.agentCounter,
        session_id: sessionId,
        name: this.generateAgentName(types[i % types.length], i),
        subagent_type: types[i % types.length],
        created_at: createdAt,
        completed_at: completedAt,
        completion_timestamp: completedAt,
        status: isCompleted ? 'completed' : 'active'
      });
    }

    return agents;
  }

  /**
   * Generate SubagentMessages for testing
   */
  generateSubagentMessages(agents: string[], count: number = 15): SubagentMessage[] {
    const messages: SubagentMessage[] = [];

    for (let i = 0; i < count; i++) {
      const sender = this.randomChoice(agents);
      const createdAt = this.currentTime - this.randomBetween(10, 180) * 60 * 1000;

      messages.push({
        sender,
        message: {
          type: this.randomChoice(['status_update', 'request_help', 'data_share']),
          content: this.generateMessageContent(sender, i),
          timestamp: createdAt,
          metadata: {
            urgency: this.randomChoice(['low', 'medium', 'high']),
            recipients: this.randomChoice(['all', 'orchestrator'])
          }
        },
        created_at: createdAt,
        notified: []
      });
    }

    return messages.sort((a, b) => a.created_at - b.created_at);
  }

  /**
   * Generate time windows for testing
   */
  generateTimeWindows(): SessionTimeWindow[] {
    const now = this.currentTime;
    return [
      {
        start: now - 15 * 60 * 1000,
        end: now,
        duration: 15 * 60 * 1000,
        label: '15 minutes'
      },
      {
        start: now - 60 * 60 * 1000,
        end: now,
        duration: 60 * 60 * 1000,
        label: '1 hour'
      },
      {
        start: now - 6 * 60 * 60 * 1000,
        end: now,
        duration: 6 * 60 * 60 * 1000,
        label: '6 hours'
      },
      {
        start: now - 24 * 60 * 60 * 1000,
        end: now,
        duration: 24 * 60 * 60 * 1000,
        label: '24 hours'
      }
    ];
  }

  // Helper methods for realistic data generation
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomChoice<T>(choices: T[]): T {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private randomChoiceWeighted<T>(choices: T[], weights: number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < choices.length; i++) {
      random -= weights[i];
      if (random <= 0) return choices[i];
    }
    
    return choices[choices.length - 1];
  }

  private generateDisplayName(sessionId: string, complexity: string): string {
    const prefixes = {
      simple: ['Basic', 'Quick', 'Simple'],
      moderate: ['Standard', 'Multi-agent', 'Collaborative'],
      complex: ['Advanced', 'Enterprise', 'Large-scale']
    };

    const tasks = [
      'Implementation',
      'Code Review',
      'Feature Development',
      'Bug Fix',
      'Optimization',
      'Testing Suite',
      'Architecture Review'
    ];

    return `${this.randomChoice(prefixes[complexity])} ${this.randomChoice(tasks)} (${sessionId})`;
  }

  private generateAgentName(type: string, index: number): string {
    const names = {
      engineer: ['CodeCraft', 'BuildBot', 'DevMaster', 'TechForge', 'ByteBuilder'],
      tester: ['TestGuard', 'QualityCheck', 'BugHunter', 'ValidateBot', 'TestRunner'],
      'code-reviewer': ['ReviewPro', 'CodeAudit', 'QualityGate', 'ReviewBot', 'InspectCode'],
      planner: ['PlanMaster', 'StrategyBot', 'TaskOrg', 'ProjectMap', 'PlanWeaver'],
      architect: ['ArchDesign', 'SystemCraft', 'StructureBot', 'ArchMaster', 'DesignPro'],
      'business-analyst': ['RequireBot', 'AnalyzePro', 'BusinessMap', 'SpecCraft', 'ReqMaster'],
      orchestrator: ['Primary-Orchestrator', 'MasterOrch', 'Coordinator']
    };

    const agentNames = names[type] || ['Agent'];
    return `${this.randomChoice(agentNames)}${index}`;
  }

  private generateSessionColor(sessionId: string): string {
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green  
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#84CC16'  // Lime
    ];

    // Consistent color based on session ID
    const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  private getAgentTypeY(agentType: string): number {
    const typeMap: { [key: string]: number } = {
      orchestrator: 50,
      engineer: 100,
      tester: 150,
      'code-reviewer': 200,
      planner: 250,
      architect: 300,
      'business-analyst': 350
    };
    return typeMap[agentType] || 100;
  }

  private generateUserPromptText(index: number): string {
    const prompts = [
      "Implement user authentication with JWT tokens and secure password hashing",
      "Add comprehensive test coverage for the payment processing module",
      "Optimize database queries and implement caching for better performance", 
      "Create responsive UI components for the dashboard with dark mode support",
      "Implement real-time notifications using WebSocket connections",
      "Add error handling and logging throughout the application",
      "Create API documentation and update the README with setup instructions"
    ];
    return prompts[index % prompts.length];
  }

  private generateBatchPurpose(batchIndex: number): string {
    const purposes = [
      'Initial analysis and planning',
      'Core implementation batch',
      'Testing and validation',
      'Final review and optimization'
    ];
    return purposes[batchIndex % purposes.length];
  }

  private generateMessageContent(agentType: string, index: number): string {
    const templates = {
      engineer: [
        "Implementation of core feature is 60% complete",
        "Encountered database connection issue, investigating",
        "API endpoints have been created and tested",
        "Code refactoring completed, performance improved by 25%"
      ],
      tester: [
        "Unit tests are passing, coverage at 85%",
        "Found critical bug in payment processing, details attached", 
        "Integration tests completed successfully",
        "Performance testing shows acceptable response times"
      ],
      'code-reviewer': [
        "Code review completed, minor issues flagged",
        "Security vulnerability found in authentication module",
        "Approved merge request with suggested improvements",
        "Documentation needs updating for new API changes"
      ]
    };

    const messages = templates[agentType] || [
      "Status update from agent",
      "Task in progress",
      "Awaiting further instructions",
      "Work completed successfully"
    ];

    return messages[index % messages.length];
  }

  private generateEventPayload(eventType: string): Record<string, any> {
    switch (eventType) {
      case 'tool_use_start':
        return {
          tool: this.randomChoice(['Read', 'Write', 'Bash', 'Grep']),
          parameters: { file_path: `/path/to/file${this.randomBetween(1, 10)}.ts` }
        };
      case 'agent_spawn':
        return {
          agent_name: this.generateAgentName('engineer', this.randomBetween(1, 10)),
          agent_type: this.randomChoice(['engineer', 'tester', 'reviewer'])
        };
      case 'message_send':
        return {
          recipient: 'Primary-Orchestrator',
          message_type: 'status_update',
          content: 'Task completed successfully'
        };
      default:
        return { event_data: `Generated ${eventType} event` };
    }
  }

  private generateChatHistory(): any[] {
    return [
      {
        role: 'user',
        content: 'Please implement the user authentication feature'
      },
      {
        role: 'assistant', 
        content: 'I\'ll implement JWT-based authentication with secure password hashing.'
      }
    ];
  }

  private generateEventSummary(eventType: string): string {
    const summaries = {
      tool_use_start: 'Started using development tool',
      tool_use_end: 'Completed tool operation',
      agent_spawn: 'New agent joined the session',
      agent_completion: 'Agent completed assigned tasks',
      message_send: 'Inter-agent communication occurred',
      error_occurred: 'Handled recoverable error condition'
    };
    
    return summaries[eventType] || `${eventType} event occurred`;
  }
}

// Export singleton instance for convenience
export const mockDataGenerator = new MockDataGenerator();

// Export specific generators for different scenarios
export const testScenarios = {
  smallSession: () => mockDataGenerator.generateSession({ 
    agentCount: 3, 
    complexity: 'simple',
    durationMinutes: 30
  }),
  
  largeSession: () => mockDataGenerator.generateSession({
    agentCount: 12,
    complexity: 'complex', 
    durationMinutes: 180
  }),
  
  failedSession: () => mockDataGenerator.generateSession({
    status: 'failed',
    includeFailures: true,
    durationMinutes: 45
  }),
  
  activeSession: () => mockDataGenerator.generateSession({
    status: 'active',
    startTimeOffset: -30
  }),

  performanceDataset: (sessionCount: number = 50) => 
    mockDataGenerator.generateMultipleSessions(sessionCount, {
      timeSpreadHours: 48,
      complexityMix: true
    }),

  realtimeUpdates: (sessionId: string) => ({
    events: mockDataGenerator.generateHookEvents(sessionId, 25),
    agents: mockDataGenerator.generateSubagents(sessionId, 8),
    messages: mockDataGenerator.generateSubagentMessages(
      ['Agent1', 'Agent2', 'Agent3', 'Agent4'], 
      20
    )
  })
};