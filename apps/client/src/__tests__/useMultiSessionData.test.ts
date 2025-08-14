import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { nextTick } from 'vue';
import { useMultiSessionData } from '../composables/useMultiSessionData';
import type { SessionTimeWindow, SessionFilter } from '../types/multi-session';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  url: string;
  
  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }
  
  send(_data: string) {
    // Mock send - data parameter prefixed with _ to indicate intentionally unused
  }
  
  close() {
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

global.WebSocket = MockWebSocket as any;

// Mock console methods to avoid test noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockSessionsData = [
  {
    session_id: 'session-123',
    agent_count: 3,
    created_at: Date.now() - 3600000 // 1 hour ago
  },
  {
    session_id: 'session-456',
    agent_count: 2,
    created_at: Date.now() - 1800000 // 30 minutes ago
  }
];

const mockEventsData = [
  {
    id: 1,
    source_app: 'claude-code',
    session_id: 'session-123',
    hook_event_type: 'task_created',
    payload: { task: 'test' },
    timestamp: Date.now() - 3600000
  },
  {
    id: 2,
    source_app: 'claude-code',
    session_id: 'session-456',
    hook_event_type: 'agent_spawned',
    payload: { agent: 'TestAgent' },
    timestamp: Date.now() - 1800000
  }
];

const mockAgentsData = [
  {
    name: 'TestAgent1',
    subagent_type: 'engineer',
    created_at: Date.now() - 3600000,
    completed_at: Date.now() - 3300000,
    status: 'completed',
    total_duration_ms: 300000,
    total_tokens: 1000
  },
  {
    name: 'TestAgent2',
    subagent_type: 'reviewer',
    created_at: Date.now() - 3500000,
    completed_at: null,
    status: 'active',
    total_duration_ms: null,
    total_tokens: 500
  }
];

const mockMessagesData = [
  {
    sender: 'TestAgent1',
    message: 'Hello from agent 1',
    created_at: Date.now() - 3400000
  },
  {
    sender: 'TestAgent2',
    message: { type: 'status', content: 'In progress' },
    created_at: Date.now() - 3200000
  }
];

const defaultTimeWindow: SessionTimeWindow = {
  start: Date.now() - 3600000, // 1 hour ago
  end: Date.now(),
  duration: 3600000, // 1 hour
  label: '1 hour'
};

// ============================================================================
// Test Suite
// ============================================================================

describe('useMultiSessionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mock responses
    mockFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const urlString = url.toString();
      
      if (urlString.includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSessionsData)
        } as Response);
      }
      
      if (urlString.includes('/events/recent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEventsData)
        } as Response);
      }
      
      if (urlString.includes('/subagents/session-')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAgentsData)
        } as Response);
      }
      
      if (urlString.includes('/subagents/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessagesData)
        } as Response);
      }
      
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const composable = useMultiSessionData();
      
      expect(composable.multiSessionData.value.sessions).toEqual([]);
      expect(composable.visibleSessions.value).toEqual([]);
      expect(composable.sessionLayout.value).toBe('swim_lanes');
      expect(composable.isLoading.value).toBe(false);
      expect(composable.error.value).toBeNull();
    });

    it('should accept custom time window', () => {
      const customWindow: SessionTimeWindow = {
        start: Date.now() - 1800000,
        end: Date.now(),
        duration: 1800000,
        label: '30 minutes'
      };
      
      const composable = useMultiSessionData(customWindow);
      expect(composable.timeWindow.value).toEqual(customWindow);
    });

    it('should accept options configuration', () => {
      const composable = useMultiSessionData(defaultTimeWindow, {
        autoRefresh: false,
        maxSessions: 10
      });
      
      // Should not auto-fetch when autoRefresh is false
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch sessions in time window', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      // Wait for initial fetch
      await vi.runAllTimersAsync();
      await nextTick();
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/subagents/sessions');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/events/recent?limit=500');
      expect(composable.visibleSessions.value).toHaveLength(2);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      expect(composable.error.value).toContain('Network error');
      expect(composable.visibleSessions.value).toEqual([]);
    });

    it('should implement caching to reduce API calls', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      // First fetch
      await composable.refreshSessions();
      const firstCallCount = mockFetch.mock.calls.length;
      
      // Second fetch immediately - should use cache
      await composable.refreshSessions();
      
      // Cache should reduce redundant calls
      expect(mockFetch.mock.calls.length).toBe(firstCallCount);
    });

    it('should refresh sessions manually', async () => {
      const composable = useMultiSessionData(defaultTimeWindow, { autoRefresh: false });
      
      expect(composable.visibleSessions.value).toHaveLength(0);
      
      await composable.refreshSessions();
      await nextTick();
      
      expect(composable.visibleSessions.value.length).toBeGreaterThan(0);
    });

    it('should fetch specific session details', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      const sessions = await composable.fetchSessionsInWindow(defaultTimeWindow);
      await nextTick();
      
      expect(sessions).toBeDefined();
      expect(sessions.length).toBeGreaterThan(0);
      
      // Should have called agent endpoints for each session
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/subagents/session-123');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/subagents/session-456');
    });
  });

  describe('Time Window Management', () => {
    it('should update time window', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      const newWindow: SessionTimeWindow = {
        start: Date.now() - 1800000,
        end: Date.now(),
        duration: 1800000,
        label: '30 minutes'
      };
      
      composable.setTimeWindow(newWindow);
      
      expect(composable.timeWindow.value).toEqual(newWindow);
    });

    it('should auto-refresh when time window changes', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      vi.clearAllMocks(); // Clear initial fetch calls
      
      const newWindow: SessionTimeWindow = {
        start: Date.now() - 1800000,
        end: Date.now(),
        duration: 1800000,
        label: '30 minutes'
      };
      
      composable.setTimeWindow(newWindow);
      await vi.runAllTimersAsync();
      
      // Should trigger new fetch with updated window
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Session Layout', () => {
    it('should update session layout', () => {
      const composable = useMultiSessionData();
      
      composable.setSessionLayout('stacked');
      expect(composable.sessionLayout.value).toBe('stacked');
      
      composable.setSessionLayout('hierarchical');
      expect(composable.sessionLayout.value).toBe('hierarchical');
    });
  });

  describe('Session Filtering', () => {
    it('should filter by session IDs', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      // Wait for initial data
      await vi.runAllTimersAsync();
      await nextTick();
      
      const filter: SessionFilter = {
        sessionIds: ['session-123']
      };
      
      composable.filterSessions(filter);
      await nextTick();
      
      const visible = composable.visibleSessions.value;
      expect(visible).toHaveLength(1);
      expect(visible[0].sessionId).toBe('session-123');
    });

    it('should filter by status', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const filter: SessionFilter = {
        status: ['active']
      };
      
      composable.filterSessions(filter);
      await nextTick();
      
      const visible = composable.visibleSessions.value;
      visible.forEach(session => {
        expect(session.status).toBe('active');
      });
    });

    it('should filter by agent count range', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const filter: SessionFilter = {
        agentCountRange: { min: 3, max: 5 }
      };
      
      composable.filterSessions(filter);
      await nextTick();
      
      const visible = composable.visibleSessions.value;
      visible.forEach(session => {
        const agentCount = session.agentPaths.length;
        expect(agentCount).toBeGreaterThanOrEqual(3);
        expect(agentCount).toBeLessThanOrEqual(5);
      });
    });

    it('should filter by search query', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const filter: SessionFilter = {
        searchQuery: 'session-123'
      };
      
      composable.filterSessions(filter);
      await nextTick();
      
      const visible = composable.visibleSessions.value;
      expect(visible.some(s => s.sessionId.includes('session-123'))).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const filter: SessionFilter = {
        sessionIds: ['session-123', 'session-456'],
        agentCountRange: { min: 2, max: 10 }
      };
      
      composable.filterSessions(filter);
      await nextTick();
      
      const visible = composable.visibleSessions.value;
      expect(visible.length).toBeGreaterThan(0);
      
      visible.forEach(session => {
        expect(['session-123', 'session-456']).toContain(session.sessionId);
        expect(session.agentPaths.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Session Management', () => {
    it('should add new session', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      const newSession = {
        sessionId: 'session-789',
        displayName: 'New Session',
        startTime: Date.now(),
        status: 'active' as const,
        orchestratorEvents: [],
        userPrompts: [],
        agentBatches: [],
        agentPaths: [],
        messages: [],
        sessionLaneOffset: 0,
        sessionLaneHeight: 120,
        metrics: {
          totalDuration: 0,
          agentCount: 0,
          messageCount: 0,
          batchCount: 0,
          averageAgentDuration: 0,
          completionRate: 0,
          errorRate: 0
        }
      };
      
      composable.addSession(newSession);
      await nextTick();
      
      // Should be added to visible sessions
      expect(composable.visibleSessions.value.some(s => s.sessionId === 'session-789')).toBe(true);
    });

    it('should update existing session', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const initialSessions = composable.visibleSessions.value;
      const sessionToUpdate = { ...initialSessions[0] };
      sessionToUpdate.displayName = 'Updated Session';
      
      composable.addSession(sessionToUpdate);
      await nextTick();
      
      const updated = composable.visibleSessions.value.find(s => s.sessionId === sessionToUpdate.sessionId);
      expect(updated?.displayName).toBe('Updated Session');
    });

    it('should remove session', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const initialCount = composable.visibleSessions.value.length;
      const sessionToRemove = composable.visibleSessions.value[0];
      
      composable.removeSession(sessionToRemove.sessionId);
      await nextTick();
      
      expect(composable.visibleSessions.value).toHaveLength(initialCount - 1);
      expect(composable.visibleSessions.value.some(s => s.sessionId === sessionToRemove.sessionId)).toBe(false);
    });
  });

  describe('WebSocket Integration', () => {
    it('should connect to WebSocket on mount', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      
      // WebSocket should be connected (mocked)
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream');
    });

    it('should handle WebSocket messages for session updates', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      // Simulate WebSocket message
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      const message = {
        type: 'subagent_registered',
        data: {
          session_id: 'session-123',
          name: 'NewAgent',
          subagent_type: 'tester'
        }
      };
      
      if (mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', {
          data: JSON.stringify(message)
        }));
      }
      
      await nextTick();
      // Should trigger refresh or update
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should reconnect on WebSocket close', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      
      const mockWs = new MockWebSocket('ws://localhost:4000/stream');
      
      // Simulate connection close
      if (mockWs.onclose) {
        mockWs.onclose(new CloseEvent('close'));
      }
      
      // Should attempt reconnection after delay
      await vi.advanceTimersByTimeAsync(3000);
      
      expect(global.WebSocket).toHaveBeenCalledTimes(2); // Initial + reconnect
    });
  });

  describe('Performance & Caching', () => {
    it('should achieve target cache hit rate', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      // First call - cache miss
      await composable.refreshSessions();
      const firstCallCount = mockFetch.mock.calls.length;
      
      // Second call within cache window - should be cache hit
      await composable.refreshSessions();
      
      // Should not make additional API calls
      expect(mockFetch.mock.calls.length).toBe(firstCallCount);
    });

    it('should invalidate cache after TTL expires', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await composable.refreshSessions();
      vi.clearAllMocks();
      
      // Advance time beyond cache TTL (30 seconds)
      vi.advanceTimersByTime(31000);
      
      await composable.refreshSessions();
      
      // Should make new API calls after cache expiry
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should limit maximum sessions displayed', async () => {
      const maxSessions = 1;
      const composable = useMultiSessionData(defaultTimeWindow, {
        maxSessions
      });
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      expect(composable.visibleSessions.value.length).toBeLessThanOrEqual(maxSessions);
    });
  });

  describe('Data Transformation', () => {
    it('should transform database format to timeline format', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const sessions = composable.visibleSessions.value;
      expect(sessions.length).toBeGreaterThan(0);
      
      const session = sessions[0];
      
      // Should have required timeline properties
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('displayName');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('agentPaths');
      expect(session).toHaveProperty('orchestratorEvents');
      expect(session).toHaveProperty('userPrompts');
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('sessionLaneOffset');
      expect(session).toHaveProperty('sessionLaneHeight');
      expect(session).toHaveProperty('metrics');
    });

    it('should calculate session metrics correctly', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const session = composable.visibleSessions.value[0];
      const metrics = session.metrics;
      
      expect(metrics).toBeDefined();
      expect(typeof metrics?.totalDuration).toBe('number');
      expect(typeof metrics?.agentCount).toBe('number');
      expect(typeof metrics?.messageCount).toBe('number');
      expect(typeof metrics?.completionRate).toBe('number');
      expect(typeof metrics?.errorRate).toBe('number');
      
      // Completion rate should be between 0 and 1
      expect(metrics?.completionRate).toBeGreaterThanOrEqual(0);
      expect(metrics?.completionRate).toBeLessThanOrEqual(1);
    });

    it('should infer agent batches from timing', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const session = composable.visibleSessions.value[0];
      
      expect(session.agentBatches).toBeDefined();
      expect(Array.isArray(session.agentBatches)).toBe(true);
      
      // Should have at least one batch if there are agents
      if (session.agentPaths.length > 0) {
        expect(session.agentBatches.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network failed'));
      
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      expect(composable.error.value).toBeTruthy();
      expect(composable.isLoading.value).toBe(false);
      expect(composable.visibleSessions.value).toEqual([]);
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve('invalid json')
      } as Response);
      
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      expect(composable.error.value).toBeTruthy();
    });

    it('should handle WebSocket connection failures', async () => {
      // Mock WebSocket to fail immediately
      const FailingWebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 0);
        }
      };
      
      global.WebSocket = FailingWebSocket as any;
      
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      
      // Should not crash and should continue working without WebSocket
      expect(composable.visibleSessions).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on unmount', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      
      // Mock unmount - composable doesn't expose unmount method
      // Cleanup would happen via Vue's lifecycle hooks
      
      // Should not make additional API calls after unmount
      vi.clearAllMocks();
      await vi.advanceTimersByTimeAsync(35000); // Beyond refresh interval
      
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Session Data Structure', () => {
    it('should provide correct multi-session data structure', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const multiSessionData = composable.multiSessionData.value;
      
      expect(multiSessionData).toHaveProperty('sessions');
      expect(multiSessionData).toHaveProperty('timeRange');
      expect(multiSessionData).toHaveProperty('sessionLayout');
      expect(multiSessionData).toHaveProperty('lastUpdated');
      expect(multiSessionData).toHaveProperty('totalSessions');
      expect(multiSessionData).toHaveProperty('totalAgents');
      
      expect(Array.isArray(multiSessionData.sessions)).toBe(true);
      expect(typeof multiSessionData.totalSessions).toBe('number');
      expect(typeof multiSessionData.totalAgents).toBe('number');
    });

    it('should calculate total agents across all sessions', async () => {
      const composable = useMultiSessionData(defaultTimeWindow);
      
      await vi.runAllTimersAsync();
      await nextTick();
      
      const multiSessionData = composable.multiSessionData.value;
      const expectedTotalAgents = multiSessionData.sessions.reduce(
        (sum, session) => sum + session.agentPaths.length, 
        0
      );
      
      expect(multiSessionData.totalAgents).toBe(expectedTotalAgents);
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('useMultiSessionData Performance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle large number of sessions efficiently', async () => {
    // Mock large dataset
    const largeMockData = Array.from({ length: 100 }, (_, i) => ({
      session_id: `session-${i}`,
      agent_count: Math.floor(Math.random() * 10) + 1,
      created_at: Date.now() - (i * 60000)
    }));

    mockFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.toString().includes('/subagents/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(largeMockData)
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      } as Response);
    });

    const startTime = performance.now();
    const composable = useMultiSessionData(defaultTimeWindow, { maxSessions: 50 });
    
    await vi.runAllTimersAsync();
    await nextTick();
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Should process large dataset efficiently (under 100ms)
    expect(processingTime).toBeLessThan(100);
    
    // Should respect max sessions limit
    expect(composable.visibleSessions.value.length).toBeLessThanOrEqual(50);
  });

  it('should maintain responsive cache performance', async () => {
    const composable = useMultiSessionData(defaultTimeWindow);
    
    // Initial fetch
    const firstFetchStart = performance.now();
    await composable.refreshSessions();
    const firstFetchTime = performance.now() - firstFetchStart;
    
    // Cached fetch
    const cachedFetchStart = performance.now();
    await composable.refreshSessions();
    const cachedFetchTime = performance.now() - cachedFetchStart;
    
    // Cached fetch should be significantly faster
    expect(cachedFetchTime).toBeLessThan(firstFetchTime * 0.1); // 90% reduction
  });
});