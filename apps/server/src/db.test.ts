import { test, expect, describe, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { 
  initDatabase, 
  registerSubagent, 
  getSessionsInTimeWindow,
  getSessionsWithAgents 
} from "./db";

describe("Session Time Window Filtering", () => {
  beforeEach(() => {
    // Initialize database for each test
    initDatabase();
  });

  test("should include sessions based on most recent agent created_at", async () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;
    
    // Create session 1 with agents spanning a wide time range
    // First agent created long ago
    registerSubagent("session-1", "Agent1", "engineer");
    const db = new Database('events.db');
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
    
    db.close();
  });

  test("should correctly handle multiple sessions with varying agent creation times", () => {
    const now = Date.now();
    const fifteenMinutesAgo = now - 900000;
    const thirtyMinutesAgo = now - 1800000;
    const twoHoursAgo = now - 7200000;
    
    const db = new Database('events.db');
    
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
    
    db.close();
  });

  test("getSessionsWithAgents should use MAX(created_at) for session timestamp", () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const db = new Database('events.db');
    
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
    
    db.close();
  });
});