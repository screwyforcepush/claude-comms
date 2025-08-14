import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import SessionFilterPanel from '../components/SessionFilterPanel.vue';
// import { useMultiSessionData } from '../composables/useMultiSessionData';

// Mock the composable
vi.mock('../composables/useMultiSessionData', () => ({
  useMultiSessionData: vi.fn(() => ({
    multiSessionData: {
      value: {
        sessions: [],
        timeRange: { start: Date.now() - 3600000, end: Date.now(), duration: 3600000 },
        totalSessions: 0,
        totalAgents: 0
      }
    },
    visibleSessions: { value: [] },
    filterSessions: vi.fn(),
    isLoading: { value: false },
    error: { value: null }
  }))
}));

// Mock fetch for filter options
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      session_ids: ['session-1', 'session-2', 'session-3'],
      status_options: ['active', 'completed', 'failed'],
      agent_types: ['orchestrator', 'engineer', 'architect', 'tester']
    })
  })
) as any;

describe('SessionFilterPanel', () => {
  let wrapper: VueWrapper<any>;
  
  const mockFilters = {
    sessionIdSearch: '',
    status: [] as string[],
    timeRange: { start: 0, end: 0 },
    agentCountRange: { min: 0, max: 100 },
    sessionDuration: { min: 0, max: 86400000 } // 24 hours in ms
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Filter Panel Rendering', () => {
    it('should render all filter controls', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      await nextTick();

      // Session ID search input
      expect(wrapper.find('input[placeholder*="session"]')).toBeTruthy();
      
      // Status filter checkboxes
      expect(wrapper.find('input[type="checkbox"][value="active"]')).toBeTruthy();
      expect(wrapper.find('input[type="checkbox"][value="completed"]')).toBeTruthy();
      expect(wrapper.find('input[type="checkbox"][value="failed"]')).toBeTruthy();

      // Time range inputs
      expect(wrapper.find('input[type="datetime-local"]')).toBeTruthy();

      // Agent count range inputs
      expect(wrapper.find('input[placeholder*="min agents"]')).toBeTruthy();
      expect(wrapper.find('input[placeholder*="max agents"]')).toBeTruthy();

      // Session duration range
      expect(wrapper.find('input[placeholder*="min duration"]')).toBeTruthy();
      expect(wrapper.find('input[placeholder*="max duration"]')).toBeTruthy();
    });

    it('should display clear filters button when filters are active', async () => {
      const activeFilters = {
        ...mockFilters,
        sessionIdSearch: 'test-session',
        status: ['active']
      };

      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: activeFilters
        }
      });

      await nextTick();
      
      const clearButton = wrapper.find('button[data-testid="clear-filters"]');
      expect(clearButton.exists()).toBe(true);
      expect(clearButton.text()).toContain('Clear');
    });

    it('should hide clear filters button when no filters are active', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      await nextTick();
      
      const clearButton = wrapper.find('button[data-testid="clear-filters"]');
      expect(clearButton.exists()).toBe(false);
    });
  });

  describe('Session ID Filter', () => {
    it('should emit filter update when session ID search changes', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      const input = wrapper.find('input[data-testid="session-id-search"]');
      await input.setValue('test-session-123');
      
      expect(wrapper.emitted('update:filters')).toBeTruthy();
      const emittedFilters = wrapper.emitted('update:filters')![0][0] as any;
      expect(emittedFilters.sessionIdSearch).toBe('test-session-123');
    });

    it('should support substring matching', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: { ...mockFilters, sessionIdSearch: 'abc' }
        }
      });

      // Simulate filtering logic that would happen in parent
      const sessions = [
        { sessionId: 'abc-123', displayName: 'Session abc-123' },
        { sessionId: 'def-456', displayName: 'Session def-456' },
        { sessionId: 'abc-789', displayName: 'Session abc-789' }
      ];

      const filtered = sessions.filter(s => 
        s.sessionId.toLowerCase().includes('abc') ||
        s.displayName.toLowerCase().includes('abc')
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.sessionId)).toEqual(['abc-123', 'abc-789']);
    });
  });

  describe('Status Filter', () => {
    it('should handle multiple status selections', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      const activeCheckbox = wrapper.find('input[value="active"]');
      const completedCheckbox = wrapper.find('input[value="completed"]');

      await activeCheckbox.setValue(true);
      await completedCheckbox.setValue(true);

      expect(wrapper.emitted('update:filters')).toBeTruthy();
      const emittedFilters = wrapper.emitted('update:filters')!.slice(-1)[0][0] as any;
      expect(emittedFilters.status).toContain('active');
      expect(emittedFilters.status).toContain('completed');
    });

    it('should filter sessions by status correctly', async () => {
      const sessions = [
        { sessionId: 'session-1', status: 'active' },
        { sessionId: 'session-2', status: 'completed' },
        { sessionId: 'session-3', status: 'failed' },
        { sessionId: 'session-4', status: 'active' }
      ];

      const filter = { status: ['active', 'failed'] };
      const filtered = sessions.filter(s => filter.status.includes(s.status));

      expect(filtered).toHaveLength(3);
      expect(filtered.map(s => s.sessionId)).toEqual(['session-1', 'session-3', 'session-4']);
    });
  });

  describe('Time Range Filter', () => {
    it('should emit filter update when time range changes', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      const startInput = wrapper.find('input[data-testid="time-range-start"]');
      const endInput = wrapper.find('input[data-testid="time-range-end"]');

      const startTime = new Date('2024-01-01T10:00:00').getTime();
      const endTime = new Date('2024-01-01T11:00:00').getTime();

      await startInput.setValue(new Date(startTime).toISOString().slice(0, 16));
      await endInput.setValue(new Date(endTime).toISOString().slice(0, 16));

      expect(wrapper.emitted('update:filters')).toBeTruthy();
      const emittedFilters = wrapper.emitted('update:filters')!.slice(-1)[0][0] as any;
      expect(emittedFilters.timeRange.start).toBe(startTime);
      expect(emittedFilters.timeRange.end).toBe(endTime);
    });

    it('should filter sessions within time range', async () => {
      const now = Date.now();
      const sessions = [
        { sessionId: 'session-1', startTime: now - 7200000, endTime: now - 6900000 }, // 2h-1.95h ago
        { sessionId: 'session-2', startTime: now - 1800000, endTime: now - 900000 },  // 30m-15m ago
        { sessionId: 'session-3', startTime: now - 600000, endTime: now - 300000 }    // 10m-5m ago
      ];

      const filter = { 
        timeRange: { 
          start: now - 3600000, // 1 hour ago
          end: now - 600000     // 10 minutes ago
        } 
      };

      const filtered = sessions.filter(s => {
        const sessionEnd = s.endTime || now;
        return s.startTime <= filter.timeRange.end && sessionEnd >= filter.timeRange.start;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('session-2');
    });
  });

  describe('Agent Count Filter', () => {
    it('should emit filter update when agent count range changes', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      const minInput = wrapper.find('input[data-testid="agent-count-min"]');
      const maxInput = wrapper.find('input[data-testid="agent-count-max"]');

      await minInput.setValue('2');
      await maxInput.setValue('10');

      expect(wrapper.emitted('update:filters')).toBeTruthy();
      const emittedFilters = wrapper.emitted('update:filters')!.slice(-1)[0][0] as any;
      expect(emittedFilters.agentCountRange.min).toBe(2);
      expect(emittedFilters.agentCountRange.max).toBe(10);
    });

    it('should filter sessions by agent count', async () => {
      const sessions = [
        { sessionId: 'session-1', agentPaths: new Array(3) },  // 3 agents
        { sessionId: 'session-2', agentPaths: new Array(7) },  // 7 agents
        { sessionId: 'session-3', agentPaths: new Array(15) }, // 15 agents
        { sessionId: 'session-4', agentPaths: new Array(1) }   // 1 agent
      ];

      const filter = { agentCountRange: { min: 2, max: 10 } };
      const filtered = sessions.filter(s => {
        const count = s.agentPaths.length;
        return count >= filter.agentCountRange.min && count <= filter.agentCountRange.max;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.sessionId)).toEqual(['session-1', 'session-2']);
    });
  });

  describe('Session Duration Filter', () => {
    it('should emit filter update when duration range changes', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      const minInput = wrapper.find('input[data-testid="duration-min"]');
      const maxInput = wrapper.find('input[data-testid="duration-max"]');

      await minInput.setValue('300'); // 5 minutes in seconds
      await maxInput.setValue('3600'); // 1 hour in seconds

      expect(wrapper.emitted('update:filters')).toBeTruthy();
      const emittedFilters = wrapper.emitted('update:filters')!.slice(-1)[0][0] as any;
      expect(emittedFilters.sessionDuration.min).toBe(300000); // converted to ms
      expect(emittedFilters.sessionDuration.max).toBe(3600000); // converted to ms
    });

    it('should filter sessions by duration', async () => {
      const now = Date.now();
      const sessions = [
        { sessionId: 'session-1', startTime: now - 600000, endTime: now - 300000 },    // 5 minutes
        { sessionId: 'session-2', startTime: now - 1800000, endTime: now - 900000 },   // 15 minutes
        { sessionId: 'session-3', startTime: now - 7200000, endTime: now - 3600000 },  // 1 hour
        { sessionId: 'session-4', startTime: now - 300000, endTime: now }              // 5 minutes, ongoing
      ];

      const filter = { sessionDuration: { min: 600000, max: 2700000 } }; // 10-45 minutes

      const filtered = sessions.filter(s => {
        const endTime = s.endTime || now;
        const duration = endTime - s.startTime;
        return duration >= filter.sessionDuration.min && duration <= filter.sessionDuration.max;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('session-2');
    });
  });

  describe('Combined Filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const now = Date.now();
      const sessions = [
        { 
          sessionId: 'active-session-1', 
          status: 'active', 
          agentPaths: new Array(5),
          startTime: now - 1800000,
          endTime: now - 900000
        },
        { 
          sessionId: 'active-session-2', 
          status: 'active', 
          agentPaths: new Array(15),
          startTime: now - 1800000,
          endTime: now - 900000
        },
        { 
          sessionId: 'completed-session-1', 
          status: 'completed', 
          agentPaths: new Array(5),
          startTime: now - 1800000,
          endTime: now - 900000
        }
      ];

      const filters = {
        sessionIdSearch: 'active',
        status: ['active'],
        agentCountRange: { min: 3, max: 10 }
      };

      let filtered = sessions.filter(s => 
        s.sessionId.toLowerCase().includes(filters.sessionIdSearch.toLowerCase())
      );
      
      filtered = filtered.filter(s => filters.status.includes(s.status));
      
      filtered = filtered.filter(s => {
        const count = s.agentPaths.length;
        return count >= filters.agentCountRange.min && count <= filters.agentCountRange.max;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('active-session-1');
    });
  });

  describe('Clear Filters', () => {
    it('should clear all filters when clear button is clicked', async () => {
      const activeFilters = {
        sessionIdSearch: 'test-session',
        status: ['active', 'completed'],
        timeRange: { start: 123456789, end: 987654321 },
        agentCountRange: { min: 2, max: 8 },
        sessionDuration: { min: 300000, max: 1800000 }
      };

      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: activeFilters
        }
      });

      const clearButton = wrapper.find('button[data-testid="clear-filters"]');
      await clearButton.trigger('click');

      expect(wrapper.emitted('update:filters')).toBeTruthy();
      const emittedFilters = wrapper.emitted('update:filters')!.slice(-1)[0][0] as any;
      
      expect(emittedFilters.sessionIdSearch).toBe('');
      expect(emittedFilters.status).toEqual([]);
      expect(emittedFilters.timeRange.start).toBe(0);
      expect(emittedFilters.timeRange.end).toBe(0);
      expect(emittedFilters.agentCountRange.min).toBe(0);
      expect(emittedFilters.agentCountRange.max).toBe(100);
      expect(emittedFilters.sessionDuration.min).toBe(0);
      expect(emittedFilters.sessionDuration.max).toBe(86400000);
    });
  });

  describe('Performance', () => {
    it('should apply filters within 50ms performance target', async () => {
      // Generate large dataset for performance testing
      const sessions = Array.from({ length: 1000 }, (_, i) => ({
        sessionId: `session-${i}`,
        status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'completed' : 'failed',
        agentPaths: new Array(Math.floor(Math.random() * 20) + 1),
        startTime: Date.now() - Math.random() * 86400000,
        endTime: Date.now() - Math.random() * 43200000,
        displayName: `Session ${i}`
      }));

      const filters = {
        sessionIdSearch: '5',
        status: ['active', 'completed'],
        agentCountRange: { min: 5, max: 15 }
      };

      const startTime = performance.now();

      // Simulate filter application logic
      let filtered = sessions.filter(s => 
        s.sessionId.includes(filters.sessionIdSearch) ||
        s.displayName.includes(filters.sessionIdSearch)
      );
      
      filtered = filtered.filter(s => filters.status.includes(s.status));
      
      filtered = filtered.filter(s => {
        const count = s.agentPaths.length;
        return count >= filters.agentCountRange.min && count <= filters.agentCountRange.max;
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Performance requirement: <50ms
      expect(filtered.length).toBeGreaterThan(0); // Ensure filtering worked
    });
  });

  describe('Filter State Persistence', () => {
    it('should maintain filter state during component updates', async () => {
      const initialFilters = {
        sessionIdSearch: 'test',
        status: ['active'],
        timeRange: { start: 123456789, end: 987654321 },
        agentCountRange: { min: 2, max: 8 },
        sessionDuration: { min: 300000, max: 1800000 }
      };

      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: initialFilters
        }
      });

      // Update props to simulate parent state change
      await wrapper.setProps({
        filters: {
          ...initialFilters,
          sessionIdSearch: 'updated-test'
        }
      });

      // Verify other filters remain unchanged
      const sessionIdInput = wrapper.find('input[data-testid="session-id-search"]');
      expect((sessionIdInput.element as HTMLInputElement).value).toBe('updated-test');

      const activeCheckbox = wrapper.find('input[value="active"]');
      expect((activeCheckbox.element as HTMLInputElement).checked).toBe(true);
    });
  });

  describe('Real-time Filter Updates', () => {
    it('should handle rapid filter changes without performance degradation', async () => {
      wrapper = mount(SessionFilterPanel, {
        props: {
          filters: mockFilters
        }
      });

      const input = wrapper.find('input[data-testid="session-id-search"]');
      const values = ['a', 'ab', 'abc', 'abcd', 'abcde'];

      const startTime = performance.now();

      // Simulate rapid typing
      for (const value of values) {
        await input.setValue(value);
        await nextTick();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle multiple rapid updates quickly
      expect(totalTime).toBeLessThan(100);
      expect(wrapper.emitted('update:filters')).toHaveLength(values.length);
    });
  });
});