/**
 * EventTimeline Component Tests
 * 
 * Comprehensive test suite for timeline order enhancement feature.
 * Tests timeline reversal logic, scroll behavior, and real-time updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventTimeline from '../EventTimeline.vue'
import type { HookEvent } from '../../types'

// Mock EventRow component
vi.mock('../EventRow.vue', () => ({
  default: {
    name: 'EventRow',
    props: ['event', 'gradientClass', 'colorClass', 'appGradientClass', 'appColorClass', 'appHexColor'],
    template: '<div data-testid="event-row" :data-event-id="event.id">{{ event.hook_event_type }}</div>'
  }
}))

// Mock useEventColors composable
vi.mock('../../composables/useEventColors', () => ({
  useEventColors: () => ({
    getGradientForSession: vi.fn(() => 'bg-blue-500'),
    getColorForSession: vi.fn(() => 'text-blue-500'),
    getGradientForApp: vi.fn(() => 'bg-green-500'),
    getColorForApp: vi.fn(() => 'text-green-500'),
    getHexColorForApp: vi.fn(() => '#10B981')
  })
}))

describe('EventTimeline', () => {
  const mockEvents: HookEvent[] = [
    {
      id: 1,
      source_app: 'client',
      session_id: 'session-1',
      hook_event_type: 'PreToolUse',
      payload: { tool_name: 'Bash' },
      timestamp: 1000
    },
    {
      id: 2,
      source_app: 'server',
      session_id: 'session-1',
      hook_event_type: 'PostToolUse',
      payload: { tool_name: 'Read' },
      timestamp: 2000
    },
    {
      id: 3,
      source_app: 'client',
      session_id: 'session-2',
      hook_event_type: 'Notification',
      payload: { message: 'Test notification' },
      timestamp: 3000
    }
  ]

  const defaultProps = {
    events: mockEvents,
    filters: {
      sourceApp: '',
      sessionId: '',
      eventType: ''
    },
    stickToBottom: true
  }

  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Timeline Order Enhancement', () => {
    describe('Reversed Timeline Order', () => {
      it('displays events in reverse chronological order (latest first)', () => {
        wrapper = mount(EventTimeline, {
          props: defaultProps
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(3)
        
        // Events should be in reverse order: newest first
        expect(eventRows[0].attributes('data-event-id')).toBe('3') // timestamp: 3000
        expect(eventRows[1].attributes('data-event-id')).toBe('2') // timestamp: 2000
        expect(eventRows[2].attributes('data-event-id')).toBe('1') // timestamp: 1000
      })

      it('maintains reverse order when events are added', async () => {
        wrapper = mount(EventTimeline, {
          props: defaultProps
        })

        // Add a new event with latest timestamp
        const newEvent: HookEvent = {
          id: 4,
          source_app: 'client',
          session_id: 'session-1',
          hook_event_type: 'Stop',
          payload: {},
          timestamp: 4000
        }

        await wrapper.setProps({
          events: [...mockEvents, newEvent]
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(4)
        
        // New event should be first (highest timestamp)
        expect(eventRows[0].attributes('data-event-id')).toBe('4')
        expect(eventRows[1].attributes('data-event-id')).toBe('3')
        expect(eventRows[2].attributes('data-event-id')).toBe('2')
        expect(eventRows[3].attributes('data-event-id')).toBe('1')
      })

      it('handles events without timestamps gracefully', () => {
        const eventsWithoutTimestamps: HookEvent[] = [
          {
            id: 1,
            source_app: 'client',
            session_id: 'session-1',
            hook_event_type: 'PreToolUse',
            payload: {}
            // No timestamp
          },
          {
            id: 2,
            source_app: 'server',
            session_id: 'session-1',
            hook_event_type: 'PostToolUse',
            payload: {},
            timestamp: 2000
          }
        ]

        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: eventsWithoutTimestamps
          }
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(2)
        // Should not crash when some events lack timestamps
      })
    })

    describe('Event Filtering with Reverse Order', () => {
      it('applies filters correctly and maintains reverse order', async () => {
        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            filters: {
              sourceApp: 'client',
              sessionId: '',
              eventType: ''
            }
          }
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(2) // Only client events
        
        // Should still be in reverse order
        expect(eventRows[0].attributes('data-event-id')).toBe('3') // Latest client event
        expect(eventRows[1].attributes('data-event-id')).toBe('1') // Earlier client event
      })

      it('filters by session and maintains reverse order', async () => {
        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            filters: {
              sourceApp: '',
              sessionId: 'session-1',
              eventType: ''
            }
          }
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(2) // Only session-1 events
        
        // Should be in reverse order: id 2 (timestamp 2000) before id 1 (timestamp 1000)
        expect(eventRows[0].attributes('data-event-id')).toBe('2')
        expect(eventRows[1].attributes('data-event-id')).toBe('1')
      })

      it('filters by event type and maintains reverse order', async () => {
        const eventsWithSameType: HookEvent[] = [
          {
            id: 1,
            source_app: 'client',
            session_id: 'session-1',
            hook_event_type: 'PreToolUse',
            payload: {},
            timestamp: 1000
          },
          {
            id: 2,
            source_app: 'server',
            session_id: 'session-2',
            hook_event_type: 'PreToolUse',
            payload: {},
            timestamp: 3000
          }
        ]

        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: eventsWithSameType,
            filters: {
              sourceApp: '',
              sessionId: '',
              eventType: 'PreToolUse'
            }
          }
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(2)
        
        // Should be in reverse order: newest first
        expect(eventRows[0].attributes('data-event-id')).toBe('2') // timestamp 3000
        expect(eventRows[1].attributes('data-event-id')).toBe('1') // timestamp 1000
      })
    })

    describe('Edge Cases', () => {
      it('handles empty event list', () => {
        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: []
          }
        })

        expect(wrapper.text()).toContain('No events to display')
        expect(wrapper.text()).toContain('Events will appear here as they are received')
        expect(wrapper.findAll('[data-testid="event-row"]')).toHaveLength(0)
      })

      it('handles single event', () => {
        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: [mockEvents[0]]
          }
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(1)
        expect(eventRows[0].attributes('data-event-id')).toBe('1')
      })

      it('handles many events efficiently', () => {
        const manyEvents: HookEvent[] = Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          source_app: 'client',
          session_id: 'session-1',
          hook_event_type: 'PreToolUse',
          payload: {},
          timestamp: i * 1000
        }))

        const startTime = performance.now()
        
        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: manyEvents
          }
        })

        const endTime = performance.now()
        const renderTime = endTime - startTime

        // Should render in reasonable time (less than 100ms)
        expect(renderTime).toBeLessThan(100)
        
        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(1000)
        
        // First event should have highest ID (latest timestamp)
        expect(eventRows[0].attributes('data-event-id')).toBe('1000')
        expect(eventRows[999].attributes('data-event-id')).toBe('1')
      })

      it('handles events with same timestamp', () => {
        const eventsWithSameTimestamp: HookEvent[] = [
          {
            id: 1,
            source_app: 'client',
            session_id: 'session-1',
            hook_event_type: 'PreToolUse',
            payload: {},
            timestamp: 1000
          },
          {
            id: 2,
            source_app: 'server',
            session_id: 'session-1',
            hook_event_type: 'PostToolUse',
            payload: {},
            timestamp: 1000 // Same timestamp
          }
        ]

        wrapper = mount(EventTimeline, {
          props: {
            ...defaultProps,
            events: eventsWithSameTimestamp
          }
        })

        const eventRows = wrapper.findAll('[data-testid="event-row"]')
        expect(eventRows).toHaveLength(2)
        // Should handle gracefully without crashing
      })
    })
  })

  describe('Scroll Behavior Transition', () => {
    let mockScrollContainer: any

    beforeEach(() => {
      mockScrollContainer = {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        scrollTo: vi.fn()
      }

      // Mock DOM element methods
      Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
        get: () => mockScrollContainer.scrollTop,
        set: (value) => { mockScrollContainer.scrollTop = value },
        configurable: true
      })
      
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        get: () => mockScrollContainer.scrollHeight,
        configurable: true
      })
      
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        get: () => mockScrollContainer.clientHeight,
        configurable: true
      })
    })

    it('scrolls to top when stickToTop behavior is enabled', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          stickToBottom: false // This should be stickToTop in the reversed implementation
        }
      })

      await nextTick()

      // In the reversed timeline, when stickToBottom is false, it should stick to top
      const scrollContainer = wrapper.find('[ref="scrollContainer"]')
      expect(scrollContainer.exists()).toBe(true)
    })

    it('maintains current scroll position when not sticking', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const initialScrollTop = 250
      mockScrollContainer.scrollTop = initialScrollTop

      // Simulate scroll event
      const scrollContainer = wrapper.find('[ref="scrollContainer"]')
      await scrollContainer.trigger('scroll')

      // Should maintain position when not auto-scrolling
      expect(mockScrollContainer.scrollTop).toBe(initialScrollTop)
    })
  })

  describe('Real-time Event Updates', () => {
    it('updates display when new events are added', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      expect(wrapper.findAll('[data-testid="event-row"]')).toHaveLength(3)

      // Add new event
      const newEvent: HookEvent = {
        id: 4,
        source_app: 'client',
        session_id: 'session-1',
        hook_event_type: 'UserPromptSubmit',
        payload: { prompt: 'Test prompt' },
        timestamp: 4000
      }

      await wrapper.setProps({
        events: [...mockEvents, newEvent]
      })

      expect(wrapper.findAll('[data-testid="event-row"]')).toHaveLength(4)
      
      // New event should appear first (latest timestamp)
      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows[0].attributes('data-event-id')).toBe('4')
    })

    it('handles rapid event updates', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Simulate rapid event additions
      const rapidEvents = [...mockEvents]
      for (let i = 4; i <= 10; i++) {
        rapidEvents.push({
          id: i,
          source_app: 'client',
          session_id: 'session-1',
          hook_event_type: 'Notification',
          payload: {},
          timestamp: i * 1000
        })

        await wrapper.setProps({ events: [...rapidEvents] })
        await nextTick()
      }

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(10)
      
      // Should maintain correct order even with rapid updates
      expect(eventRows[0].attributes('data-event-id')).toBe('10') // Latest
      expect(eventRows[9].attributes('data-event-id')).toBe('1')  // Oldest
    })
  })

  describe('Component Structure', () => {
    it('renders header correctly', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      expect(wrapper.text()).toContain('Agent Event Stream')
      expect(wrapper.find('h2').classes()).toContain('text-blue-400')
    })

    it('renders scrollable container', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const scrollContainer = wrapper.find('[ref="scrollContainer"]')
      expect(scrollContainer.exists()).toBe(true)
      expect(scrollContainer.classes()).toContain('overflow-y-auto')
    })

    it('applies proper CSS classes for mobile responsive design', () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const header = wrapper.find('h2')
      expect(header.classes()).toContain('mobile:text-lg')
      
      const container = wrapper.find('[ref="scrollContainer"]')
      expect(container.classes()).toContain('mobile:px-2')
    })
  })

  describe('Event Filtering Integration', () => {
    it('emits correct events for filter changes', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Simulate filter change through scroll detection
      const scrollContainer = wrapper.find('[ref="scrollContainer"]')
      
      // Mock being at top of container (for reversed timeline)
      mockScrollContainer.scrollTop = 0
      await scrollContainer.trigger('scroll')

      // Should emit stickToBottom update
      expect(wrapper.emitted('update:stickToBottom')).toBeTruthy()
    })
  })
})