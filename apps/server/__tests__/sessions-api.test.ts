/**
 * Server API Tests for Multi-Session Functionality
 * TestTiger - Comprehensive test suite for session management endpoints
 */

import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { 
  initDatabase, 
  registerSubagent, 
  getSubagents, 
  updateSubagentCompletion,
  getSessionsWithAgents,
  sendSubagentMessage,
  getUnreadMessages,
  insertEvent
} from '../src/db';
import type { 
  HookEvent, 
  RegisterSubagentRequest, 
  UpdateSubagentCompletionRequest,
  SendMessageRequest,
  GetUnreadMessagesRequest
} from '../src/types';

// Test database setup
let testDbPath = ':memory:';
let originalDb: any;

describe('Sessions API Database Functions', () => {
  beforeEach(() => {
    // Initialize test database
    initDatabase();
  });

  afterEach(() => {
    // Clean up test database
    // Note: Using in-memory database so cleanup is automatic
  });

  describe('Session Registration & Management', () => {
    test('registerSubagent - should create new agent entry', () => {
      const sessionId = 'test-session-001';
      const name = 'TestAgent';
      const type = 'engineer';

      const agentId = registerSubagent(sessionId, name, type);
      
      expect(agentId).toBeGreaterThan(0);
      
      const agents = getSubagents(sessionId);
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe(name);
      expect(agents[0].subagent_type).toBe(type);
      expect(agents[0].session_id).toBe(sessionId);
      expect(agents[0].status).toBe('pending');
    });

    test('registerSubagent - should handle duplicate names in different sessions', () => {
      const name = 'DuplicateAgent';
      const session1 = 'session-1';
      const session2 = 'session-2';

      const agent1Id = registerSubagent(session1, name, 'engineer');
      const agent2Id = registerSubagent(session2, name, 'tester');

      expect(agent1Id).toBeGreaterThan(0);
      expect(agent2Id).toBeGreaterThan(0);
      expect(agent1Id).not.toBe(agent2Id);

      const session1Agents = getSubagents(session1);
      const session2Agents = getSubagents(session2);

      expect(session1Agents).toHaveLength(1);
      expect(session2Agents).toHaveLength(1);
      expect(session1Agents[0].subagent_type).toBe('engineer');
      expect(session2Agents[0].subagent_type).toBe('tester');
    });

    test('getSubagents - should return empty array for nonexistent session', () => {
      const agents = getSubagents('nonexistent-session');
      expect(agents).toHaveLength(0);
    });

    test('getSubagents - should return agents sorted by creation time (newest first)', () => {
      const sessionId = 'time-test-session';
      
      const agent1Id = registerSubagent(sessionId, 'Agent1', 'engineer');
      // Small delay to ensure different timestamps
      setTimeout(() => {}, 1);
      const agent2Id = registerSubagent(sessionId, 'Agent2', 'tester');
      setTimeout(() => {}, 1);
      const agent3Id = registerSubagent(sessionId, 'Agent3', 'reviewer');

      const agents = getSubagents(sessionId);
      
      expect(agents).toHaveLength(3);
      expect(agents[0].name).toBe('Agent3'); // Most recent
      expect(agents[1].name).toBe('Agent2');
      expect(agents[2].name).toBe('Agent1'); // Oldest
    });
  });

  describe('Agent Completion Tracking', () => {
    test('updateSubagentCompletion - should update completion data', () => {
      const sessionId = 'completion-test';
      const agentName = 'CompletionAgent';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const completionData = {
        completed_at: Date.now(),
        status: 'completed',
        total_duration_ms: 45000,
        total_tokens: 1500,
        total_tool_use_count: 12,
        input_tokens: 800,
        output_tokens: 700,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300
      };

      const success = updateSubagentCompletion(sessionId, agentName, completionData);
      expect(success).toBe(true);

      const agents = getSubagents(sessionId);
      const agent = agents[0];
      
      expect(agent.completed_at).toBe(completionData.completed_at);
      expect(agent.status).toBe('completed');
      expect(agent.total_duration_ms).toBe(45000);
      expect(agent.total_tokens).toBe(1500);
      expect(agent.total_tool_use_count).toBe(12);
      expect(agent.input_tokens).toBe(800);
      expect(agent.output_tokens).toBe(700);
      expect(agent.cache_creation_input_tokens).toBe(200);
      expect(agent.cache_read_input_tokens).toBe(300);
      expect(agent.completion_timestamp).toBe(completionData.completed_at);
    });

    test('updateSubagentCompletion - should handle partial updates', () => {
      const sessionId = 'partial-update-test';
      const agentName = 'PartialAgent';
      
      registerSubagent(sessionId, agentName, 'tester');
      
      // First partial update
      let success = updateSubagentCompletion(sessionId, agentName, {
        status: 'in_progress',
        total_tokens: 500
      });
      expect(success).toBe(true);

      let agents = getSubagents(sessionId);
      expect(agents[0].status).toBe('in_progress');
      expect(agents[0].total_tokens).toBe(500);
      expect(agents[0].completed_at).toBeNull();

      // Second partial update (completion)
      const completedAt = Date.now();
      success = updateSubagentCompletion(sessionId, agentName, {
        completed_at: completedAt,
        status: 'completed',
        total_duration_ms: 30000
      });
      expect(success).toBe(true);

      agents = getSubagents(sessionId);
      expect(agents[0].status).toBe('completed');
      expect(agents[0].total_tokens).toBe(500); // Previous value preserved
      expect(agents[0].completed_at).toBe(completedAt);
      expect(agents[0].total_duration_ms).toBe(30000);
    });

    test('updateSubagentCompletion - should return false for nonexistent agent', () => {
      const success = updateSubagentCompletion('fake-session', 'FakeAgent', {
        status: 'completed'
      });
      expect(success).toBe(false);
    });

    test('updateSubagentCompletion - should handle error states', () => {
      const sessionId = 'error-test';
      const agentName = 'ErrorAgent';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = updateSubagentCompletion(sessionId, agentName, {
        status: 'failed',
        completed_at: Date.now(),
        total_duration_ms: 15000
      });
      expect(success).toBe(true);

      const agents = getSubagents(sessionId);
      expect(agents[0].status).toBe('failed');
    });
  });

  describe('Session Discovery', () => {
    test('getSessionsWithAgents - should return sessions with agent counts', () => {
      // Create multiple sessions with different agent counts
      registerSubagent('session-1', 'Agent1', 'engineer');
      registerSubagent('session-1', 'Agent2', 'tester');
      registerSubagent('session-1', 'Agent3', 'reviewer');

      registerSubagent('session-2', 'AgentA', 'planner');
      registerSubagent('session-2', 'AgentB', 'architect');

      registerSubagent('session-3', 'SoloAgent', 'engineer');

      const sessions = getSessionsWithAgents();
      
      expect(sessions).toHaveLength(3);
      
      const session1 = sessions.find(s => s.session_id === 'session-1');
      const session2 = sessions.find(s => s.session_id === 'session-2');
      const session3 = sessions.find(s => s.session_id === 'session-3');

      expect(session1?.agent_count).toBe(3);
      expect(session2?.agent_count).toBe(2);
      expect(session3?.agent_count).toBe(1);
    });

    test('getSessionsWithAgents - should sort by creation time (newest first)', () => {
      registerSubagent('old-session', 'OldAgent', 'engineer');
      // Small delay
      setTimeout(() => {}, 2);
      registerSubagent('mid-session', 'MidAgent', 'tester');
      setTimeout(() => {}, 2);
      registerSubagent('new-session', 'NewAgent', 'reviewer');

      const sessions = getSessionsWithAgents();
      
      expect(sessions[0].session_id).toBe('new-session');
      expect(sessions[1].session_id).toBe('mid-session'); 
      expect(sessions[2].session_id).toBe('old-session');
    });

    test('getSessionsWithAgents - should return empty array when no sessions exist', () => {
      const sessions = getSessionsWithAgents();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Inter-Agent Messaging', () => {
    test('sendSubagentMessage and getUnreadMessages - basic flow', () => {
      const sender = 'SenderAgent';
      const receiver = 'ReceiverAgent';
      const testMessage = { type: 'status', content: 'Work completed' };

      // Register both agents
      registerSubagent('test-session', sender, 'engineer');
      setTimeout(() => {}, 1);
      registerSubagent('test-session', receiver, 'tester');

      // Send message
      const messageId = sendSubagentMessage(sender, testMessage);
      expect(messageId).toBeGreaterThan(0);

      // Check unread messages
      const unreadMessages = getUnreadMessages(receiver);
      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].sender).toBe(sender);
      expect(unreadMessages[0].message).toEqual(testMessage);

      // Check that sender doesn't see their own message
      const senderUnread = getUnreadMessages(sender);
      expect(senderUnread).toHaveLength(0);

      // Second call should return empty (already read)
      const secondCheck = getUnreadMessages(receiver);
      expect(secondCheck).toHaveLength(0);
    });

    test('getUnreadMessages - should only return messages after agent registration', () => {
      const sender = 'EarlySender';
      const receiver = 'LateReceiver';

      // Register sender first
      registerSubagent('timing-test', sender, 'engineer');
      
      // Send message before receiver exists
      sendSubagentMessage(sender, { content: 'Early message' });
      
      // Register receiver after message was sent
      setTimeout(() => {}, 2);
      registerSubagent('timing-test', receiver, 'tester');
      
      // Send message after receiver registration
      sendSubagentMessage(sender, { content: 'Late message' });
      
      const unreadMessages = getUnreadMessages(receiver);
      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].message.content).toBe('Late message');
    });

    test('getUnreadMessages - should handle nonexistent agent', () => {
      const messages = getUnreadMessages('NonexistentAgent');
      expect(messages).toHaveLength(0);
    });

    test('sendSubagentMessage - should handle complex message objects', () => {
      registerSubagent('complex-session', 'Sender', 'engineer');
      registerSubagent('complex-session', 'Receiver', 'tester');

      const complexMessage = {
        type: 'batch_update',
        data: {
          agents: ['Agent1', 'Agent2'],
          status: 'completed',
          metrics: {
            duration: 45000,
            tokens: 1200
          },
          nested: {
            deep: {
              value: true
            }
          }
        },
        timestamp: Date.now()
      };

      sendSubagentMessage('Sender', complexMessage);
      const messages = getUnreadMessages('Receiver');
      
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toEqual(complexMessage);
    });
  });

  describe('Performance Tests', () => {
    test('should handle 50+ sessions efficiently', () => {
      const startTime = Date.now();
      
      // Create 55 sessions with varying agent counts
      for (let i = 1; i <= 55; i++) {
        const sessionId = `perf-session-${i.toString().padStart(3, '0')}`;
        const agentCount = Math.floor(Math.random() * 10) + 1; // 1-10 agents
        
        for (let j = 1; j <= agentCount; j++) {
          registerSubagent(sessionId, `Agent${j}`, 'engineer');
        }
      }
      
      const creationTime = Date.now() - startTime;
      
      // Test session retrieval performance
      const retrievalStart = Date.now();
      const sessions = getSessionsWithAgents();
      const retrievalTime = Date.now() - retrievalStart;
      
      expect(sessions).toHaveLength(55);
      expect(creationTime).toBeLessThan(1000); // Under 1 second
      expect(retrievalTime).toBeLessThan(100); // Under 100ms
      
      console.log(`Performance: Created 55 sessions in ${creationTime}ms, retrieved in ${retrievalTime}ms`);
    });

    test('should handle high-volume message processing', () => {
      const senderCount = 10;
      const messageCount = 100;
      const sessionId = 'volume-test';
      
      // Register multiple senders
      const senders: string[] = [];
      for (let i = 1; i <= senderCount; i++) {
        const sender = `Sender${i}`;
        senders.push(sender);
        registerSubagent(sessionId, sender, 'engineer');
      }
      
      // Register a receiver
      const receiver = 'VolumeReceiver';
      registerSubagent(sessionId, receiver, 'tester');
      
      const startTime = Date.now();
      
      // Send many messages
      for (let i = 0; i < messageCount; i++) {
        const sender = senders[i % senderCount];
        sendSubagentMessage(sender, { 
          messageId: i, 
          content: `Message ${i} from ${sender}`,
          timestamp: Date.now()
        });
      }
      
      const sendTime = Date.now() - startTime;
      
      // Retrieve messages
      const retrievalStart = Date.now();
      const messages = getUnreadMessages(receiver);
      const retrievalTime = Date.now() - retrievalStart;
      
      expect(messages).toHaveLength(messageCount);
      expect(sendTime).toBeLessThan(2000); // Under 2 seconds
      expect(retrievalTime).toBeLessThan(500); // Under 500ms
      
      console.log(`Volume test: Sent ${messageCount} messages in ${sendTime}ms, retrieved in ${retrievalTime}ms`);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    test('should handle empty session IDs gracefully', () => {
      expect(() => registerSubagent('', 'Agent', 'engineer')).not.toThrow();
      expect(() => getSubagents('')).not.toThrow();
      expect(getSubagents('')).toHaveLength(0);
    });

    test('should handle special characters in names and messages', () => {
      const specialName = 'Agent!@#$%^&*()_+-=[]{}|;:,.<>?';
      const sessionId = 'special-char-test';
      
      const agentId = registerSubagent(sessionId, specialName, 'engineer');
      expect(agentId).toBeGreaterThan(0);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].name).toBe(specialName);
      
      const specialMessage = {
        content: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '🚀 Unicode test: 中文, العربية, 🎉',
        json: '{"nested": "quotes \'inside\'"}',
        escapes: 'New\nLine\tTab\\Backslash'
      };
      
      registerSubagent(sessionId, 'Receiver', 'tester');
      sendSubagentMessage(specialName, specialMessage);
      
      const messages = getUnreadMessages('Receiver');
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toEqual(specialMessage);
    });

    test('should handle very long strings', () => {
      const longString = 'A'.repeat(10000);
      const sessionId = 'long-string-test';
      
      registerSubagent(sessionId, 'LongSender', 'engineer');
      registerSubagent(sessionId, 'LongReceiver', 'tester');
      
      const longMessage = {
        longField: longString,
        normalField: 'normal'
      };
      
      expect(() => sendSubagentMessage('LongSender', longMessage)).not.toThrow();
      
      const messages = getUnreadMessages('LongReceiver');
      expect(messages).toHaveLength(1);
      expect(messages[0].message.longField).toBe(longString);
    });

    test('should handle null and undefined values appropriately', () => {
      const sessionId = 'null-test';
      registerSubagent(sessionId, 'TestAgent', 'engineer');
      
      const completion = updateSubagentCompletion(sessionId, 'TestAgent', {
        status: 'completed',
        total_duration_ms: undefined,
        total_tokens: null as any,
        completed_at: 0
      });
      
      expect(completion).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].status).toBe('completed');
      expect(agents[0].completed_at).toBe(0);
      // Undefined/null values should not update the fields
    });

    test('should handle rapid registration and completion updates', () => {
      const sessionId = 'rapid-test';
      const agentCount = 20;
      
      // Rapid registration
      const startTime = Date.now();
      for (let i = 0; i < agentCount; i++) {
        registerSubagent(sessionId, `RapidAgent${i}`, 'engineer');
      }
      
      // Rapid completion updates
      for (let i = 0; i < agentCount; i++) {
        updateSubagentCompletion(sessionId, `RapidAgent${i}`, {
          status: 'completed',
          completed_at: Date.now(),
          total_duration_ms: Math.floor(Math.random() * 60000)
        });
      }
      
      const totalTime = Date.now() - startTime;
      
      const agents = getSubagents(sessionId);
      expect(agents).toHaveLength(agentCount);
      expect(agents.every(a => a.status === 'completed')).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Under 1 second for 20 agents
    });
  });

  describe('Database Integrity', () => {
    test('should maintain referential integrity across operations', () => {
      const sessionId = 'integrity-test';
      
      // Create agents
      registerSubagent(sessionId, 'Agent1', 'engineer');
      registerSubagent(sessionId, 'Agent2', 'tester');
      
      // Send messages
      sendSubagentMessage('Agent1', { content: 'Test message 1' });
      sendSubagentMessage('Agent2', { content: 'Test message 2' });
      
      // Update completions
      updateSubagentCompletion(sessionId, 'Agent1', { status: 'completed' });
      
      // Verify all data is consistent
      const agents = getSubagents(sessionId);
      const sessions = getSessionsWithAgents();
      const messages = getUnreadMessages('Agent2');
      
      expect(agents).toHaveLength(2);
      expect(sessions.find(s => s.session_id === sessionId)?.agent_count).toBe(2);
      expect(messages).toHaveLength(1);
      expect(agents.find(a => a.name === 'Agent1')?.status).toBe('completed');
    });

    test('should handle concurrent operations safely', () => {
      const sessionId = 'concurrent-test';
      const promises: Promise<any>[] = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => registerSubagent(sessionId, `ConcurrentAgent${i}`, 'engineer'))
        );
        
        promises.push(
          Promise.resolve().then(() => sendSubagentMessage(`ConcurrentAgent${i}`, { id: i }))
        );
      }
      
      return Promise.all(promises).then(() => {
        const agents = getSubagents(sessionId);
        const sessions = getSessionsWithAgents();
        
        expect(agents).toHaveLength(10);
        expect(sessions.find(s => s.session_id === sessionId)?.agent_count).toBe(10);
      });
    });
  });
});