import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSessionIntrospection } from '../useSessionIntrospection'
import type { SessionIntrospectionResponse, SessionTimelineMessage } from '../../types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Test data fixtures
const mockTimelineMessage: SessionTimelineMessage = {
  id: 1,
  type: 'user_message',
  role: 'User',
  timestamp: 1692728400000,
  content: {
    prompt: 'Hello, please create a new feature',
    user_id: 'user-123'
  },
  source_event: {
    hook_event_type: 'UserPromptSubmit',
    payload: {
      prompt: 'Hello, please create a new feature',
      user_id: 'user-123'
    }
  }
}

const mockSessionResponse: SessionIntrospectionResponse = {
  sessionId: 'test-session-123',
  timeline: [mockTimelineMessage],
  messageCount: 1,
  timeRange: {
    start: 1692728400000,
    end: 1692728400000,
    duration: 0
  }
}

const emptyResponse: SessionIntrospectionResponse = {
  sessionId: 'empty-session',
  timeline: [],
  messageCount: 0,
  timeRange: null
}

describe('useSessionIntrospection - Final Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
    
    // Clear any cached data between tests
    const { clearCache } = useSessionIntrospection()
    clearCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('✅ Core Functionality', () => {
    it('should initialize with correct default state', () => {
      const { data, loading, error, sessionId } = useSessionIntrospection()

      expect(data.value).toEqual({
        sessionId: '',
        timeline: [],
        messageCount: 0,
        timeRange: null
      })
      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(sessionId.value).toBe('')
    })

    it('should accept initial sessionId parameter', () => {
      const { sessionId } = useSessionIntrospection('test-session-123')
      expect(sessionId.value).toBe('test-session-123')
    })

    it('should return correct interface', () => {
      const result = useSessionIntrospection()
      
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('loading')
      expect(result).toHaveProperty('error')
      expect(result).toHaveProperty('sessionId')
      expect(result).toHaveProperty('eventTypes')
      expect(result).toHaveProperty('fetchData')
      expect(result).toHaveProperty('refresh')
      expect(result).toHaveProperty('transformMessage')
    })
  })

  describe('✅ Data Fetching', () => {
    it('should fetch data successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { fetchData, data, error, loading } = useSessionIntrospection('test-session-123')
      
      expect(loading.value).toBe(false)
      
      const fetchPromise = fetchData()
      expect(loading.value).toBe(true)
      
      await fetchPromise
      
      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(data.value.sessionId).toBe('test-session-123')
      expect(data.value.timeline).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session-123/introspect', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
    })

    it('should handle API errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Session not found' })
      })

      const { fetchData, error, loading } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      
      expect(loading.value).toBe(false)
      expect(error.value).toBe('Session not found')
    })

    it('should support event type filtering', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { fetchData, eventTypes } = useSessionIntrospection('test-session-123')
      eventTypes.value = ['UserPromptSubmit', 'SubagentComplete']
      
      await fetchData()

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session-123/introspect?types=SubagentComplete,UserPromptSubmit', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
    })

    it('should not fetch when sessionId is empty', async () => {
      const { fetchData, data } = useSessionIntrospection('')
      
      await fetchData()
      
      expect(mockFetch).not.toHaveBeenCalled()
      expect(data.value.sessionId).toBe('')
    })

    it('should handle empty session responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(emptyResponse)
      })

      const { fetchData, data } = useSessionIntrospection('empty-session')
      await fetchData()

      expect(data.value.timeline).toEqual([])
      expect(data.value.messageCount).toBe(0)
      expect(data.value.timeRange).toBe(null)
    })
  })

  describe('✅ Data Transformation', () => {
    it('should transform SessionTimelineMessage to TimelineMessage format', () => {
      const { transformMessage } = useSessionIntrospection()
      const result = transformMessage(mockTimelineMessage)

      expect(result).toEqual({
        id: 1,
        type: 'user_prompt',
        timestamp: 1692728400000,
        content: 'Hello, please create a new feature',
        metadata: {
          session_id: undefined,
          user_id: 'user-123',
          hook_event_type: 'UserPromptSubmit'
        }
      })
    })

    it('should handle missing content gracefully', () => {
      const { transformMessage } = useSessionIntrospection()
      
      const messageWithMissingFields: SessionTimelineMessage = {
        id: 4,
        type: 'user_message',
        role: 'User',
        timestamp: 1692728400000,
        content: {},
        source_event: {
          hook_event_type: 'UserPromptSubmit',
          payload: {}
        }
      }

      const result = transformMessage(messageWithMissingFields)

      expect(result).toEqual({
        id: 4,
        type: 'user_prompt',
        timestamp: 1692728400000,
        content: 'No content available',
        metadata: {
          session_id: undefined,
          hook_event_type: 'UserPromptSubmit'
        }
      })
    })

    it('should sort messages chronologically', async () => {
      const message2 = { ...mockTimelineMessage, id: 2, timestamp: 1692728500000 }
      const message3 = { ...mockTimelineMessage, id: 3, timestamp: 1692728300000 }
      
      const unorderedResponse = {
        ...mockSessionResponse,
        timeline: [message2, mockTimelineMessage, message3] // Out of order
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(unorderedResponse)
      })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      const timeline = data.value.timeline
      expect(timeline).toHaveLength(3)
      expect(timeline[0].timestamp).toBeLessThanOrEqual(timeline[1].timestamp || 0)
      expect(timeline[1].timestamp).toBeLessThanOrEqual(timeline[2].timestamp || 0)
    })
  })

  describe('✅ Caching', () => {
    it('should cache successful responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { fetchData } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1) // Should use cache
    })

    it('should bypass cache on refresh', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { fetchData, refresh } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      await refresh()
      expect(mockFetch).toHaveBeenCalledTimes(2) // Should bypass cache
    })

    it('should invalidate cache on sessionId change', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { sessionId, fetchData } = useSessionIntrospection('session-1')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      sessionId.value = 'session-2'
      await nextTick()
      
      // Manual refetch required since watchers have immediate: false
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(2) // New session triggers fresh fetch
    })
  })

  describe('✅ Reactive Updates', () => {
    it('should clear data when sessionId becomes empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { sessionId, fetchData, data } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      expect(data.value.sessionId).toBe('test-session-123')
      
      sessionId.value = ''
      await nextTick()
      
      expect(data.value.sessionId).toBe('')
      expect(data.value.timeline).toEqual([])
    })

    it('should update data when event types change', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      const { eventTypes, fetchData } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session-123/introspect', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
      
      mockFetch.mockClear()
      eventTypes.value = ['UserPromptSubmit']
      await nextTick()
      
      // Manual refetch required since watchers have immediate: false
      await fetchData()
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session-123/introspect?types=UserPromptSubmit', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
    })
  })

  describe('✅ Error Handling', () => {
    it('should handle network errors with retries', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch error'))
        .mockRejectedValueOnce(new TypeError('network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSessionResponse)
        })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(data.value.sessionId).toBe('test-session-123')
    })

    it('should clear error state on successful fetch', async () => {
      // First, cause an error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' })
      })

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()
      expect(error.value).toBe('Server error')

      // Then succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse)
      })

      await fetchData()
      expect(error.value).toBe(null)
    })
  })

  describe('✅ Edge Cases', () => {
    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Invalid JSON')
    })

    it('should handle concurrent requests to same session', async () => {
      let resolveCount = 0
      mockFetch.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolveCount++
            resolve({
              ok: true,
              json: () => Promise.resolve(mockSessionResponse)
            })
          }, 10)
        })
      })

      const { fetchData } = useSessionIntrospection('test-session-123')
      
      // Start multiple concurrent requests
      const promises = [fetchData(), fetchData(), fetchData()]
      
      await Promise.all(promises)
      
      // Should only make one actual fetch call due to concurrent request handling
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})