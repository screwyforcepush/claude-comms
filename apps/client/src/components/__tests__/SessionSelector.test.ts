import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SessionSelector from '../SessionSelector.vue';
import type { Session } from '../../types';

// Mock data
const mockSessions: Session[] = [
  {
    session_id: 'session-1',
    created_at: '2025-08-20T10:00:00Z',
    agent_count: 5,
  },
  {
    session_id: 'session-2-long-name',
    created_at: '2025-08-20T11:30:00Z',
    agent_count: 3,
  },
  {
    session_id: 'test-session-alpha',
    created_at: '2025-08-20T09:15:00Z',
    agent_count: 8,
  },
  {
    session_id: 'beta-session',
    created_at: '2025-08-20T12:45:00Z',
    agent_count: 1,
  },
];

describe('SessionSelector', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(SessionSelector, {
      props: {
        sessions: mockSessions,
        selectedSessionId: '',
        loading: false,
        error: null,
      },
    });
  });

  describe('Component Structure', () => {
    it('renders the session selector component', () => {
      expect(wrapper.find('[data-testid="session-selector"]').exists()).toBe(true);
    });

    it('displays search input field', () => {
      expect(wrapper.find('[data-testid="session-search"]').exists()).toBe(true);
    });

    it('displays session list container', () => {
      expect(wrapper.find('[data-testid="session-list"]').exists()).toBe(true);
    });

    it('displays refresh button', () => {
      expect(wrapper.find('[data-testid="refresh-sessions"]').exists()).toBe(true);
    });
  });

  describe('Session Display', () => {
    it('displays all sessions when no search filter', () => {
      const sessionItems = wrapper.findAll('[data-testid^="session-item-"]');
      expect(sessionItems).toHaveLength(mockSessions.length);
    });

    it('displays session metadata correctly', () => {
      const firstSession = wrapper.find('[data-testid="session-item-session-1"]');
      expect(firstSession.text()).toContain('session-1');
      expect(firstSession.text()).toContain('5 agents');
      expect(firstSession.text()).toContain('10:00');
    });

    it('shows most recent sessions first', () => {
      const sessionItems = wrapper.findAll('[data-testid^="session-item-"]');
      // beta-session is most recent (12:45)
      expect(sessionItems[0].attributes('data-testid')).toBe('session-item-beta-session');
    });

    it('displays empty state when no sessions', async () => {
      await wrapper.setProps({ sessions: [] });
      expect(wrapper.find('[data-testid="empty-sessions"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('No sessions found');
    });
  });

  describe('Search Functionality', () => {
    it('filters sessions by session ID', async () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      await searchInput.setValue('alpha');
      await nextTick();

      const visibleSessions = wrapper.findAll('[data-testid^="session-item-"]:not(.hidden)');
      expect(visibleSessions).toHaveLength(1);
      expect(visibleSessions[0].attributes('data-testid')).toBe('session-item-test-session-alpha');
    });

    it('filters sessions case-insensitively', async () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      await searchInput.setValue('BETA');
      await nextTick();

      const visibleSessions = wrapper.findAll('[data-testid^="session-item-"]:not(.hidden)');
      expect(visibleSessions).toHaveLength(1);
      expect(visibleSessions[0].attributes('data-testid')).toBe('session-item-beta-session');
    });

    it('shows no results message when search returns empty', async () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      await searchInput.setValue('nonexistent');
      await nextTick();

      expect(wrapper.find('[data-testid="no-search-results"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('No sessions match your search');
    });

    it('clears search filter correctly', async () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      await searchInput.setValue('alpha');
      await nextTick();

      let visibleSessions = wrapper.findAll('[data-testid^="session-item-"]:not(.hidden)');
      expect(visibleSessions).toHaveLength(1);

      await searchInput.setValue('');
      await nextTick();

      visibleSessions = wrapper.findAll('[data-testid^="session-item-"]:not(.hidden)');
      expect(visibleSessions).toHaveLength(mockSessions.length);
    });
  });

  describe('Session Selection', () => {
    it('emits session-selected event when session is clicked', async () => {
      const sessionItem = wrapper.find('[data-testid="session-item-session-1"]');
      await sessionItem.trigger('click');

      expect(wrapper.emitted('session-selected')).toBeTruthy();
      expect(wrapper.emitted('session-selected')[0][0]).toBe('session-1');
    });

    it('highlights selected session', async () => {
      await wrapper.setProps({ selectedSessionId: 'session-1' });
      
      const selectedSession = wrapper.find('[data-testid="session-item-session-1"]');
      expect(selectedSession.classes()).toContain('bg-blue-600');
    });

    it('keyboard navigation works correctly', async () => {
      const sessionList = wrapper.find('[data-testid="session-list"]');
      
      // Press arrow down
      await sessionList.trigger('keydown', { key: 'ArrowDown' });
      await nextTick();
      
      // First session should be focused
      expect(wrapper.find('[data-testid="session-item-beta-session"]').classes()).toContain('ring-2');
    });

    it('supports Enter key to select focused session', async () => {
      const sessionList = wrapper.find('[data-testid="session-list"]');
      
      // Focus first session and press Enter
      await sessionList.trigger('keydown', { key: 'ArrowDown' });
      await sessionList.trigger('keydown', { key: 'Enter' });
      
      expect(wrapper.emitted('session-selected')).toBeTruthy();
      expect(wrapper.emitted('session-selected')[0][0]).toBe('beta-session');
    });
  });

  describe('Loading and Error States', () => {
    it('displays loading state correctly', async () => {
      await wrapper.setProps({ loading: true });
      
      expect(wrapper.find('[data-testid="loading-sessions"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Loading sessions...');
    });

    it('displays error state correctly', async () => {
      await wrapper.setProps({ error: 'Failed to load sessions' });
      
      expect(wrapper.find('[data-testid="error-sessions"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Failed to load sessions');
    });

    it('disables interactions during loading', async () => {
      await wrapper.setProps({ loading: true });
      
      const searchInput = wrapper.find('[data-testid="session-search"]');
      const refreshButton = wrapper.find('[data-testid="refresh-sessions"]');
      
      expect(searchInput.attributes('disabled')).toBeDefined();
      expect(refreshButton.attributes('disabled')).toBeDefined();
    });
  });

  describe('Refresh Functionality', () => {
    it('emits refresh-sessions event when refresh button clicked', async () => {
      const refreshButton = wrapper.find('[data-testid="refresh-sessions"]');
      await refreshButton.trigger('click');

      expect(wrapper.emitted('refresh-sessions')).toBeTruthy();
    });

    it('disables refresh button during loading', async () => {
      await wrapper.setProps({ loading: true });
      
      const refreshButton = wrapper.find('[data-testid="refresh-sessions"]');
      expect(refreshButton.attributes('disabled')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      const sessionList = wrapper.find('[data-testid="session-list"]');
      
      expect(searchInput.attributes('aria-label')).toBeDefined();
      expect(sessionList.attributes('role')).toBe('listbox');
    });

    it('sessions have proper ARIA attributes', () => {
      const sessionItem = wrapper.find('[data-testid="session-item-session-1"]');
      
      expect(sessionItem.attributes('role')).toBe('option');
      expect(sessionItem.attributes('tabindex')).toBeDefined();
    });

    it('supports screen reader announcements', async () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      await searchInput.setValue('alpha');
      await nextTick();

      expect(wrapper.find('[data-testid="search-results-announcement"]').exists()).toBe(true);
    });
  });

  describe('Responsive Design', () => {
    it('applies mobile-specific classes', () => {
      expect(wrapper.find('.mobile\\:flex-col').exists()).toBe(true);
    });

    it('adjusts layout for small screens', () => {
      // Test that mobile classes are applied correctly
      const container = wrapper.find('[data-testid="session-selector"]');
      expect(container.classes()).toContain('flex-col');
    });
  });

  describe('Performance', () => {
    it('handles large session lists efficiently', async () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        session_id: `session-${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        agent_count: Math.floor(Math.random() * 10) + 1,
      }));

      await wrapper.setProps({ sessions: largeSessions });
      
      // Component should still render without significant delay
      const sessionItems = wrapper.findAll('[data-testid^="session-item-"]');
      expect(sessionItems.length).toBeGreaterThan(0);
    });

    it('debounces search input correctly', async () => {
      const searchInput = wrapper.find('[data-testid="session-search"]');
      
      // Rapid typing should be debounced
      await searchInput.setValue('a');
      await searchInput.setValue('al');
      await searchInput.setValue('alp');
      await searchInput.setValue('alpha');
      
      // Only final search should be applied
      await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
      await nextTick();
      
      const visibleSessions = wrapper.findAll('[data-testid^="session-item-"]:not(.hidden)');
      expect(visibleSessions).toHaveLength(1);
    });
  });

  describe('Integration Requirements', () => {
    it('accepts all required props', () => {
      expect(wrapper.props('sessions')).toEqual(mockSessions);
      expect(wrapper.props('selectedSessionId')).toBe('');
      expect(wrapper.props('loading')).toBe(false);
      expect(wrapper.props('error')).toBe(null);
    });

    it('emits all required events', async () => {
      // Test session selection
      const sessionItem = wrapper.find('[data-testid="session-item-session-1"]');
      await sessionItem.trigger('click');
      expect(wrapper.emitted('session-selected')).toBeTruthy();

      // Test refresh
      const refreshButton = wrapper.find('[data-testid="refresh-sessions"]');
      await refreshButton.trigger('click');
      expect(wrapper.emitted('refresh-sessions')).toBeTruthy();
    });
  });
});