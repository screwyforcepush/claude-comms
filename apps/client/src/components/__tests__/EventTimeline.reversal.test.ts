/**
 * EventTimeline Component Reversal Tests
 * 
 * Tests for WP1: Core Order Reversal Implementation
 * Tests written FIRST to drive implementation (TDD)
 * 
 * Requirements:
 * 1. Events display in reverse order (latest first)
 * 2. Scroll behavior changes from bottom-sticky to top-sticky
 * 3. Auto-scroll logic adapts for new event arrivals
 * 4. No breaking changes to existing functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import EventTimeline from '../EventTimeline.vue'
import type { HookEvent } from '../../types'

// Mock dependencies
vi.mock('../EventRow.vue', () => ({
  default: { 
    template: '<div class="mock-event-row" :data-event-id="event.id">{{ event.hook_event_type }}</div>',
    props: ['event', 'gradientClass', 'colorClass', 'appGradientClass', 'appColorClass', 'appHexColor']
  }
}))

vi.mock('../../composables/useEventColors', () => ({
  useEventColors: () => ({
    getGradientForSession: () => 'mock-gradient-class',
    getColorForSession: () => 'mock-color-class',
    getGradientForApp: () => 'mock-app-gradient',
    getColorForApp: () => 'mock-app-color',
    getHexColorForApp: () => '#ffffff'
  })
}))

describe('EventTimeline - Reversal Implementation', () => {
  let wrapper: VueWrapper<any>
  let mockEvents: HookEvent[]

  beforeEach(() => {
    // Create test events with clear timestamp ordering
    mockEvents = [
      {
        id: 'event-1',
        timestamp: 1000,
        hook_event_type: 'oldest_event',
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      },
      {
        id: 'event-2', 
        timestamp: 2000,
        hook_event_type: 'middle_event',
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      },
      {
        id: 'event-3',
        timestamp: 3000,
        hook_event_type: 'newest_event',
        source_app: 'test-app', 
        session_id: 'session-1',
        data: {}
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

    wrapper = mount(EventTimeline, {
      props: defaultProps
    })
  })

  afterEach(() => {
    wrapper.unmount()
    vi.clearAllMocks()
  })

  describe('Event Order Reversal', () => {
    it('should display events in reverse chronological order (latest first)', () => {
      const eventRows = wrapper.findAll('.mock-event-row')
      
      expect(eventRows).toHaveLength(3)
      
      // First event displayed should be the newest (highest timestamp)
      expect(eventRows[0].attributes('data-event-id')).toBe('event-3')
      expect(eventRows[0].text()).toContain('newest_event')
      
      // Second event should be middle
      expect(eventRows[1].attributes('data-event-id')).toBe('event-2')
      expect(eventRows[1].text()).toContain('middle_event')
      
      // Last event displayed should be the oldest
      expect(eventRows[2].attributes('data-event-id')).toBe('event-1')
      expect(eventRows[2].text()).toContain('oldest_event')
    })

    it('should maintain reversal when events are added', async () => {
      // Add a new event that should appear first
      const newEvent: HookEvent = {
        id: 'event-4',
        timestamp: 4000,
        hook_event_type: 'very_newest_event',
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      }

      const updatedEvents = [...mockEvents, newEvent]
      await wrapper.setProps({ events: updatedEvents })

      const eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(4)
      
      // New event should appear first
      expect(eventRows[0].attributes('data-event-id')).toBe('event-4')
      expect(eventRows[0].text()).toContain('very_newest_event')
      
      // Previous newest should now be second
      expect(eventRows[1].attributes('data-event-id')).toBe('event-3')
      expect(eventRows[1].text()).toContain('newest_event')
    })

    it('should apply reversal after filtering', async () => {
      // Create events with different session IDs
      const mixedEvents: HookEvent[] = [
        { ...mockEvents[0], session_id: 'session-1' },
        { ...mockEvents[1], session_id: 'session-2' },
        { ...mockEvents[2], session_id: 'session-1' }
      ]

      await wrapper.setProps({ 
        events: mixedEvents,
        filters: { sourceApp: '', sessionId: 'session-1', eventType: '' }
      })

      const eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(2)
      
      // Should show newest session-1 event first
      expect(eventRows[0].attributes('data-event-id')).toBe('event-3')
      expect(eventRows[1].attributes('data-event-id')).toBe('event-1')
    })

    it('should handle empty events array without errors', async () => {
      await wrapper.setProps({ events: [] })
      
      const eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(0)
      
      // Should show empty state message
      expect(wrapper.text()).toContain('No events to display')
      expect(wrapper.text()).toContain('Events will appear here as they are received')
    })
  })

  describe('Scroll Behavior Changes', () => {
    it('should have scrollToTop function instead of scrollToBottom', () => {
      expect(typeof wrapper.vm.scrollToTop).toBe('function')
    })

    it('should scroll to top when scrollToTop is called', async () => {
      const mockScrollContainer = {
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 500
      }
      
      // Mock the scroll container ref
      Object.defineProperty(wrapper.vm, 'scrollContainer', {
        value: mockScrollContainer,
        writable: true
      })
      
      wrapper.vm.scrollToTop()
      expect(mockScrollContainer.scrollTop).toBe(0)
    })

    it('should update stickToTop behavior instead of stickToBottom', () => {
      const handleScroll = wrapper.vm.handleScroll
      expect(typeof handleScroll).toBe('function')
      
      // Mock scroll container with top position
      const mockScrollContainer = {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500
      }
      Object.defineProperty(wrapper.vm, 'scrollContainer', {
        value: mockScrollContainer,
        writable: true
      })
      
      handleScroll()
      
      // Should emit stickToBottom: true when at top (reversed behavior)
      expect(wrapper.emitted('update:stickToBottom')).toBeTruthy()
      const lastEmit = wrapper.emitted('update:stickToBottom')?.at(-1)
      expect(lastEmit?.[0]).toBe(true)
    })

    it('should detect when user scrolls away from top', () => {
      const mockScrollContainer = {
        scrollTop: 100, // Not at top
        scrollHeight: 1000,
        clientHeight: 500
      }
      Object.defineProperty(wrapper.vm, 'scrollContainer', {
        value: mockScrollContainer,
        writable: true
      })
      
      wrapper.vm.handleScroll()
      
      // Should emit stickToBottom: false when not at top
      const lastEmit = wrapper.emitted('update:stickToBottom')?.at(-1)
      expect(lastEmit?.[0]).toBe(false)
    })
  })

  describe('Auto-scroll Logic for New Events', () => {
    it('should auto-scroll to top when new events arrive and stickToBottom is true', async () => {
      // Set up auto-scroll conditions
      await wrapper.setProps({ stickToBottom: true })
      
      const scrollToTopSpy = vi.spyOn(wrapper.vm, 'scrollToTop')
      
      // Add new event
      const newEvent: HookEvent = {
        id: 'event-new',
        timestamp: 5000,
        hook_event_type: 'new_event',
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      }

      await wrapper.setProps({ events: [...mockEvents, newEvent] })
      await nextTick()
      
      expect(scrollToTopSpy).toHaveBeenCalled()
    })

    it('should not auto-scroll when stickToBottom is false', async () => {
      await wrapper.setProps({ stickToBottom: false })
      
      const scrollToTopSpy = vi.spyOn(wrapper.vm, 'scrollToTop')
      
      // Add new event
      const newEvent: HookEvent = {
        id: 'event-new',
        timestamp: 5000,
        hook_event_type: 'new_event',
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      }

      await wrapper.setProps({ events: [...mockEvents, newEvent] })
      await nextTick()
      
      expect(scrollToTopSpy).not.toHaveBeenCalled()
    })

    it('should auto-scroll to top when stickToBottom prop changes to true', async () => {
      const scrollToTopSpy = vi.spyOn(wrapper.vm, 'scrollToTop')
      
      await wrapper.setProps({ stickToBottom: false })
      await wrapper.setProps({ stickToBottom: true })
      
      expect(scrollToTopSpy).toHaveBeenCalled()
    })
  })

  describe('Animation and Transitions', () => {
    it('should have proper CSS classes for enter animations', () => {
      // Check for transition group wrapper
      const transitionWrapper = wrapper.find('.space-y-2')
      expect(transitionWrapper.exists()).toBe(true)
      
      // Verify the TransitionGroup exists in the component
      const html = wrapper.html()
      expect(html.includes('space-y')).toBe(true)
    })

    it('should animate new events entering at the top', async () => {
      // This test documents expected animation behavior
      // Animation CSS should be in component styles
      const html = wrapper.html()
      
      // Check that animation-related classes are present in the component structure
      expect(html.includes('transition') || html.includes('event-')).toBe(true)
    })
  })

  describe('Backwards Compatibility', () => {
    it('should maintain all existing props interface', () => {
      const props = wrapper.props()
      
      expect(props.events).toBeDefined()
      expect(props.filters).toBeDefined()
      expect(props.stickToBottom).toBeDefined()
      
      // Filters structure should remain the same
      expect(props.filters.sourceApp).toBeDefined()
      expect(props.filters.sessionId).toBeDefined()
      expect(props.filters.eventType).toBeDefined()
    })

    it('should emit the same events as before', () => {
      // Should still emit update:stickToBottom events
      wrapper.vm.handleScroll()
      expect(wrapper.emitted('update:stickToBottom')).toBeDefined()
    })

    it('should still support all filter types', async () => {
      // Test sourceApp filter
      await wrapper.setProps({
        filters: { sourceApp: 'test-app', sessionId: '', eventType: '' }
      })
      let eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(3) // All events match
      
      // Test sessionId filter
      await wrapper.setProps({
        filters: { sourceApp: '', sessionId: 'session-1', eventType: '' }
      })
      eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(3) // All events match
      
      // Test eventType filter
      await wrapper.setProps({
        filters: { sourceApp: '', sessionId: '', eventType: 'newest_event' }
      })
      eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(1) // Only one matches
      expect(eventRows[0].text()).toContain('newest_event')
    })
  })

  describe('Performance', () => {
    it('should handle large event arrays efficiently', async () => {
      const largeEventArray: HookEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `event-${i}`,
        timestamp: i * 1000,
        hook_event_type: `event_${i}`,
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      }))

      const startTime = performance.now()
      await wrapper.setProps({ events: largeEventArray })
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
      
      const eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows).toHaveLength(100)
      
      // First event should be the highest timestamp (newest)
      expect(eventRows[0].attributes('data-event-id')).toBe('event-99')
    })

    it('should not recreate the entire list when one event is added', async () => {
      const initialEvents = mockEvents.slice(0, 2)
      await wrapper.setProps({ events: initialEvents })
      
      const initialRows = wrapper.findAll('.mock-event-row')
      const initialRowElements = initialRows.map(row => row.element)
      
      // Add one new event
      const newEvent: HookEvent = {
        id: 'event-new',
        timestamp: 5000,
        hook_event_type: 'new_event',
        source_app: 'test-app',
        session_id: 'session-1',
        data: {}
      }
      
      await wrapper.setProps({ events: [...initialEvents, newEvent] })
      await nextTick()
      
      const newRows = wrapper.findAll('.mock-event-row')
      expect(newRows).toHaveLength(3)
      
      // New event should be first (newest)
      expect(newRows[0].attributes('data-event-id')).toBe('event-new')
      
      // Existing elements should still be present (Vue's reactivity optimization)
      const existingElements = newRows.slice(1).map(row => row.element)
      expect(existingElements.some(el => initialRowElements.includes(el))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle events with missing timestamps gracefully', () => {
      const eventsWithMissingTimestamps: HookEvent[] = [
        { ...mockEvents[0], timestamp: undefined as any },
        mockEvents[1],
        { ...mockEvents[2], timestamp: null as any }
      ]

      expect(() => {
        wrapper.setProps({ events: eventsWithMissingTimestamps })
      }).not.toThrow()

      // Should still render without errors
      const eventRows = wrapper.findAll('.mock-event-row')
      expect(eventRows.length).toBeGreaterThan(0)
    })

    it('should handle malformed event objects', () => {
      const malformedEvents = [
        null,
        undefined,
        { id: 'valid-event', timestamp: 1000, hook_event_type: 'test' },
        { /* missing required fields */ }
      ].filter(Boolean) as HookEvent[]

      expect(() => {
        wrapper.setProps({ events: malformedEvents })
      }).not.toThrow()
    })
  })
})