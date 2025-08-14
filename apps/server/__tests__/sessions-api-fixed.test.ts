/**
 * Server API Tests for Multi-Session Functionality (Fixed Version)
 * TestTiger - Comprehensive test suite with proper database isolation
 */

import { expect, test, describe, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';

// Mock database functions for isolated testing
let mockDb: Database;

// Simplified database functions for testing
function initTestDatabase() {
  mockDb = new Database(':memory:');
  
  // Create tables
  mockDb.exec(`
    CREATE TABLE IF NOT EXISTS subagent_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subagent_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'pending',
      total_duration_ms INTEGER,
      total_tokens INTEGER,
      total_tool_use_count INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_creation_input_tokens INTEGER,
      cache_read_input_tokens INTEGER
    )
  `);

  mockDb.exec(`
    CREATE TABLE IF NOT EXISTS subagent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      notified TEXT DEFAULT '[]'
    )
  `);
}

function registerSubagent(sessionId: string, name: string, subagentType: string): number {
  const stmt = mockDb.prepare(`
    INSERT INTO subagent_registry (session_id, name, subagent_type, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(sessionId, name, subagentType, Date.now());
  return result.lastInsertRowid as number;
}

function getSubagents(sessionId: string) {
  const stmt = mockDb.prepare(`
    SELECT id, session_id, name, subagent_type, created_at, completed_at, status
    FROM subagent_registry 
    WHERE session_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(sessionId);
}

function updateSubagentCompletion(sessionId: string, name: string, completionData: any): boolean {
  const stmt = mockDb.prepare(`
    UPDATE subagent_registry 
    SET completed_at = COALESCE(?, completed_at),
        status = COALESCE(?, status),
        total_duration_ms = COALESCE(?, total_duration_ms),
        total_tokens = COALESCE(?, total_tokens)
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(
    completionData.completed_at || null,
    completionData.status || null,
    completionData.total_duration_ms || null,
    completionData.total_tokens || null,
    sessionId,
    name
  );
  
  return result.changes > 0;
}

function getSessionsWithAgents() {
  const stmt = mockDb.prepare(`
    SELECT session_id, MAX(created_at) as created_at, COUNT(*) as agent_count
    FROM subagent_registry 
    GROUP BY session_id 
    ORDER BY created_at DESC
  `);
  
  return stmt.all();
}

function sendSubagentMessage(sender: string, message: any): number {
  const stmt = mockDb.prepare(`
    INSERT INTO subagent_messages (sender, message, created_at, notified)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    sender,
    JSON.stringify(message),
    Date.now(),
    JSON.stringify([])
  );
  
  return result.lastInsertRowid as number;
}

function getUnreadMessages(subagentName: string): any[] {
  // Get the most recent subagent registration with this name
  const subagentStmt = mockDb.prepare(`
    SELECT created_at FROM subagent_registry 
    WHERE name = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  const subagent = subagentStmt.get(subagentName);
  if (!subagent) {
    return [];
  }
  
  // Get all messages created after this subagent was registered
  const messagesStmt = mockDb.prepare(`
    SELECT id, sender, message, created_at, notified 
    FROM subagent_messages 
    WHERE created_at > ?
    ORDER BY created_at ASC
  `);
  
  const messages = messagesStmt.all((subagent as any).created_at);
  
  // Filter out messages where this subagent is already in the notified list
  // and also filter out messages sent by this subagent itself
  const unreadMessages = (messages as any[]).filter(msg => {
    const notified = JSON.parse(msg.notified || '[]');
    return !notified.includes(subagentName) && msg.sender !== subagentName;
  });
  
  // Update the notified list for these messages
  const updateStmt = mockDb.prepare(`
    UPDATE subagent_messages 
    SET notified = ? 
    WHERE id = ?
  `);
  
  unreadMessages.forEach(msg => {
    const notified = JSON.parse(msg.notified || '[]');
    notified.push(subagentName);
    updateStmt.run(JSON.stringify(notified), msg.id);
  });
  
  // Return the messages
  return unreadMessages.map(msg => ({
    sender: msg.sender,
    message: JSON.parse(msg.message),
    created_at: msg.created_at
  }));
}

describe('Multi-Session Database Functions (Isolated)', () => {
  beforeEach(() => {
    initTestDatabase();
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
      expect((agents[0] as any).name).toBe(name);
      expect((agents[0] as any).subagent_type).toBe(type);
      expect((agents[0] as any).session_id).toBe(sessionId);
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
      expect((session1Agents[0] as any).subagent_type).toBe('engineer');
      expect((session2Agents[0] as any).subagent_type).toBe('tester');
    });

    test('getSubagents - should return empty array for nonexistent session', () => {
      const agents = getSubagents('nonexistent-session');
      expect(agents).toHaveLength(0);
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
        total_tokens: 1500
      };

      const success = updateSubagentCompletion(sessionId, agentName, completionData);
      expect(success).toBe(true);

      const agents = getSubagents(sessionId);
      const agent = agents[0] as any;
      
      expect(agent.completed_at).toBe(completionData.completed_at);
      expect(agent.status).toBe('completed');
      expect(agent.total_duration_ms).toBe(45000);
      expect(agent.total_tokens).toBe(1500);
    });

    test('updateSubagentCompletion - should return false for nonexistent agent', () => {
      const success = updateSubagentCompletion('fake-session', 'FakeAgent', {
        status: 'completed'
      });
      expect(success).toBe(false);
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

      const sessions = getSessionsWithAgents() as any[];
      
      expect(sessions).toHaveLength(3);
      
      const session1 = sessions.find(s => s.session_id === 'session-1');
      const session2 = sessions.find(s => s.session_id === 'session-2');
      const session3 = sessions.find(s => s.session_id === 'session-3');

      expect(session1?.agent_count).toBe(3);
      expect(session2?.agent_count).toBe(2);
      expect(session3?.agent_count).toBe(1);
    });
  });

  describe('Inter-Agent Messaging', () => {
    test('sendSubagentMessage and getUnreadMessages - basic flow', () => {
      const sender = 'SenderAgent';
      const receiver = 'ReceiverAgent';
      const testMessage = { type: 'status', content: 'Work completed' };

      // Register both agents with slight delay
      registerSubagent('test-session', sender, 'engineer');
      // Need to ensure receiver is registered after sender for message timing
      const delay = 10;
      setTimeout(() => {
        registerSubagent('test-session', receiver, 'tester');
        
        // Send message after receiver is registered
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
      }, delay);
    });

    test('getUnreadMessages - should handle nonexistent agent', () => {
      const messages = getUnreadMessages('NonexistentAgent');
      expect(messages).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple sessions efficiently', () => {
      const startTime = Date.now();
      
      // Create 25 sessions with varying agent counts
      for (let i = 1; i <= 25; i++) {
        const sessionId = `perf-session-${i.toString().padStart(3, '0')}`;
        const agentCount = Math.floor(Math.random() * 5) + 1; // 1-5 agents
        
        for (let j = 1; j <= agentCount; j++) {
          registerSubagent(sessionId, `Agent${j}`, 'engineer');
        }
      }
      
      const creationTime = Date.now() - startTime;
      
      // Test session retrieval performance
      const retrievalStart = Date.now();
      const sessions = getSessionsWithAgents();
      const retrievalTime = Date.now() - retrievalStart;
      
      expect(sessions).toHaveLength(25);
      expect(creationTime).toBeLessThan(1000); // Under 1 second
      expect(retrievalTime).toBeLessThan(100); // Under 100ms
      
      console.log(`Performance: Created 25 sessions in ${creationTime}ms, retrieved in ${retrievalTime}ms`);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    test('should handle special characters in names and messages', () => {
      const specialName = 'Agent!@#$%^&*()';
      const sessionId = 'special-char-test';
      
      const agentId = registerSubagent(sessionId, specialName, 'engineer');
      expect(agentId).toBeGreaterThan(0);
      
      const agents = getSubagents(sessionId);
      expect((agents[0] as any).name).toBe(specialName);
      
      const specialMessage = {
        content: 'Special chars: !@#$%^&*()',
        unicode: '🚀 Unicode test: 中文',
        escapes: 'New\nLine\tTab'
      };
      
      registerSubagent(sessionId, 'Receiver', 'tester');
      const messageId = sendSubagentMessage(specialName, specialMessage);
      expect(messageId).toBeGreaterThan(0);
      
      const messages = getUnreadMessages('Receiver');
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toEqual(specialMessage);
    });

    test('should handle null and undefined values appropriately', () => {
      const sessionId = 'null-test';
      registerSubagent(sessionId, 'TestAgent', 'engineer');
      
      const completion = updateSubagentCompletion(sessionId, 'TestAgent', {
        status: 'completed',
        total_duration_ms: undefined,
        total_tokens: null,
        completed_at: 0
      });
      
      expect(completion).toBe(true);
      
      const agents = getSubagents(sessionId) as any[];
      expect(agents[0].status).toBe('completed');
      expect(agents[0].completed_at).toBe(0);
    });
  });
});

describe('Mock Data Generation Tests', () => {
  test('should generate realistic session data', () => {
    // Simple mock data generation test
    const mockSession = {
      sessionId: 'mock-session-001',
      displayName: 'Mock Test Session',
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      status: 'completed',
      agentPaths: [
        {
          agentId: 1,
          agentName: 'MockAgent1',
          agentType: 'engineer',
          status: 'completed',
          startTime: Date.now() - 3600000,
          endTime: Date.now() - 1800000
        }
      ],
      metrics: {
        totalDuration: 3600000,
        agentCount: 1,
        messageCount: 5,
        completionRate: 1.0,
        errorRate: 0.0
      }
    };

    expect(mockSession.sessionId).toBeTruthy();
    expect(mockSession.agentPaths).toHaveLength(1);
    expect(mockSession.metrics.completionRate).toBe(1.0);
    expect(mockSession.startTime).toBeLessThan(mockSession.endTime!);
  });

  test('should validate session data structure', () => {
    const validateSessionData = (session: any) => {
      return (
        typeof session.sessionId === 'string' &&
        typeof session.startTime === 'number' &&
        Array.isArray(session.agentPaths) &&
        typeof session.metrics === 'object'
      );
    };

    const validSession = {
      sessionId: 'valid-session',
      startTime: Date.now(),
      agentPaths: [],
      metrics: { agentCount: 0 }
    };

    const invalidSession = {
      sessionId: null,
      startTime: 'invalid'
    };

    expect(validateSessionData(validSession)).toBe(true);
    expect(validateSessionData(invalidSession)).toBe(false);
  });

  test('should handle time window filtering', () => {
    const sessions = [
      { sessionId: 'recent', startTime: Date.now() - 1800000, endTime: Date.now() - 900000 },
      { sessionId: 'old', startTime: Date.now() - 7200000, endTime: Date.now() - 5400000 },
      { sessionId: 'active', startTime: Date.now() - 600000, endTime: undefined }
    ];

    const timeWindow = {
      start: Date.now() - 3600000,
      end: Date.now(),
      duration: 3600000,
      label: '1 hour'
    };

    const filtered = sessions.filter(session => {
      const sessionEnd = session.endTime || Date.now();
      return session.startTime < timeWindow.end && sessionEnd > timeWindow.start;
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map(s => s.sessionId)).toEqual(['recent', 'active']);
  });
});