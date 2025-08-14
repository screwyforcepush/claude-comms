import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { 
  initDatabase, 
  registerSubagent, 
  getSessionsInTimeWindow,
  getSessionsWithAgents,
  updateSubagentPrompt,
  updateSubagentResponse,
  getSubagents,
  getDatabase
} from "./db";
import { setupTestDatabase, teardownTestDatabase } from "../__tests__/test-setup";

describe("Session Time Window Filtering", () => {
  beforeEach(() => {
    // Set up isolated test database
    setupTestDatabase();
  });

  afterEach(() => {
    // Clean up test database
    teardownTestDatabase();
  });

  test("should include sessions based on most recent agent created_at", async () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;
    
    // Create session 1 with agents spanning a wide time range
    // First agent created long ago
    registerSubagent("session-1", "Agent1", "engineer");
    const db = getDatabase();
    db.exec(`UPDATE subagent_registry SET created_at = ${twoHoursAgo} WHERE name = 'Agent1'`);
    
    // Most recent agent created recently (within last hour)
    registerSubagent("session-1", "Agent2", "architect");
    const fifteenMinutesAgo = now - 900000;
    db.exec(`UPDATE subagent_registry SET created_at = ${fifteenMinutesAgo} WHERE name = 'Agent2'`);
    
    // Create session 2 with all agents created 2 hours ago (outside window)
    registerSubagent("session-2", "Agent3", "planner");
    db.exec(`UPDATE subagent_registry SET created_at = ${twoHoursAgo} WHERE name = 'Agent3'`);
    registerSubagent("session-2", "Agent4", "designer");
    db.exec(`UPDATE subagent_registry SET created_at = ${twoHoursAgo + 60000} WHERE name = 'Agent4'`);
    
    // Time window: last hour (oneHourAgo to now)
    const sessionsInLastHour = getSessionsInTimeWindow(oneHourAgo, now);
    
    // Session 1 should be included because its most recent agent (Agent2) was created within the time window
    const session1InResults = sessionsInLastHour.find(s => s.session_id === "session-1");
    expect(session1InResults).toBeDefined();
    expect(session1InResults?.agent_count).toBe(2);
    
    // Session 2 should NOT be included because its most recent agent was created 2 hours ago
    const session2InResults = sessionsInLastHour.find(s => s.session_id === "session-2");
    expect(session2InResults).toBeUndefined();
  });

  test("should correctly handle multiple sessions with varying agent creation times", () => {
    const now = Date.now();
    const fifteenMinutesAgo = now - 900000;
    const thirtyMinutesAgo = now - 1800000;
    const twoHoursAgo = now - 7200000;
    
    const db = getDatabase();
    
    // Session A: old start, recent end
    registerSubagent("session-a", "A1", "engineer");
    db.exec(`UPDATE subagent_registry SET created_at = ${twoHoursAgo} WHERE name = 'A1'`);
    registerSubagent("session-a", "A2", "architect");
    db.exec(`UPDATE subagent_registry SET created_at = ${fifteenMinutesAgo} WHERE name = 'A2'`);
    
    // Session B: all agents in middle period  
    registerSubagent("session-b", "B1", "planner");
    db.exec(`UPDATE subagent_registry SET created_at = ${thirtyMinutesAgo} WHERE name = 'B1'`);
    registerSubagent("session-b", "B2", "designer");
    db.exec(`UPDATE subagent_registry SET created_at = ${thirtyMinutesAgo - 60000} WHERE name = 'B2'`);
    
    // Session C: very recent
    registerSubagent("session-c", "C1", "engineer");
    
    // Query for last 20 minutes
    const twentyMinutesAgo = now - 1200000;
    const recentSessions = getSessionsInTimeWindow(twentyMinutesAgo, now);
    
    // Should include session-a (most recent agent 15 min ago) and session-c (just now)
    // Should NOT include session-b (most recent agent 30 min ago)
    expect(recentSessions.map(s => s.session_id)).toContain("session-a");
    expect(recentSessions.map(s => s.session_id)).toContain("session-c");
    expect(recentSessions.map(s => s.session_id)).not.toContain("session-b");
  });

  test("getSessionsWithAgents should use MAX(created_at) for session timestamp", () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const db = getDatabase();
    
    // Create a session with multiple agents at different times
    registerSubagent("test-session", "FirstAgent", "engineer");
    db.exec(`UPDATE subagent_registry SET created_at = ${oneHourAgo} WHERE name = 'FirstAgent'`);
    
    registerSubagent("test-session", "LastAgent", "architect");
    
    const sessions = getSessionsWithAgents();
    const testSession = sessions.find(s => s.session_id === "test-session");
    
    expect(testSession).toBeDefined();
    expect(testSession?.agent_count).toBe(2);
    // The created_at should be close to now (from LastAgent), not oneHourAgo
    expect(testSession?.created_at).toBeGreaterThan(now - 1000);
  });
});

describe("Agent Prompt and Response Storage", () => {
  beforeEach(() => {
    // Set up isolated test database
    setupTestDatabase();
  });

  afterEach(() => {
    // Clean up test database
    teardownTestDatabase();
  });

  test("should store and retrieve agent prompts and responses", () => {
    const sessionId = "test-session";
    const agentName = "TestAgent";
    
    // Register agent
    const agentId = registerSubagent(sessionId, agentName, "engineer");
    expect(agentId).toBeGreaterThan(0);
    
    // Test prompt storage
    const testPrompt = "You are a test engineer. Implement comprehensive test coverage for the user authentication system.";
    const promptUpdated = updateSubagentPrompt(sessionId, agentName, testPrompt);
    expect(promptUpdated).toBe(true);
    
    // Test response storage
    const testResponse = "I have implemented a comprehensive test suite with 95% coverage for the authentication system, including unit tests for login, signup, and password reset functionality.";
    const responseUpdated = updateSubagentResponse(sessionId, agentName, testResponse);
    expect(responseUpdated).toBe(true);
    
    // Retrieve agent data
    const agents = getSubagents(sessionId);
    expect(agents).toHaveLength(1);
    
    const agent = agents[0];
    expect(agent.name).toBe(agentName);
    expect(agent.initial_prompt).toBe(testPrompt);
    expect(agent.final_response).toBe(testResponse);
  });

  test("should handle large prompt and response text", () => {
    const sessionId = "large-text-session";
    const agentName = "LargeTextAgent";
    
    registerSubagent(sessionId, agentName, "architect");
    
    // Test with moderately large text (10KB)
    const largePrompt = "A".repeat(10240); // 10KB of A's
    const largeResponse = "B".repeat(10240); // 10KB of B's
    
    const promptUpdated = updateSubagentPrompt(sessionId, agentName, largePrompt);
    expect(promptUpdated).toBe(true);
    
    const responseUpdated = updateSubagentResponse(sessionId, agentName, largeResponse);
    expect(responseUpdated).toBe(true);
    
    const agents = getSubagents(sessionId);
    const agent = agents[0];
    expect(agent.initial_prompt).toBe(largePrompt);
    expect(agent.final_response).toBe(largeResponse);
  });

  test("should maintain backward compatibility with existing agents", () => {
    const sessionId = "backward-compat-session";
    const agentName = "BackwardCompatAgent";
    
    // Register agent without prompt/response
    registerSubagent(sessionId, agentName, "engineer");
    
    // Retrieve should work fine with null values
    const agents = getSubagents(sessionId);
    const agent = agents[0];
    
    expect(agent.name).toBe(agentName);
    expect(agent.initial_prompt).toBeNull();
    expect(agent.final_response).toBeNull();
    expect(agent.subagent_type).toBe("engineer");
  });
});