/**
 * Multi-Session Data Transformation Tests
 * TestTiger - Client-side data fetching and transformation testing
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
// import { nextTick } from 'vue';
import type { 
  SessionTimelineData,
  MultiSessionTimelineData,
  SessionTimeWindow,
  SessionFilter,
  SessionMetrics
} from '../types/multi-session';

// Mock fetch for API testing
global.fetch = vi.fn();
const mockFetch = global.fetch as Mock;

// Mock WebSocket for real-time updates
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.CONNECTING
})) as any;

describe('Multi-Session Data Management', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Session Data Fetching', () => {
    it('should fetch sessions list successfully', async () => {
      const mockSessions = [
        {
          session_id: 'session-001',
          agent_count: 5,
          created_at: Date.now() - 3600000
        },
        {
          session_id: 'session-002', 
          agent_count: 3,
          created_at: Date.now() - 7200000
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions
      });

      // Simulate composable function
      const fetchSessions = async () => {
        const response = await fetch('/subagents/sessions');
        if (!response.ok) throw new Error('Failed to fetch sessions');
        return response.json();
      };

      const result = await fetchSessions();
      
      expect(mockFetch).toHaveBeenCalledWith('/subagents/sessions');
      expect(result).toEqual(mockSessions);
      expect(result).toHaveLength(2);
      expect(result[0].session_id).toBe('session-001');
      expect(result[0].agent_count).toBe(5);
    });

    it('should fetch session details successfully', async () => {
      const sessionId = 'detailed-session-001';
      const mockAgents = [
        {
          id: 1,
          name: 'Engineer1',
          subagent_type: 'engineer',
          session_id: sessionId,
          created_at: Date.now() - 1800000,
          completed_at: Date.now() - 600000,
          status: 'completed',
          total_duration_ms: 1200000,
          total_tokens: 2500
        },
        {
          id: 2,
          name: 'Tester1',
          subagent_type: 'tester',
          session_id: sessionId,
          created_at: Date.now() - 1700000,
          completed_at: null,
          status: 'active',
          total_duration_ms: null,
          total_tokens: 800
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgents
      });

      const fetchSessionDetails = async (id: string) => {
        const response = await fetch(`/subagents/${id}`);
        if (!response.ok) throw new Error(`Failed to fetch session ${id}`);
        return response.json();
      };

      const result = await fetchSessionDetails(sessionId);
      
      expect(mockFetch).toHaveBeenCalledWith(`/subagents/${sessionId}`);
      expect(result).toEqual(mockAgents);
      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('active');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const fetchWithErrorHandling = async () => {
        try {
          const response = await fetch('/subagents/sessions');
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return await response.json();
        } catch (error) {
          console.error('API Error:', error);
          return [];
        }
      };

      const result = await fetchWithErrorHandling();
      
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith('/subagents/sessions');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const fetchWithNetworkErrorHandling = async () => {
        try {
          const response = await fetch('/subagents/sessions');
          return await response.json();
        } catch (error) {
          console.error('Network Error:', error);
          return { error: 'Network unavailable' };
        }
      };

      const result = await fetchWithNetworkErrorHandling();
      
      expect(result).toEqual({ error: 'Network unavailable' });
    });
  });

  describe('Session Data Transformation', () => {
    it('should transform raw agent data to SessionTimelineData', () => {
      const rawAgents = [
        {
          id: 1,
          name: 'Engineer1',
          subagent_type: 'engineer',
          session_id: 'transform-test',
          created_at: 1700000000000,
          completed_at: 1700001800000,
          status: 'completed',
          total_duration_ms: 1800000,
          total_tokens: 3000,
          input_tokens: 1200,
          output_tokens: 1800
        }
      ];

      const transformToSessionData = (sessionId: string, agents: any[]): SessionTimelineData => {
        const startTime = Math.min(...agents.map(a => a.created_at));
        const endTime = Math.max(...agents.map(a => a.completed_at || Date.now()));
        
        const agentPaths = agents.map((agent, index) => ({
          agentId: agent.id,
          name: agent.name,
          type: agent.subagent_type as any,
          startTime: agent.created_at,
          endTime: agent.completed_at,
          status: agent.status as any,
          curveData: [], // Would be populated from events
          laneIndex: index,
          batchId: 'default-batch',
          messages: [],
          sessionId,
          metrics: {
            duration: agent.total_duration_ms || 0,
            tokenCount: agent.total_tokens || 0,
            toolUseCount: 0,
            messageCount: 0,
            completionRate: agent.status === 'completed' ? 1 : 0
          }
        }));

        const metrics: SessionMetrics = {
          totalDuration: endTime - startTime,
          agentCount: agents.length,
          messageCount: 0, // Would be calculated from messages
          batchCount: 0, // Would be calculated from batches
          averageAgentDuration: agents.reduce((sum, a) => sum + (a.total_duration_ms || 0), 0) / agents.length,
          completionRate: agents.filter(a => a.status === 'completed').length / agents.length,
          errorRate: agents.filter(a => a.status === 'failed').length / agents.length
        };

        return {
          sessionId,
          displayName: `Session ${sessionId}`,
          startTime,
          endTime,
          status: 'completed',
          orchestratorEvents: [],
          userPrompts: [],
          agentBatches: [],
          agentPaths,
          messages: [],
          sessionLaneOffset: 0,
          sessionLaneHeight: 120,
          metrics
        };
      };

      const result = transformToSessionData('transform-test', rawAgents);
      
      expect(result.sessionId).toBe('transform-test');
      expect(result.agentPaths).toHaveLength(1);
      expect(result.agentPaths[0].name).toBe('Engineer1');
      expect(result.agentPaths[0].type).toBe('engineer');
      expect(result.metrics?.agentCount).toBe(1);
      expect(result.metrics?.completionRate).toBe(1);
      expect(result.status).toBe('completed');
    });

    it('should calculate session metrics correctly', () => {
      const agents = [
        { status: 'completed', total_duration_ms: 30000 },
        { status: 'completed', total_duration_ms: 45000 },
        { status: 'failed', total_duration_ms: 15000 },
        { status: 'active', total_duration_ms: null }
      ];

      const calculateMetrics = (agents: any[]): SessionMetrics => {
        const completedAgents = agents.filter(a => a.total_duration_ms !== null);
        const avgDuration = completedAgents.length > 0 
          ? completedAgents.reduce((sum, a) => sum + a.total_duration_ms, 0) / completedAgents.length 
          : 0;

        return {
          totalDuration: 3600000, // Mock total session duration
          agentCount: agents.length,
          messageCount: 0,
          batchCount: 0,
          averageAgentDuration: avgDuration,
          completionRate: agents.filter(a => a.status === 'completed').length / agents.length,
          errorRate: agents.filter(a => a.status === 'failed').length / agents.length
        };
      };

      const metrics = calculateMetrics(agents);
      
      expect(metrics.agentCount).toBe(4);
      expect(metrics.completionRate).toBe(0.5); // 2/4 completed
      expect(metrics.errorRate).toBe(0.25); // 1/4 failed
      expect(metrics.averageAgentDuration).toBe(30000); // (30000 + 45000 + 15000) / 3
    });

    it('should transform multiple sessions to MultiSessionTimelineData', () => {
      const rawSessionsData = [
        {
          sessionId: 'session-1',
          agents: [{ name: 'A1', created_at: 1700000000000, completed_at: 1700003600000 }]
        },
        {
          sessionId: 'session-2', 
          agents: [{ name: 'B1', created_at: 1700007200000, completed_at: null }]
        }
      ];

      const transformToMultiSession = (sessionsData: any[]): MultiSessionTimelineData => {
        const sessions: SessionTimelineData[] = sessionsData.map((data, index) => ({
          sessionId: data.sessionId,
          displayName: `Session ${data.sessionId}`,
          startTime: Math.min(...data.agents.map((a: any) => a.created_at)),
          endTime: Math.max(...data.agents.map((a: any) => a.completed_at || Date.now())),
          status: 'active',
          orchestratorEvents: [],
          userPrompts: [],
          agentBatches: [],
          agentPaths: data.agents.map((agent: any) => ({
            agentId: 1,
            agentName: agent.name,
            agentType: 'engineer',
            startTime: agent.created_at,
            endTime: agent.completed_at,
            status: agent.completed_at ? 'completed' : 'active',
            path: [],
            metadata: {}
          })),
          messages: [],
          sessionLaneOffset: index * 120,
          sessionLaneHeight: 120
        }));

        const allTimes = sessions.flatMap(s => [s.startTime, s.endTime].filter(t => typeof t === 'number'));
        const minTime = allTimes.length > 0 ? Math.min(...allTimes) : Date.now();
        const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : Date.now();
        const timeRange = {
          start: minTime,
          end: maxTime,
          duration: maxTime - minTime,
          pixelsPerMs: 0.01 // Default pixels per millisecond
        };

        return {
          sessions,
          timeRange,
          sessionLayout: 'swim_lanes',
          lastUpdated: Date.now(),
          totalSessions: sessions.length,
          totalAgents: sessions.reduce((sum, s) => sum + s.agentPaths.length, 0)
        };
      };

      const result = transformToMultiSession(rawSessionsData);
      
      expect(result.sessions).toHaveLength(2);
      expect(result.totalSessions).toBe(2);
      expect(result.totalAgents).toBe(2);
      expect(result.sessionLayout).toBe('swim_lanes');
      expect(result.sessions[0].sessionLaneOffset).toBe(0);
      expect(result.sessions[1].sessionLaneOffset).toBe(120);
    });
  });

  describe('Time Window Management', () => {
    it('should filter sessions by time window', () => {
      const now = Date.now();
      const sessions: SessionTimelineData[] = [
        {
          sessionId: 'recent',
          startTime: now - 1800000, // 30 min ago
          endTime: now - 900000, // 15 min ago
        } as SessionTimelineData,
        {
          sessionId: 'old',
          startTime: now - 7200000, // 2 hours ago
          endTime: now - 5400000, // 1.5 hours ago
        } as SessionTimelineData,
        {
          sessionId: 'active',
          startTime: now - 600000, // 10 min ago
          endTime: undefined, // Still active
        } as SessionTimelineData
      ];

      const timeWindow: SessionTimeWindow = {
        start: now - 3600000, // 1 hour ago
        end: now,
        duration: 3600000,
        label: '1 hour'
      };

      const filterSessionsByTimeWindow = (sessions: SessionTimelineData[], window: SessionTimeWindow) => {
        return sessions.filter(session => {
          const sessionEnd = session.endTime || Date.now();
          // Session overlaps with time window if it starts before window ends and ends after window starts
          return session.startTime < window.end && sessionEnd > window.start;
        });
      };

      const filtered = filterSessionsByTimeWindow(sessions, timeWindow);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.sessionId)).toEqual(['recent', 'active']);
    });

    it('should handle different time window presets', () => {
      const now = Date.now();
      const timeWindows = [
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
        }
      ];

      const validateTimeWindow = (window: SessionTimeWindow) => {
        expect(window.start).toBeLessThan(window.end);
        expect(window.duration).toBe(window.end - window.start);
        expect(window.label).toBeDefined();
        expect(window.start).toBeGreaterThan(0);
      };

      timeWindows.forEach(validateTimeWindow);
    });

    it('should auto-include active sessions in time window', () => {
      const now = Date.now();
      const sessions: SessionTimelineData[] = [
        {
          sessionId: 'old-completed',
          startTime: now - 7200000, // 2 hours ago
          endTime: now - 5400000, // 1.5 hours ago
          status: 'completed'
        } as SessionTimelineData,
        {
          sessionId: 'old-active',
          startTime: now - 7200000, // 2 hours ago
          endTime: undefined, // Still active
          status: 'active'
        } as SessionTimelineData
      ];

      const timeWindow: SessionTimeWindow = {
        start: now - 3600000, // 1 hour ago
        end: now,
        duration: 3600000,
        label: '1 hour'
      };

      const filterWithActiveInclusion = (sessions: SessionTimelineData[], window: SessionTimeWindow) => {
        return sessions.filter(session => {
          // Always include active sessions regardless of start time
          if (session.status === 'active') {
            return true;
          }
          
          // For completed sessions, check time overlap
          const sessionEnd = session.endTime || Date.now();
          return session.startTime < window.end && sessionEnd > window.start;
        });
      };

      const filtered = filterWithActiveInclusion(sessions, timeWindow);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('old-active');
    });
  });

  describe('Session Filtering', () => {
    it('should filter sessions by ID pattern', () => {
      const sessions: SessionTimelineData[] = [
        { sessionId: 'project-alpha-001' } as SessionTimelineData,
        { sessionId: 'project-beta-002' } as SessionTimelineData,
        { sessionId: 'test-session-003' } as SessionTimelineData,
        { sessionId: 'project-alpha-004' } as SessionTimelineData
      ];

      const filter: SessionFilter = {
        searchQuery: 'alpha'
      };

      const applyFilter = (sessions: SessionTimelineData[], filter: SessionFilter) => {
        let filtered = sessions;

        if (filter.searchQuery) {
          filtered = filtered.filter(session => 
            session.sessionId.toLowerCase().includes(filter.searchQuery!.toLowerCase()) ||
            session.displayName?.toLowerCase().includes(filter.searchQuery!.toLowerCase())
          );
        }

        if (filter.sessionIds && filter.sessionIds.length > 0) {
          filtered = filtered.filter(session => 
            filter.sessionIds!.includes(session.sessionId)
          );
        }

        if (filter.status && filter.status.length > 0) {
          filtered = filtered.filter(session => 
            filter.status!.includes(session.status)
          );
        }

        if (filter.agentCountRange) {
          filtered = filtered.filter(session => {
            const agentCount = session.agentPaths.length;
            return agentCount >= filter.agentCountRange!.min && 
                   agentCount <= filter.agentCountRange!.max;
          });
        }

        return filtered;
      };

      const filtered = applyFilter(sessions, filter);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.sessionId.includes('alpha'))).toBe(true);
    });

    it('should filter sessions by status', () => {
      const sessions: SessionTimelineData[] = [
        { sessionId: 's1', status: 'active' } as SessionTimelineData,
        { sessionId: 's2', status: 'completed' } as SessionTimelineData,
        { sessionId: 's3', status: 'failed' } as SessionTimelineData,
        { sessionId: 's4', status: 'active' } as SessionTimelineData
      ];

      const filter: SessionFilter = {
        status: ['active', 'failed']
      };

      const applyStatusFilter = (sessions: SessionTimelineData[], statuses: string[]) => {
        return sessions.filter(session => statuses.includes(session.status));
      };

      const filtered = applyStatusFilter(sessions, filter.status!);
      
      expect(filtered).toHaveLength(3);
      expect(filtered.map(s => s.sessionId)).toEqual(['s1', 's3', 's4']);
    });

    it('should filter sessions by agent count range', () => {
      const sessions: SessionTimelineData[] = [
        { sessionId: 's1', agentPaths: new Array(2) } as SessionTimelineData,
        { sessionId: 's2', agentPaths: new Array(5) } as SessionTimelineData,
        { sessionId: 's3', agentPaths: new Array(8) } as SessionTimelineData,
        { sessionId: 's4', agentPaths: new Array(12) } as SessionTimelineData
      ];

      const filter: SessionFilter = {
        agentCountRange: { min: 3, max: 10 }
      };

      const applyAgentCountFilter = (sessions: SessionTimelineData[], range: { min: number; max: number }) => {
        return sessions.filter(session => {
          const count = session.agentPaths.length;
          return count >= range.min && count <= range.max;
        });
      };

      const filtered = applyAgentCountFilter(sessions, filter.agentCountRange!);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.sessionId)).toEqual(['s2', 's3']);
    });

    it('should combine multiple filters correctly', () => {
      const sessions: SessionTimelineData[] = [
        { 
          sessionId: 'active-small',
          status: 'active',
          agentPaths: new Array(3),
          startTime: Date.now() - 1800000
        } as SessionTimelineData,
        { 
          sessionId: 'completed-large', 
          status: 'completed',
          agentPaths: new Array(8),
          startTime: Date.now() - 3600000
        } as SessionTimelineData,
        { 
          sessionId: 'active-large',
          status: 'active', 
          agentPaths: new Array(6),
          startTime: Date.now() - 900000
        } as SessionTimelineData
      ];

      const filter: SessionFilter = {
        status: ['active'],
        agentCountRange: { min: 5, max: 10 },
        timeRange: { start: Date.now() - 1200000, end: Date.now() }
      };

      const applyCombinedFilter = (sessions: SessionTimelineData[], filter: SessionFilter) => {
        return sessions.filter(session => {
          // Status filter
          if (filter.status && !filter.status.includes(session.status)) {
            return false;
          }

          // Agent count filter
          if (filter.agentCountRange) {
            const count = session.agentPaths.length;
            if (count < filter.agentCountRange.min || count > filter.agentCountRange.max) {
              return false;
            }
          }

          // Time range filter
          if (filter.timeRange) {
            if (session.startTime < filter.timeRange.start || session.startTime > filter.timeRange.end) {
              return false;
            }
          }

          return true;
        });
      };

      const filtered = applyCombinedFilter(sessions, filter);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('active-large');
    });
  });

  describe('Caching Behavior', () => {
    it('should cache session data to avoid redundant API calls', async () => {
      const mockData = [{ session_id: 'cached-session', agent_count: 3 }];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      // Simulate caching mechanism
      let cache: any = null;
      let cacheTimestamp = 0;
      const cacheTimeout = 30000; // 30 seconds

      const fetchWithCache = async () => {
        const now = Date.now();
        
        if (cache && (now - cacheTimestamp) < cacheTimeout) {
          return cache;
        }

        const response = await fetch('/subagents/sessions');
        if (!response.ok) throw new Error('Failed to fetch');
        
        cache = await response.json();
        cacheTimestamp = now;
        return cache;
      };

      // First call - should hit API
      const result1 = await fetchWithCache();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockData);

      // Second call within cache timeout - should use cache
      const result2 = await fetchWithCache();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call
      expect(result2).toEqual(mockData);

      // Simulate cache expiry
      cacheTimestamp = Date.now() - (cacheTimeout + 1000);
      
      // Third call after cache expiry - should hit API again
      const result3 = await fetchWithCache();
      expect(mockFetch).toHaveBeenCalledTimes(2); // New API call
      expect(result3).toEqual(mockData);
    });

    it('should invalidate cache on data mutations', async () => {
      let cache: any = null;
      let cacheValid = true;

      const fetchWithInvalidation = async () => {
        if (cache && cacheValid) {
          return cache;
        }

        const response = await fetch('/subagents/sessions');
        cache = await response.json();
        cacheValid = true;
        return cache;
      };

      const invalidateCache = () => {
        cacheValid = false;
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ session_id: 'test', agent_count: 1 }]
      });

      // First fetch
      await fetchWithInvalidation();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cache invalidation (simulate new agent registration)
      invalidateCache();

      // Next fetch should hit API again
      await fetchWithInvalidation();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ session_id: 'retry-success', agent_count: 1 }]
        });
      });

      const fetchWithRetry = async (maxRetries = 3, baseDelay = 100) => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch('/subagents/sessions');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          } catch (error) {
            if (attempt === maxRetries) throw error;
            
            // Exponential backoff
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };

      const result = await fetchWithRetry();
      
      expect(callCount).toBe(3);
      expect(result).toEqual([{ session_id: 'retry-success', agent_count: 1 }]);
    });

    it('should provide fallback data when all retries fail', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const fetchWithFallback = async () => {
        try {
          const response = await fetch('/subagents/sessions');
          return await response.json();
        } catch (error) {
          console.error('API unavailable, using fallback data');
          return []; // Empty fallback
        }
      };

      const result = await fetchWithFallback();
      
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Validation', () => {
    it('should validate session data structure', () => {
      const validSession: SessionTimelineData = {
        sessionId: 'valid-session',
        displayName: 'Valid Session',
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        status: 'completed',
        orchestratorEvents: [],
        userPrompts: [],
        agentBatches: [],
        agentPaths: [],
        messages: [],
        sessionLaneOffset: 0,
        sessionLaneHeight: 120
      };

      const invalidSession = {
        sessionId: 'invalid-session'
        // Missing required fields
      };

      const validateSessionData = (session: any): session is SessionTimelineData => {
        return (
          typeof session.sessionId === 'string' &&
          typeof session.startTime === 'number' &&
          ['active', 'completed', 'failed', 'pending'].includes(session.status) &&
          Array.isArray(session.agentPaths) &&
          Array.isArray(session.messages)
        );
      };

      expect(validateSessionData(validSession)).toBe(true);
      expect(validateSessionData(invalidSession)).toBe(false);
    });

    it('should sanitize and validate input data', () => {
      const rawApiData = [
        {
          session_id: 'test-session',
          agent_count: '5', // String instead of number
          created_at: 1700000000000,
          extra_field: 'should be ignored'
        },
        {
          session_id: null, // Invalid session ID
          agent_count: -1, // Invalid agent count
          created_at: 'invalid-date'
        }
      ];

      const sanitizeSessionSummary = (data: any) => {
        if (!data.session_id || typeof data.session_id !== 'string') {
          return null;
        }

        const agentCount = parseInt(data.agent_count);
        if (isNaN(agentCount) || agentCount < 0) {
          return null;
        }

        const createdAt = typeof data.created_at === 'number' 
          ? data.created_at 
          : Date.parse(data.created_at);
        
        if (isNaN(createdAt)) {
          return null;
        }

        return {
          session_id: data.session_id,
          agent_count: agentCount,
          created_at: createdAt
        };
      };

      const sanitized = rawApiData
        .map(sanitizeSessionSummary)
        .filter(Boolean);

      expect(sanitized).toHaveLength(1);
      expect(sanitized[0]).toEqual({
        session_id: 'test-session',
        agent_count: 5,
        created_at: 1700000000000
      });
    });
  });
});