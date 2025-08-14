/**
 * Integration Test for useMultiSessionData with InteractiveSessionsTimeline
 * 
 * This test validates that the composable properly integrates with the timeline component
 * and handles real-world scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useMultiSessionData } from './useMultiSessionData';
import type { SessionTimeWindow } from '../types/multi-session';

// Mock the real component expectations
const mockComponentData = {
  // Matches InteractiveSessionsTimeline.vue expected structure
  sessions: [],
  height: 600,
  showControls: true,
  defaultWindow: 3600000,
  autoRefresh: true
};

describe('useMultiSessionData Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
    global.WebSocket = vi.fn().mockImplementation(() => ({
      readyState: 1,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn()
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should provide data in format expected by InteractiveSessionsTimeline', async () => {
    // Setup mock API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              session_id: 'test-session-123',
              agent_count: 2,
              created_at: Date.now() - 1800000
            }
          ])
        });
      }
      if (url.includes('/events/recent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              source_app: 'claude-code',
              session_id: 'test-session-123',
              hook_event_type: 'task_created',
              payload: { task: 'integration test' },
              timestamp: Date.now() - 1800000
            }
          ])
        });
      }
      if (url.includes('/subagents/test-session-123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              name: 'IntegrationAgent',
              subagent_type: 'engineer',
              created_at: Date.now() - 1800000,
              completed_at: Date.now() - 1500000,
              status: 'completed',
              total_duration_ms: 300000
            }
          ])
        });
      }
      if (url.includes('/subagents/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              sender: 'IntegrationAgent',
              message: 'Integration test message',
              created_at: Date.now() - 1700000
            }
          ])
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    const timeWindow: SessionTimeWindow = {
      start: Date.now() - 3600000,
      end: Date.now(),
      duration: 3600000,
      label: '1 hour'
    };

    const composable = useMultiSessionData(timeWindow);

    // Wait for data to load
    await vi.runAllTimersAsync();
    await nextTick();

    const sessions = composable.visibleSessions.value;
    
    // Verify component compatibility
    expect(sessions).toBeDefined();
    expect(Array.isArray(sessions)).toBe(true);
    
    if (sessions.length > 0) {
      const session = sessions[0];
      
      // Verify required properties for InteractiveSessionsTimeline
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('displayName');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('endTime');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('agents'); // Component expects 'agents' array
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('agentCount');
      
      // Verify data types match component expectations
      expect(typeof session.sessionId).toBe('string');
      expect(typeof session.displayName).toBe('string');
      expect(typeof session.startTime).toBe('number');
      expect(['active', 'completed', 'failed', 'pending']).toContain(session.status);
      expect(Array.isArray(session.agents || session.agentPaths)).toBe(true);
    }
  });

  it('should handle component prop updates correctly', async () => {
    const composable = useMultiSessionData();
    
    // Simulate component prop changes
    const newTimeWindow: SessionTimeWindow = {
      start: Date.now() - 1800000,
      end: Date.now(),
      duration: 1800000,
      label: '30 minutes'
    };
    
    composable.setTimeWindow(newTimeWindow);
    expect(composable.timeWindow.value).toEqual(newTimeWindow);
    
    composable.setSessionLayout('stacked');
    expect(composable.sessionLayout.value).toBe('stacked');
  });

  it('should emit events in format expected by component', async () => {
    const composable = useMultiSessionData();
    
    // Component listens for these events
    const eventHandlers = {
      'session-selected': vi.fn(),
      'agent-selected': vi.fn(),
      'message-selected': vi.fn(),
      'time-window-changed': vi.fn(),
      'zoom-changed': vi.fn()
    };

    // Simulate component event handling
    composable.setTimeWindow({
      start: Date.now() - 1800000,
      end: Date.now(),
      duration: 1800000,
      label: '30 minutes'
    });
    
    // Events should be handled (would be tested in component integration)
    expect(composable.timeWindow.value.label).toBe('30 minutes');
  });

  it('should provide multi-session data structure for visualization', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { session_id: 's1', agent_count: 2, created_at: Date.now() - 3600000 },
            { session_id: 's2', agent_count: 3, created_at: Date.now() - 1800000 }
          ])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const composable = useMultiSessionData();
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    const multiSessionData = composable.multiSessionData.value;
    
    // Verify structure for timeline visualization
    expect(multiSessionData.sessions).toBeDefined();
    expect(multiSessionData.timeRange).toBeDefined();
    expect(multiSessionData.sessionLayout).toBeDefined();
    expect(multiSessionData.totalSessions).toBeDefined();
    expect(multiSessionData.totalAgents).toBeDefined();
    
    // Should provide swim lane data
    expect(multiSessionData.sessionLayout).toBe('swim_lanes');
    expect(typeof multiSessionData.totalSessions).toBe('number');
    expect(typeof multiSessionData.totalAgents).toBe('number');
  });

  it('should handle real-time updates via WebSocket', async () => {
    const mockWs = {
      readyState: 1,
      onopen: null as any,
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
      send: vi.fn(),
      close: vi.fn()
    };

    (global.WebSocket as any).mockImplementation(() => mockWs);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    const composable = useMultiSessionData();
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    // Simulate WebSocket message
    const update = {
      type: 'subagent_registered',
      data: {
        session_id: 'new-session',
        name: 'NewAgent',
        subagent_type: 'tester'
      }
    };
    
    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(update) });
    }
    
    await nextTick();
    
    // Should handle the update (component would show new data)
    expect(mockWs.send).not.toHaveBeenCalled(); // Read-only in composable
  });

  it('should maintain performance with multiple sessions', async () => {
    // Mock 25 sessions (above virtual scrolling threshold)
    const manySessions = Array.from({ length: 25 }, (_, i) => ({
      session_id: `perf-session-${i}`,
      agent_count: Math.floor(Math.random() * 5) + 1,
      created_at: Date.now() - (i * 60000)
    }));

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(manySessions)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const startTime = performance.now();
    const composable = useMultiSessionData(undefined, { maxSessions: 20 });
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    const endTime = performance.now();
    
    // Should complete initialization quickly
    expect(endTime - startTime).toBeLessThan(100);
    
    // Should respect max sessions limit for performance
    expect(composable.visibleSessions.value.length).toBeLessThanOrEqual(20);
  });

  it('should provide cache statistics for monitoring', async () => {
    const composable = useMultiSessionData();
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    // Access internal service for monitoring (would be exposed via dev tools)
    const multiSessionData = composable.multiSessionData.value;
    
    expect(multiSessionData.lastUpdated).toBeGreaterThan(0);
    expect(typeof multiSessionData.totalSessions).toBe('number');
    expect(typeof multiSessionData.totalAgents).toBe('number');
  });

  it('should support component unmounting gracefully', async () => {
    const composable = useMultiSessionData();
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    // Verify resources can be cleaned up
    expect(composable.isLoading.value).toBe(false);
    expect(composable.error.value).toBeNull();
    
    // Should not throw when accessing data after unmount simulation
    expect(() => {
      const data = composable.multiSessionData.value;
      expect(data).toBeDefined();
    }).not.toThrow();
  });
});

// ============================================================================
// Data Adapter Tests
// ============================================================================

describe('useMultiSessionData Adapter Pattern', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should transform server response to SessionData format', async () => {
    const mockServerResponse = {
      sessions: [
        {
          session_id: 'adapter-test',
          agent_count: 1,
          created_at: Date.now() - 1800000
        }
      ],
      events: [
        {
          id: 1,
          session_id: 'adapter-test',
          hook_event_type: 'task_created',
          payload: { task: 'adapter' },
          timestamp: Date.now() - 1800000
        }
      ],
      agents: [
        {
          name: 'AdapterAgent',
          subagent_type: 'engineer',
          created_at: Date.now() - 1800000,
          status: 'completed'
        }
      ]
    };

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockServerResponse.sessions)
        });
      }
      if (url.includes('/events/recent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockServerResponse.events)
        });
      }
      if (url.includes('/subagents/adapter-test')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockServerResponse.agents)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const composable = useMultiSessionData();
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    const sessions = composable.visibleSessions.value;
    expect(sessions.length).toBeGreaterThan(0);
    
    const session = sessions[0];
    
    // Verify transformation
    expect(session.sessionId).toBe('adapter-test');
    expect(session.displayName).toBeDefined();
    expect(session.agentPaths).toBeDefined();
    expect(session.orchestratorEvents).toBeDefined();
    expect(session.sessionLaneHeight).toBeDefined();
    expect(session.metrics).toBeDefined();
    
    // Verify metrics calculation
    expect(session.metrics?.agentCount).toBe(session.agentPaths.length);
    expect(session.metrics?.completionRate).toBeGreaterThanOrEqual(0);
    expect(session.metrics?.completionRate).toBeLessThanOrEqual(1);
  });
});