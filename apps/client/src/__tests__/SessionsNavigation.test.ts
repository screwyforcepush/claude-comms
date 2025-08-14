import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import App from '../App.vue';

// Mock the WebSocket composable
vi.mock('../composables/useWebSocket', () => ({
  useWebSocket: () => ({
    events: ref([]),
    isConnected: ref(true),
    error: ref(''),
    ws: ref(null)
  })
}));

// Mock the components that aren't relevant for navigation testing
vi.mock('../components/EventTimeline.vue', () => ({ default: { template: '<div>Event Timeline</div>' } }));
vi.mock('../components/FilterPanel.vue', () => ({ default: { template: '<div>Filter Panel</div>' } }));
vi.mock('../components/StickScrollButton.vue', () => ({ default: { template: '<div>Stick Button</div>' } }));
vi.mock('../components/LivePulseChart.vue', () => ({ default: { template: '<div>Pulse Chart</div>' } }));
vi.mock('../components/SubagentComms.vue', () => ({ default: { template: '<div>Subagent Comms</div>' } }));
vi.mock('../components/SessionsView.vue', () => ({ default: { template: '<div>Sessions View</div>' } }));

describe('Sessions Tab Navigation', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(App);
  });

  it('should render all three navigation tabs', () => {
    const tabs = wrapper.findAll('button');
    
    // Find navigation tab buttons
    const tabButtons = tabs.filter((tab: any) => 
      tab.text().includes('Event Timeline') || 
      tab.text().includes('Agents') || 
      tab.text().includes('Sessions')
    );
    
    expect(tabButtons).toHaveLength(3);
    expect(tabButtons[0].text()).toBe('Event Timeline');
    expect(tabButtons[1].text()).toBe('Agents');
    expect(tabButtons[2].text()).toBe('Sessions');
  });

  it('should have Events tab active by default', () => {
    const eventTab = wrapper.find('[data-test="events-tab"]');
    expect(eventTab.classes()).toContain('bg-gray-900');
    expect(eventTab.classes()).toContain('text-blue-400');
    expect(eventTab.classes()).toContain('border-t-2');
  });

  it('should switch to Sessions tab when clicked', async () => {
    const sessionsTab = wrapper.find('[data-test="sessions-tab"]');
    
    await sessionsTab.trigger('click');
    
    expect(sessionsTab.classes()).toContain('bg-gray-900');
    expect(sessionsTab.classes()).toContain('text-blue-400');
    expect(sessionsTab.classes()).toContain('border-t-2');
  });

  it('should show SessionsView component when Sessions tab is active', async () => {
    const sessionsTab = wrapper.find('[data-test="sessions-tab"]');
    
    await sessionsTab.trigger('click');
    
    const sessionsView = wrapper.find('[data-test="sessions-view"]');
    expect(sessionsView.exists()).toBe(true);
  });

  it('should show filters button for both Events and Sessions tabs', async () => {
    // Check Events tab (default)
    let filtersButton = wrapper.find('button[title*="filters"]');
    expect(filtersButton.exists()).toBe(true);
    
    // Switch to Sessions tab
    const sessionsTab = wrapper.find('[data-test="sessions-tab"]');
    await sessionsTab.trigger('click');
    
    // Check filters button still exists for Sessions
    filtersButton = wrapper.find('button[title*="filters"]');
    expect(filtersButton.exists()).toBe(true);
  });

  it('should hide filters button for Agents tab', async () => {
    const agentsTab = wrapper.find('[data-test="agents-tab"]');
    await agentsTab.trigger('click');
    
    const filtersButton = wrapper.find('button[title*="filters"]');
    expect(filtersButton.exists()).toBe(false);
  });

  it('should maintain filter state when switching between Events and Sessions tabs', async () => {
    // Toggle filters on Events tab
    const filtersButton = wrapper.find('button[title*="filters"]');
    await filtersButton.trigger('click');
    
    expect(wrapper.vm.showFilters).toBe(true);
    
    // Switch to Sessions tab
    const sessionsTab = wrapper.find('[data-test="sessions-tab"]');
    await sessionsTab.trigger('click');
    
    // Filters should still be shown
    const filterPanel = wrapper.find('[data-test="filter-panel"]');
    expect(filterPanel.exists()).toBe(true);
  });
});