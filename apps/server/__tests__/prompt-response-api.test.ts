/**
 * TDD Test Suite for Agent Prompt/Response API Endpoints  
 * JuanNebula - Backend API Engineer
 * 
 * Tests written FIRST to define expected behavior before implementation
 */

import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, teardownTestDatabase } from './test-setup';
import { Database } from 'bun:sqlite';
import { 
  initDatabase, 
  registerSubagent, 
  getSubagents,
  storeAgentPrompt,
  storeAgentResponse,
  getAgentPromptResponse
} from '../src/db';

// Test database setup
describe('Agent Prompt/Response API Database Functions', () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  describe('storeAgentPrompt Function', () => {
    test('should store initial prompt for existing agent', () => {
      const sessionId = 'test-session-001';
      const agentName = 'TestAgent';
      const prompt = 'Your name is TestAgent. Implement the user authentication feature with proper validation and error handling.';
      
      // Register agent first
      registerSubagent(sessionId, agentName, 'engineer');
      
      // Store prompt
      const success = storeAgentPrompt(sessionId, agentName, prompt);
      expect(success).toBe(true);
      
      // Verify prompt was stored
      const agents = getSubagents(sessionId);
      expect(agents).toHaveLength(1);
      expect(agents[0].initial_prompt).toBe(prompt);
    });

    test('should return false for nonexistent agent', () => {
      const success = storeAgentPrompt('fake-session', 'FakeAgent', 'Some prompt');
      expect(success).toBe(false);
    });

    test('should handle very long prompts (up to 1MB)', () => {
      const sessionId = 'long-prompt-session';
      const agentName = 'LongPromptAgent';
      const longPrompt = 'Long prompt: ' + 'A'.repeat(1000000); // ~1MB
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = storeAgentPrompt(sessionId, agentName, longPrompt);
      expect(success).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].initial_prompt).toBe(longPrompt);
    });

    test('should handle special characters and unicode', () => {
      const sessionId = 'unicode-session';
      const agentName = 'UnicodeAgent';
      const unicodePrompt = 'Prompt with special chars: !@#$%^&*() and unicode: 🚀 中文 العربية\n\nNewlines and "quotes" and \'apostrophes\' included.';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = storeAgentPrompt(sessionId, agentName, unicodePrompt);
      expect(success).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].initial_prompt).toBe(unicodePrompt);
    });

    test('should handle empty string prompts', () => {
      const sessionId = 'empty-prompt-session';
      const agentName = 'EmptyPromptAgent';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = storeAgentPrompt(sessionId, agentName, '');
      expect(success).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].initial_prompt).toBe('');
    });

    test('should allow updating existing prompt', () => {
      const sessionId = 'update-prompt-session';
      const agentName = 'UpdateAgent';
      const originalPrompt = 'Original prompt';
      const updatedPrompt = 'Updated prompt with more details';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      // Store original
      storeAgentPrompt(sessionId, agentName, originalPrompt);
      let agents = getSubagents(sessionId);
      expect(agents[0].initial_prompt).toBe(originalPrompt);
      
      // Update prompt
      const success = storeAgentPrompt(sessionId, agentName, updatedPrompt);
      expect(success).toBe(true);
      
      agents = getSubagents(sessionId);
      expect(agents[0].initial_prompt).toBe(updatedPrompt);
    });
  });

  describe('storeAgentResponse Function', () => {
    test('should store final response for existing agent', () => {
      const sessionId = 'response-session';
      const agentName = 'ResponseAgent';
      const response = 'Task completed successfully. Implemented authentication with JWT tokens, input validation, and comprehensive error handling.';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = storeAgentResponse(sessionId, agentName, response);
      expect(success).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].final_response).toBe(response);
    });

    test('should return false for nonexistent agent', () => {
      const success = storeAgentResponse('fake-session', 'FakeAgent', 'Some response');
      expect(success).toBe(false);
    });

    test('should handle JSON responses', () => {
      const sessionId = 'json-response-session';
      const agentName = 'JsonAgent';
      const jsonResponse = JSON.stringify({
        status: 'completed',
        results: {
          files_created: ['auth.ts', 'auth.test.ts'],
          lines_of_code: 245,
          tests_passed: 15,
          coverage: '95%'
        },
        metadata: {
          duration_ms: 45000,
          tokens_used: 1250
        }
      });
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = storeAgentResponse(sessionId, agentName, jsonResponse);
      expect(success).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].final_response).toBe(jsonResponse);
      
      // Verify it can be parsed back
      const parsedResponse = JSON.parse(agents[0].final_response);
      expect(parsedResponse.status).toBe('completed');
      expect(parsedResponse.results.files_created).toHaveLength(2);
    });

    test('should handle code responses with syntax', () => {
      const sessionId = 'code-response-session';
      const agentName = 'CodeAgent';
      const codeResponse = `Implementation complete. Files created:

\`\`\`typescript
// auth.ts
export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export async function authenticate(token: string): Promise<AuthUser> {
  // JWT verification logic
  return { id: '123', email: 'user@example.com', role: 'user' };
}
\`\`\`

Tests passing: 15/15 ✅
Coverage: 95% ✅`;
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      const success = storeAgentResponse(sessionId, agentName, codeResponse);
      expect(success).toBe(true);
      
      const agents = getSubagents(sessionId);
      expect(agents[0].final_response).toBe(codeResponse);
    });
  });

  describe('getAgentPromptResponse Function', () => {
    test('should retrieve prompt and response for existing agent', () => {
      const sessionId = 'get-test-session';
      const agentName = 'GetTestAgent';
      const prompt = 'Build a todo application';
      const response = 'Todo app built successfully with CRUD operations';
      
      registerSubagent(sessionId, agentName, 'engineer');
      storeAgentPrompt(sessionId, agentName, prompt);
      storeAgentResponse(sessionId, agentName, response);
      
      const data = getAgentPromptResponse(sessionId, agentName);
      expect(data).not.toBeNull();
      expect(data?.initial_prompt).toBe(prompt);
      expect(data?.final_response).toBe(response);
    });

    test('should return null for nonexistent agent', () => {
      const data = getAgentPromptResponse('fake-session', 'FakeAgent');
      expect(data).toBeNull();
    });

    test('should handle agent with only prompt (no response)', () => {
      const sessionId = 'prompt-only-session';
      const agentName = 'PromptOnlyAgent';
      const prompt = 'Create a database schema';
      
      registerSubagent(sessionId, agentName, 'engineer');
      storeAgentPrompt(sessionId, agentName, prompt);
      
      const data = getAgentPromptResponse(sessionId, agentName);
      expect(data).not.toBeNull();
      expect(data?.initial_prompt).toBe(prompt);
      expect(data?.final_response).toBeNull();
    });

    test('should handle agent with only response (no prompt)', () => {
      const sessionId = 'response-only-session';
      const agentName = 'ResponseOnlyAgent';
      const response = 'Task completed without stored prompt';
      
      registerSubagent(sessionId, agentName, 'engineer');
      storeAgentResponse(sessionId, agentName, response);
      
      const data = getAgentPromptResponse(sessionId, agentName);
      expect(data).not.toBeNull();
      expect(data?.initial_prompt).toBeNull();
      expect(data?.final_response).toBe(response);
    });
  });

  describe('getSubagents Integration with Prompt/Response', () => {
    test('should include prompt and response in getSubagents results', () => {
      const sessionId = 'integration-session';
      const agent1Name = 'IntegrationAgent1';
      const agent2Name = 'IntegrationAgent2';
      
      const prompt1 = 'Build frontend components';
      const response1 = 'Frontend components completed';
      const prompt2 = 'Write API endpoints';
      const response2 = 'API endpoints implemented';
      
      // Create agents
      registerSubagent(sessionId, agent1Name, 'engineer');
      registerSubagent(sessionId, agent2Name, 'engineer');
      
      // Store prompts and responses
      storeAgentPrompt(sessionId, agent1Name, prompt1);
      storeAgentResponse(sessionId, agent1Name, response1);
      storeAgentPrompt(sessionId, agent2Name, prompt2);
      storeAgentResponse(sessionId, agent2Name, response2);
      
      const agents = getSubagents(sessionId);
      expect(agents).toHaveLength(2);
      
      // Verify both agents have prompt/response data
      const agent1 = agents.find(a => a.name === agent1Name);
      const agent2 = agents.find(a => a.name === agent2Name);
      
      expect(agent1?.initial_prompt).toBe(prompt1);
      expect(agent1?.final_response).toBe(response1);
      expect(agent2?.initial_prompt).toBe(prompt2);
      expect(agent2?.final_response).toBe(response2);
    });

    test('should handle agents without prompt/response data', () => {
      const sessionId = 'mixed-session';
      const agent1Name = 'CompleteAgent';
      const agent2Name = 'EmptyAgent';
      
      const prompt1 = 'Complete task with data';
      const response1 = 'Task completed';
      
      // Create both agents
      registerSubagent(sessionId, agent1Name, 'engineer');
      registerSubagent(sessionId, agent2Name, 'engineer');
      
      // Only store data for one agent
      storeAgentPrompt(sessionId, agent1Name, prompt1);
      storeAgentResponse(sessionId, agent1Name, response1);
      
      const agents = getSubagents(sessionId);
      expect(agents).toHaveLength(2);
      
      const completeAgent = agents.find(a => a.name === agent1Name);
      const emptyAgent = agents.find(a => a.name === agent2Name);
      
      expect(completeAgent?.initial_prompt).toBe(prompt1);
      expect(completeAgent?.final_response).toBe(response1);
      expect(emptyAgent?.initial_prompt).toBeNull();
      expect(emptyAgent?.final_response).toBeNull();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent prompt/response operations', () => {
      const sessionId = 'concurrent-session';
      const agentCount = 10;
      const operations: Promise<boolean>[] = [];
      
      // Register agents
      for (let i = 1; i <= agentCount; i++) {
        registerSubagent(sessionId, `Agent${i}`, 'engineer');
      }
      
      // Concurrent prompt storage
      for (let i = 1; i <= agentCount; i++) {
        operations.push(
          Promise.resolve(storeAgentPrompt(sessionId, `Agent${i}`, `Prompt for Agent ${i}`))
        );
      }
      
      // Concurrent response storage
      for (let i = 1; i <= agentCount; i++) {
        operations.push(
          Promise.resolve(storeAgentResponse(sessionId, `Agent${i}`, `Response from Agent ${i}`))
        );
      }
      
      return Promise.all(operations).then(results => {
        // All operations should succeed
        expect(results.every(r => r === true)).toBe(true);
        
        const agents = getSubagents(sessionId);
        expect(agents).toHaveLength(agentCount);
        
        // Verify all agents have data
        agents.forEach((agent, index) => {
          const agentNum = agentCount - index; // Reverse order due to DESC sorting
          expect(agent.initial_prompt).toBe(`Prompt for Agent ${agentNum}`);
          expect(agent.final_response).toBe(`Response from Agent ${agentNum}`);
        });
      });
    });

    test('should handle malformed data gracefully', () => {
      const sessionId = 'malformed-session';
      const agentName = 'MalformedAgent';
      
      registerSubagent(sessionId, agentName, 'engineer');
      
      // Test with potential SQL injection attempts
      const maliciousPrompt = "'; DROP TABLE subagent_registry; --";
      const success = storeAgentPrompt(sessionId, agentName, maliciousPrompt);
      
      expect(success).toBe(true);
      const agents = getSubagents(sessionId);
      expect(agents).toHaveLength(1);
      expect(agents[0].initial_prompt).toBe(maliciousPrompt);
    });

    test('should maintain data integrity across operations', () => {
      const sessionId = 'integrity-session';
      const agentName = 'IntegrityAgent';
      
      // Register agent
      const agentId = registerSubagent(sessionId, agentName, 'engineer');
      expect(agentId).toBeGreaterThan(0);
      
      // Store prompt
      const promptSuccess = storeAgentPrompt(sessionId, agentName, 'Test prompt');
      expect(promptSuccess).toBe(true);
      
      // Store response
      const responseSuccess = storeAgentResponse(sessionId, agentName, 'Test response');
      expect(responseSuccess).toBe(true);
      
      // Verify via both methods
      const agents = getSubagents(sessionId);
      const directData = getAgentPromptResponse(sessionId, agentName);
      
      expect(agents[0].initial_prompt).toBe(directData?.initial_prompt);
      expect(agents[0].final_response).toBe(directData?.final_response);
    });
  });
});