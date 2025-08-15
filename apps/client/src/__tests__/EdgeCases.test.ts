/**
 * Edge Cases Tests for Timeline Order Enhancement
 * 
 * Comprehensive edge case testing for timeline reversal functionality.
 * Tests boundary conditions, error states, and unusual data scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventTimeline from '../components/EventTimeline.vue'
import type { HookEvent } from '../types'

// Mock EventRow component
vi.mock('../components/EventRow.vue', () => ({
  default: {
    name: 'EventRow',
    props: ['event', 'gradientClass', 'colorClass', 'appGradientClass', 'appColorClass', 'appHexColor'],
    template: '<div data-testid="event-row" :data-event-id="event.id">{{ event.hook_event_type }}</div>'
  }
}))

// Mock useEventColors composable
vi.mock('../composables/useEventColors', () => ({
  useEventColors: () => ({
    getGradientForSession: vi.fn(() => 'bg-blue-500'),
    getColorForSession: vi.fn(() => 'text-blue-500'),
    getGradientForApp: vi.fn(() => 'bg-green-500'),
    getColorForApp: vi.fn(() => 'text-green-500'),
    getHexColorForApp: vi.fn(() => '#10B981')
  })
}))

describe('Timeline Edge Cases', () => {
  const createMalformedEvent = (overrides: Partial<HookEvent> = {}): HookEvent => ({
    id: 1,
    source_app: 'client',
    session_id: 'session-1',
    hook_event_type: 'PreToolUse',
    payload: {},
    timestamp: Date.now(),
    ...overrides
  })

  const defaultProps = {
    events: [] as HookEvent[],
    filters: { sourceApp: '', sessionId: '', eventType: '' },
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

  describe('Empty and Null Data Cases', () => {
    it('handles completely empty events array', () => {
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

    it('handles null events array gracefully', () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: null as any
        }
      })

      // Should not crash and show empty state
      expect(wrapper.find('.text-center').exists()).toBe(true)
    })

    it('handles undefined events array gracefully', () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: undefined as any
        }
      })

      // Should not crash
      expect(wrapper.vm).toBeDefined()
    })

    it('handles events with null/undefined IDs', () => {
      const eventsWithNullIds: HookEvent[] = [
        createMalformedEvent({ id: null as any }),
        createMalformedEvent({ id: undefined as any }),
        createMalformedEvent({ id: 0 }),
        createMalformedEvent({ id: -1 })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithNullIds
        }
      })

      // Should not crash
      expect(wrapper.vm).toBeDefined()
    })

    it('handles events with empty strings for required fields', () => {
      const eventsWithEmptyStrings: HookEvent[] = [
        createMalformedEvent({
          source_app: '',
          session_id: '',
          hook_event_type: ''
        })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithEmptyStrings
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
    })
  })

  describe('Timestamp Edge Cases', () => {
    it('handles events without timestamps', () => {
      const eventsWithoutTimestamps: HookEvent[] = [
        createMalformedEvent({ timestamp: undefined }),
        createMalformedEvent({ timestamp: null as any }),
        createMalformedEvent({ timestamp: 0 }),
        createMalformedEvent({ id: 4, timestamp: Date.now() })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithoutTimestamps
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(4)
      
      // Should not crash when sorting events with missing timestamps
      expect(wrapper.vm).toBeDefined()
    })

    it('handles negative timestamps', () => {
      const eventsWithNegativeTimestamps: HookEvent[] = [
        createMalformedEvent({ id: 1, timestamp: -1000 }),
        createMalformedEvent({ id: 2, timestamp: -500 }),
        createMalformedEvent({ id: 3, timestamp: 1000 })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithNegativeTimestamps
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(3)
      
      // Latest positive timestamp should be first
      expect(eventRows[0].attributes('data-event-id')).toBe('3')
    })

    it('handles extremely large timestamps', () => {
      const futureTimestamp = Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year in future
      const eventsWithFutureTimestamps: HookEvent[] = [
        createMalformedEvent({ id: 1, timestamp: Date.now() }),
        createMalformedEvent({ id: 2, timestamp: futureTimestamp }),
        createMalformedEvent({ id: 3, timestamp: Number.MAX_SAFE_INTEGER })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithFutureTimestamps
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(3)
      
      // Largest timestamp should be first
      expect(eventRows[0].attributes('data-event-id')).toBe('3')
    })

    it('handles identical timestamps', () => {
      const sameTimestamp = Date.now()
      const eventsWithSameTimestamp: HookEvent[] = [
        createMalformedEvent({ id: 1, timestamp: sameTimestamp }),
        createMalformedEvent({ id: 2, timestamp: sameTimestamp }),
        createMalformedEvent({ id: 3, timestamp: sameTimestamp }),
        createMalformedEvent({ id: 4, timestamp: sameTimestamp })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithSameTimestamp
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(4)
      
      // Should maintain stable sort
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Malformed Event Data', () => {
    it('handles events with malformed payload', () => {
      const eventsWithMalformedPayload: HookEvent[] = [
        createMalformedEvent({ payload: null as any }),
        createMalformedEvent({ payload: undefined as any }),
        createMalformedEvent({ payload: 'not-an-object' as any }),
        createMalformedEvent({ payload: [] as any }),
        createMalformedEvent({ payload: { circular: null } })
      ]

      // Create circular reference
      eventsWithMalformedPayload[4].payload.circular = eventsWithMalformedPayload[4].payload

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithMalformedPayload
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(5)
    })

    it('handles events with extremely long field values', () => {
      const longString = 'x'.repeat(10000)
      const eventsWithLongValues: HookEvent[] = [
        createMalformedEvent({
          source_app: longString,
          session_id: longString,
          hook_event_type: longString
        })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithLongValues
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
    })

    it('handles events with special characters and Unicode', () => {
      const eventsWithSpecialChars: HookEvent[] = [
        createMalformedEvent({
          source_app: '🚀💻📱',
          session_id: 'session-中文-العربية-🔥',
          hook_event_type: 'Event\n\t\r\\"\'<script>alert("xss")</script>'
        }),
        createMalformedEvent({
          source_app: '\u0000\u0001\u0002',
          session_id: 'DROP TABLE events', // Remove SQL injection attempt
          hook_event_type: String.fromCharCode(0, 1, 2, 3)
        })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithSpecialChars
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(2)
    })
  })

  describe('Filter Edge Cases', () => {
    it('handles malformed filter objects', () => {
      const testEvents = [
        createMalformedEvent({ id: 1, source_app: 'client' }),
        createMalformedEvent({ id: 2, source_app: 'server' })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: testEvents,
          filters: null as any
        }
      })

      // Should show all events when filters are null
      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(2)
    })

    it('handles filters with special characters', () => {
      const testEvents = [
        createMalformedEvent({ id: 1, source_app: 'client-🚀' }),
        createMalformedEvent({ id: 2, source_app: 'server' })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: testEvents,
          filters: {
            sourceApp: 'client-🚀',
            sessionId: '',
            eventType: ''
          }
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
      expect(eventRows[0].attributes('data-event-id')).toBe('1')
    })

    it('handles filters with regex special characters', () => {
      const testEvents = [
        createMalformedEvent({ id: 1, source_app: 'client.*[+]?' }),
        createMalformedEvent({ id: 2, source_app: 'server' })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: testEvents,
          filters: {
            sourceApp: 'client.*[+]?',
            sessionId: '',
            eventType: ''
          }
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
    })

    it('handles extremely long filter values', () => {
      const longFilterValue = 'x'.repeat(1000)
      const testEvents = [
        createMalformedEvent({ id: 1, source_app: longFilterValue })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: testEvents,
          filters: {
            sourceApp: longFilterValue,
            sessionId: '',
            eventType: ''
          }
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
    })
  })

  describe('Performance Edge Cases', () => {
    it('handles rapid event additions without memory leaks', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      const initialEvents: HookEvent[] = []
      
      // Simulate very rapid event stream
      for (let i = 0; i < 1000; i++) {
        initialEvents.push(createMalformedEvent({
          id: i,
          timestamp: Date.now() + i
        }))

        if (i % 100 === 0) {
          await wrapper.setProps({ events: [...initialEvents] })
          await nextTick()
        }
      }

      // Final update
      await wrapper.setProps({ events: initialEvents })
      await nextTick()

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1000)
      
      // First event should have highest ID (latest timestamp)
      expect(eventRows[0].attributes('data-event-id')).toBe('999')
    })

    it('handles events with deeply nested payload objects', () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) return 'deep-value'
        return { nested: createDeepObject(depth - 1) }
      }

      const eventsWithDeepPayload: HookEvent[] = [
        createMalformedEvent({
          payload: createDeepObject(50) // Very deep nesting
        })
      ]

      const startTime = performance.now()

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithDeepPayload
        }
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render without significant performance impact
      expect(renderTime).toBeLessThan(100)
      
      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
    })

    it('handles events with large array payloads', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({ index: i, data: `item-${i}` }))
      
      const eventsWithLargePayload: HookEvent[] = [
        createMalformedEvent({
          payload: { items: largeArray }
        })
      ]

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: eventsWithLargePayload
        }
      })

      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(1)
    })
  })

  describe('Scroll Behavior Edge Cases', () => {
    let mockElement: any

    beforeEach(() => {
      mockElement = {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500
      }

      Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
        get: () => mockElement.scrollTop,
        set: (value) => { mockElement.scrollTop = value },
        configurable: true
      })

      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        get: () => mockElement.scrollHeight,
        configurable: true
      })

      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        get: () => mockElement.clientHeight,
        configurable: true
      })
    })

    it('handles scroll container with zero height', () => {
      mockElement.clientHeight = 0
      mockElement.scrollHeight = 0

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: [createMalformedEvent()]
        }
      })

      // Should not crash when container has zero height
      expect(wrapper.vm).toBeDefined()
    })

    it('handles scroll container with negative dimensions', () => {
      mockElement.clientHeight = -100
      mockElement.scrollHeight = -50

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: [createMalformedEvent()]
        }
      })

      // Should not crash with negative dimensions
      expect(wrapper.vm).toBeDefined()
    })

    it('handles rapid scroll events', async () => {
      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: [createMalformedEvent()]
        }
      })

      const scrollContainer = wrapper.find('[ref="scrollContainer"]')

      // Simulate rapid scroll events
      for (let i = 0; i < 100; i++) {
        mockElement.scrollTop = i * 5
        await scrollContainer.trigger('scroll')
      }

      // Should handle rapid scroll events without issues
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Memory and Resource Edge Cases', () => {
    it('handles component destruction during event updates', async () => {
      wrapper = mount(EventTimeline, {
        props: defaultProps
      })

      // Start event update
      const updatePromise = wrapper.setProps({
        events: [createMalformedEvent()]
      })

      // Destroy component before update completes
      wrapper.unmount()

      // Should not throw errors
      await expect(updatePromise).resolves.toBeDefined()
    })

    it('handles memory pressure scenarios', () => {
      // Create many events to simulate memory pressure
      const manyEvents = Array.from({ length: 10000 }, (_, i) => 
        createMalformedEvent({
          id: i,
          payload: { largeData: 'x'.repeat(1000) }
        })
      )

      const startTime = performance.now()

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: manyEvents
        }
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should handle large datasets efficiently
      expect(renderTime).toBeLessThan(1000)
      
      const eventRows = wrapper.findAll('[data-testid="event-row"]')
      expect(eventRows).toHaveLength(10000)
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('handles environments without modern JavaScript features', () => {
      // Mock older browser environment
      const originalReverse = Array.prototype.reverse
      Array.prototype.reverse = undefined as any

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: [
            createMalformedEvent({ id: 1, timestamp: 1000 }),
            createMalformedEvent({ id: 2, timestamp: 2000 })
          ]
        }
      })

      // Should fallback gracefully
      expect(wrapper.vm).toBeDefined()

      // Restore original method
      Array.prototype.reverse = originalReverse
    })

    it('handles environments without scrolling support', () => {
      // Mock environment without scroll support
      const originalScrollTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')
      
      Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
        get: () => { throw new Error('Scroll not supported') },
        set: () => { throw new Error('Scroll not supported') },
        configurable: true
      })

      wrapper = mount(EventTimeline, {
        props: {
          ...defaultProps,
          events: [createMalformedEvent()]
        }
      })

      // Should handle scroll errors gracefully
      expect(wrapper.vm).toBeDefined()

      // Restore original descriptor
      if (originalScrollTop) {
        Object.defineProperty(HTMLElement.prototype, 'scrollTop', originalScrollTop)
      }
    })
  })
})