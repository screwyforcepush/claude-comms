import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { 
  setDatabase, 
  initDatabase, 
  insertEvent, 
  getSessionIntrospectionEvents,
  transformToMessageHistory 
} from '../db';
import type { HookEvent } from '../types';

describe('Session Introspection API', () => {
  let testDb: Database;
  let testServer: any;
  const TEST_SESSION_ID = 'test-session-12345';
  const API_BASE_URL = 'http://localhost:4000';

  beforeEach(async () => {
    // Use in-memory database for testing isolation
    testDb = new Database(':memory:');
    setDatabase(testDb);
    initDatabase();
    
    // Start test server (will need to import and start the actual server)
    // For now, we'll test the database functions directly
  });

  afterEach(async () => {
    testDb?.close();
  });

  describe('Database Functions', () => {
    test('getSessionIntrospectionEvents filters correctly for UserPromptSubmit', async () => {
      // Arrange: Insert test events
      const userPromptEvent: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: {
          prompt: 'Test user prompt',
          user_id: 'test-user'
        },
        timestamp: Date.now()
      };

      const irrelevantEvent: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'SomeOtherEvent',
        payload: { data: 'should not appear' },
        timestamp: Date.now()
      };

      insertEvent(userPromptEvent);
      insertEvent(irrelevantEvent);

      // Act
      const events = getSessionIntrospectionEvents(TEST_SESSION_ID);

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].hook_event_type).toBe('UserPromptSubmit');
      expect(events[0].payload.prompt).toBe('Test user prompt');
    });

    test('getSessionIntrospectionEvents filters correctly for PostToolUse with tool_name=Task', async () => {
      // Arrange: Insert test events
      const taskToolUseEvent: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'PostToolUse',
        payload: {
          tool_name: 'Task',
          description: 'AgentName: implement feature X',
          prompt: 'Your name is AgentName. Implement feature X...',
          subagent_type: 'engineer'
        },
        timestamp: Date.now()
      };

      const otherToolUseEvent: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'PostToolUse',
        payload: {
          tool_name: 'SomeOtherTool',
          data: 'should not appear'
        },
        timestamp: Date.now()
      };

      insertEvent(taskToolUseEvent);
      insertEvent(otherToolUseEvent);

      // Act
      const events = getSessionIntrospectionEvents(TEST_SESSION_ID);

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].hook_event_type).toBe('PostToolUse');
      expect(events[0].payload.tool_name).toBe('Task');
      expect(events[0].payload.description).toContain('AgentName');
    });

    test('getSessionIntrospectionEvents returns events sorted by timestamp ascending', async () => {
      // Arrange: Insert events with different timestamps
      const now = Date.now();
      const event1: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'First prompt' },
        timestamp: now - 1000
      };

      const event2: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'PostToolUse',
        payload: { 
          tool_name: 'Task',
          description: 'AgentA: task A'
        },
        timestamp: now + 1000
      };

      const event3: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'Second prompt' },
        timestamp: now
      };

      insertEvent(event1);
      insertEvent(event2);
      insertEvent(event3);

      // Act
      const events = getSessionIntrospectionEvents(TEST_SESSION_ID);

      // Assert
      expect(events).toHaveLength(3);
      expect(events[0].timestamp).toBeLessThan(events[1].timestamp!);
      expect(events[1].timestamp).toBeLessThan(events[2].timestamp!);
      expect(events[0].payload.prompt).toBe('First prompt');
      expect(events[1].payload.prompt).toBe('Second prompt');
      expect(events[2].payload.description).toBe('AgentA: task A');
    });

    test('getSessionIntrospectionEvents returns empty array for non-existent session', async () => {
      // Act
      const events = getSessionIntrospectionEvents('non-existent-session');

      // Assert
      expect(events).toHaveLength(0);
    });

    test('getSessionIntrospectionEvents handles empty session ID gracefully', async () => {
      // Act
      const events1 = getSessionIntrospectionEvents('');
      const events2 = getSessionIntrospectionEvents('   ');

      // Assert
      expect(events1).toHaveLength(0);
      expect(events2).toHaveLength(0);
    });
  });

  describe('Data Transformation', () => {
    test('transformToMessageHistory converts UserPromptSubmit to user_message', async () => {
      // Arrange
      const events: HookEvent[] = [{
        id: 1,
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: {
          prompt: 'Create a new feature',
          user_id: 'test-user-123'
        },
        timestamp: 1692000000000
      }];

      // Act
      const result = transformToMessageHistory(events, TEST_SESSION_ID);

      // Assert
      expect(result.sessionId).toBe(TEST_SESSION_ID);
      expect(result.timeline).toHaveLength(1);
      expect(result.messageCount).toBe(1);
      
      const message = result.timeline[0];
      expect(message.id).toBe(1);
      expect(message.type).toBe('user_message');
      expect(message.role).toBe('User');
      expect(message.timestamp).toBe(1692000000000);
      expect(message.content.prompt).toBe('Create a new feature');
      expect(message.content.user_id).toBe('test-user-123');
      expect(message.source_event.hook_event_type).toBe('UserPromptSubmit');
    });

    test('transformToMessageHistory converts PostToolUse Task to orchestrator_message', async () => {
      // Arrange
      const events: HookEvent[] = [{
        id: 2,
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'PostToolUse',
        payload: {
          tool_name: 'Task',
          description: 'AliceEngdev: implement user authentication system',
          prompt: 'Your name is AliceEngdev. Implement the user authentication...',
          subagent_type: 'engineer'
        },
        timestamp: 1692000001000
      }];

      // Act
      const result = transformToMessageHistory(events, TEST_SESSION_ID);

      // Assert
      expect(result.timeline).toHaveLength(1);
      
      const message = result.timeline[0];
      expect(message.id).toBe(2);
      expect(message.type).toBe('orchestrator_message');
      expect(message.role).toBe('Orchestrator');
      expect(message.timestamp).toBe(1692000001000);
      expect(message.content.agent_name).toBe('AliceEngdev');
      expect(message.content.task_description).toBe('AliceEngdev: implement user authentication system');
      expect(message.content.agent_type).toBe('engineer');
      expect(message.content.prompt).toContain('Your name is AliceEngdev');
      expect(message.source_event.hook_event_type).toBe('PostToolUse');
    });

    test('transformToMessageHistory extracts agent name from description correctly', async () => {
      // Test various description formats
      const testCases = [
        { 
          description: 'BobArchitect: design the system architecture',
          expectedName: 'BobArchitect'
        },
        { 
          description: 'Single-Word-Name: perform task',
          expectedName: 'Single-Word-Name'
        },
        { 
          description: 'Agent With Spaces: do something', // Edge case - shouldn't happen but test it
          expectedName: 'Agent With Spaces'
        },
        { 
          description: 'No colon here',
          expectedName: 'Unknown Agent'
        },
        { 
          description: '',
          expectedName: 'Unknown Agent'
        }
      ];

      for (const testCase of testCases) {
        const events: HookEvent[] = [{
          id: 1,
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: 'PostToolUse',
          payload: {
            tool_name: 'Task',
            description: testCase.description
          },
          timestamp: Date.now()
        }];

        const result = transformToMessageHistory(events, TEST_SESSION_ID);
        expect(result.timeline[0].content.agent_name).toBe(testCase.expectedName);
      }
    });

    test('transformToMessageHistory calculates time range correctly', async () => {
      // Arrange
      const events: HookEvent[] = [
        {
          id: 1,
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: 'UserPromptSubmit',
          payload: { prompt: 'First' },
          timestamp: 1692000000000
        },
        {
          id: 2,
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: 'PostToolUse',
          payload: { tool_name: 'Task', description: 'Agent: task' },
          timestamp: 1692000005000
        },
        {
          id: 3,
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: 'UserPromptSubmit',
          payload: { prompt: 'Last' },
          timestamp: 1692000010000
        }
      ];

      // Act
      const result = transformToMessageHistory(events, TEST_SESSION_ID);

      // Assert
      expect(result.timeRange).not.toBeNull();
      expect(result.timeRange!.start).toBe(1692000000000);
      expect(result.timeRange!.end).toBe(1692000010000);
      expect(result.timeRange!.duration).toBe(10000);
    });

    test('transformToMessageHistory handles empty events array', async () => {
      // Act
      const result = transformToMessageHistory([], TEST_SESSION_ID);

      // Assert
      expect(result.sessionId).toBe(TEST_SESSION_ID);
      expect(result.timeline).toHaveLength(0);
      expect(result.messageCount).toBe(0);
      expect(result.timeRange).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('getSessionIntrospectionEvents handles malformed events gracefully', async () => {
      // Arrange: Create valid event first, then test error handling
      const validEvent: HookEvent = {
        source_app: 'test',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'valid event' },
        timestamp: Date.now()
      };
      insertEvent(validEvent);

      // Act & Assert: Should not throw even if there are parsing issues
      expect(() => {
        const events = getSessionIntrospectionEvents(TEST_SESSION_ID);
        expect(events.length).toBeGreaterThanOrEqual(1);
        // The function should handle JSON parsing errors gracefully
      }).not.toThrow();
    });

    test('transformToMessageHistory handles missing required fields', async () => {
      // Arrange: Events with missing fields
      const events: HookEvent[] = [
        {
          // Missing id
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: 'UserPromptSubmit',
          payload: {},
          timestamp: undefined // Missing timestamp
        } as any,
        {
          id: 2,
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: 'PostToolUse',
          payload: {
            tool_name: 'Task'
            // Missing description
          },
          timestamp: Date.now()
        }
      ];

      // Act & Assert: Should not throw
      expect(() => {
        const result = transformToMessageHistory(events, TEST_SESSION_ID);
        expect(result.timeline).toHaveLength(2);
        // Should handle missing fields gracefully with defaults
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('getSessionIntrospectionEvents performs well with large datasets', async () => {
      // Arrange: Insert many events (simulating large session)
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const event: HookEvent = {
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: i % 2 === 0 ? 'UserPromptSubmit' : 'PostToolUse',
          payload: i % 2 === 0 
            ? { prompt: `Prompt ${i}` }
            : { tool_name: 'Task', description: `Agent${i}: task ${i}` },
          timestamp: startTime + i
        };
        insertEvent(event);
      }

      // Act
      const queryStart = Date.now();
      const events = getSessionIntrospectionEvents(TEST_SESSION_ID);
      const queryTime = Date.now() - queryStart;

      // Assert: Should complete within reasonable time (< 200ms per requirements)
      expect(queryTime).toBeLessThan(200);
      expect(events).toHaveLength(1000); // All events should be returned
      expect(events[0].timestamp).toBeLessThan(events[events.length - 1].timestamp!);
    });

    test('transformToMessageHistory performs well with large datasets', async () => {
      // Arrange: Create large events array
      const events: HookEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        events.push({
          id: i,
          source_app: 'claude-code',
          session_id: TEST_SESSION_ID,
          hook_event_type: i % 2 === 0 ? 'UserPromptSubmit' : 'PostToolUse',
          payload: i % 2 === 0 
            ? { prompt: `Prompt ${i}` }
            : { tool_name: 'Task', description: `Agent${i}: task ${i}` },
          timestamp: Date.now() + i
        });
      }

      // Act
      const transformStart = Date.now();
      const result = transformToMessageHistory(events, TEST_SESSION_ID);
      const transformTime = Date.now() - transformStart;

      // Assert: Should complete quickly (< 100ms)
      expect(transformTime).toBeLessThan(100);
      expect(result.timeline).toHaveLength(1000);
      expect(result.messageCount).toBe(1000);
    });
  });

  describe('Integration Scenarios', () => {
    test('full session introspection workflow', async () => {
      // Arrange: Simulate a complete orchestration session
      const baseTime = Date.now();
      
      // User starts with a prompt
      const userPrompt1: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: {
          prompt: 'Build a REST API for user management',
          user_id: 'alex@example.com'
        },
        timestamp: baseTime
      };
      
      // Orchestrator assigns first agent
      const orchestratorTask1: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'PostToolUse',
        payload: {
          tool_name: 'Task',
          description: 'AliceArchitect: design the API architecture',
          prompt: 'Your name is AliceArchitect. Design the API architecture...',
          subagent_type: 'architect'
        },
        timestamp: baseTime + 1000
      };
      
      // User follows up with clarification
      const userPrompt2: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'UserPromptSubmit',
        payload: {
          prompt: 'Make sure to include JWT authentication',
          user_id: 'alex@example.com'
        },
        timestamp: baseTime + 5000
      };
      
      // Orchestrator assigns second agent
      const orchestratorTask2: HookEvent = {
        source_app: 'claude-code',
        session_id: TEST_SESSION_ID,
        hook_event_type: 'PostToolUse',
        payload: {
          tool_name: 'Task',
          description: 'BobEngineer: implement JWT authentication middleware',
          prompt: 'Your name is BobEngineer. Implement JWT authentication...',
          subagent_type: 'engineer'
        },
        timestamp: baseTime + 6000
      };

      // Insert all events
      insertEvent(userPrompt1);
      insertEvent(orchestratorTask1);
      insertEvent(userPrompt2);
      insertEvent(orchestratorTask2);

      // Act: Get session introspection
      const events = getSessionIntrospectionEvents(TEST_SESSION_ID);
      const timeline = transformToMessageHistory(events, TEST_SESSION_ID);

      // Assert: Complete workflow captured correctly
      expect(timeline.messageCount).toBe(4);
      expect(timeline.timeline[0].type).toBe('user_message');
      expect(timeline.timeline[0].content.prompt).toBe('Build a REST API for user management');
      
      expect(timeline.timeline[1].type).toBe('orchestrator_message');
      expect(timeline.timeline[1].content.agent_name).toBe('AliceArchitect');
      
      expect(timeline.timeline[2].type).toBe('user_message');
      expect(timeline.timeline[2].content.prompt).toBe('Make sure to include JWT authentication');
      
      expect(timeline.timeline[3].type).toBe('orchestrator_message');
      expect(timeline.timeline[3].content.agent_name).toBe('BobEngineer');
      
      // Check time range
      expect(timeline.timeRange!.duration).toBe(6000);
      expect(timeline.timeRange!.start).toBe(baseTime);
      expect(timeline.timeRange!.end).toBe(baseTime + 6000);
    });
  });
});