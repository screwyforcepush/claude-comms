import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useSessionIntrospection } from '../useSessionIntrospection'
import type { SessionIntrospectionResponse, SessionTimelineMessage } from '../../types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Test data fixtures
const mockSessionTimelineMessage: SessionTimelineMessage = {
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

const mockAgentTaskMessage: SessionTimelineMessage = {
  id: 2,
  type: 'orchestrator_message',
  role: 'Orchestrator',
  timestamp: 1692728450000,
  content: {
    agent_name: 'TestAgent',
    task_description: 'Implement the new feature',
    agent_type: 'engineer'
  },
  source_event: {
    hook_event_type: 'SubagentStart',
    payload: {
      agent_name: 'TestAgent',
      task_description: 'Implement the new feature',
      agent_type: 'engineer'
    }
  }
}

const mockAgentResponseMessage: SessionTimelineMessage = {
  id: 3,
  type: 'agent_message',
  role: 'Agent',
  timestamp: 1692728500000,
  content: {
    agent_name: 'TestAgent',
    response: 'Feature has been implemented successfully'
  },
  source_event: {
    hook_event_type: 'SubagentComplete',
    payload: {
      agent_name: 'TestAgent',
      response: 'Feature has been implemented successfully'
    }
  }
}

const mockSessionIntrospectionResponse: SessionIntrospectionResponse = {
  sessionId: 'test-session-123',
  timeline: [mockSessionTimelineMessage, mockAgentTaskMessage, mockAgentResponseMessage],
  messageCount: 3,
  timeRange: {
    start: 1692728400000,
    end: 1692728500000,
    duration: 100000
  }
}

describe('useSessionIntrospection', () => {
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

  describe('Composable Initialization', () => {
    it('should initialize with default reactive state', () => {
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

    it('should accept sessionId parameter', () => {
      const { sessionId } = useSessionIntrospection('test-session-123')
      expect(sessionId.value).toBe('test-session-123')
    })

    it('should return expected interface', () => {
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

  describe('Data Fetching', () => {
    it('should fetch data from correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const { fetchData } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session-123/introspect', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
    })

    it('should handle sessionId changes reactively', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const { sessionId, data, fetchData } = useSessionIntrospection()
      
      // Change sessionId
      sessionId.value = 'new-session-456'
      await nextTick()
      
      // Manual fetch required since watchers have immediate: false
      await fetchData()
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/new-session-456/introspect', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
    })

    it('should support event type filtering', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
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

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValueOnce(fetchPromise)

      const { fetchData, loading } = useSessionIntrospection('test-session-123')
      
      const fetchTask = fetchData()
      
      expect(loading.value).toBe(true)
      
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })
      
      await fetchTask
      expect(loading.value).toBe(false)
    })

    it('should handle successful API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const { fetchData, data, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(data.value.sessionId).toBe('test-session-123')
      expect(data.value.timeline).toHaveLength(3)
      expect(data.value.messageCount).toBe(3)
      expect(error.value).toBe(null)
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Session not found' })
      })

      const { fetchData, error, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Session not found')
      expect(data.value.timeline).toEqual([])
    })

    it('should retry on network failures up to 3 times', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSessionIntrospectionResponse)
        })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(data.value.sessionId).toBe('test-session-123')
    })

    it('should fail after 3 retry attempts', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(error.value).toContain('Network error')
    })
  })

  describe('Data Transformation', () => {
    it('should transform SessionTimelineMessage to TimelineMessage format', () => {
      const { transformMessage } = useSessionIntrospection()
      const result = transformMessage(mockSessionTimelineMessage)

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

    it('should extract agent tasks from SubagentStart events', () => {
      const { transformMessage } = useSessionIntrospection()
      const result = transformMessage(mockAgentTaskMessage)

      expect(result).toEqual({
        id: 2,
        type: 'orchestrator_task',
        timestamp: 1692728450000,
        content: 'Implement the new feature',
        metadata: {
          session_id: undefined,
          agent_name: 'TestAgent',
          agent_type: 'engineer',
          hook_event_type: 'SubagentStart'
        }
      })
    })

    it('should extract agent responses from SubagentComplete events', () => {
      const { transformMessage } = useSessionIntrospection()
      const result = transformMessage(mockAgentResponseMessage)

      expect(result).toEqual({
        id: 3,
        type: 'agent_response',
        timestamp: 1692728500000,
        content: 'Feature has been implemented successfully',
        metadata: {
          session_id: undefined,
          agent_name: 'TestAgent',
          hook_event_type: 'SubagentComplete'
        }
      })
    })

    it('should handle missing/optional fields gracefully', () => {
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

    it('should preserve timestamps and metadata', () => {
      const { transformMessage } = useSessionIntrospection()
      const messageWithMetadata: SessionTimelineMessage = {
        ...mockSessionTimelineMessage,
        content: {
          ...mockSessionTimelineMessage.content,
          session_id: 'test-session-123',
          custom_field: 'custom_value'
        }
      }

      const result = transformMessage(messageWithMetadata)

      expect(result.timestamp).toBe(1692728400000)
      expect(result.metadata?.session_id).toBe('test-session-123')
      expect(result.metadata?.hook_event_type).toBe('UserPromptSubmit')
    })

    it('should sort messages chronologically', async () => {
      const unorderedResponse = {
        ...mockSessionIntrospectionResponse,
        timeline: [mockAgentResponseMessage, mockSessionTimelineMessage, mockAgentTaskMessage]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(unorderedResponse)
      })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      const transformedTimeline = data.value.timeline
      expect(transformedTimeline[0].timestamp).toBeLessThanOrEqual(transformedTimeline[1].timestamp)
      expect(transformedTimeline[1].timestamp).toBeLessThanOrEqual(transformedTimeline[2].timestamp)
    })
  })

  describe('Caching & State Management', () => {
    it('should cache responses for 5 minutes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const { fetchData } = useSessionIntrospection('test-session-123')
      
      // First fetch
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Second fetch within cache window
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1) // No additional call due to cache
    })

    it('should return cached data when available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      const firstData = data.value
      
      await fetchData()
      const secondData = data.value
      
      expect(firstData).toEqual(secondData)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should refresh cache on manual refresh()', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const { fetchData, refresh } = useSessionIntrospection('test-session-123')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      await refresh()
      expect(mockFetch).toHaveBeenCalledTimes(2) // Cache bypassed
    })

    it('should invalidate cache on sessionId change', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
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

    it('should handle concurrent requests to same session', async () => {
      let resolveCount = 0
      const delays = [100, 50, 200]
      
      mockFetch.mockImplementation(() => {
        const delay = delays[resolveCount++]
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve(mockSessionIntrospectionResponse)
            })
          }, delay)
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

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'))

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Network connection failed')
    })

    it('should handle 404 (session not found)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Session not found' })
      })

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Session not found')
    })

    it('should handle 400 (invalid parameters)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid event types' })
      })

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Invalid event types')
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const { fetchData, error } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Invalid JSON')
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
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      await fetchData()
      expect(error.value).toBe(null)
    })

    it('should maintain error boundaries', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockFetch.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const { fetchData, error, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(error.value).toBe('Unexpected error')
      expect(data.value.timeline).toEqual([]) // Should maintain safe state
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Reactive Updates', () => {
    it('should update data when sessionId changes', async () => {
      const response1 = { ...mockSessionIntrospectionResponse, sessionId: 'session-1' }
      const response2 = { ...mockSessionIntrospectionResponse, sessionId: 'session-2' }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(response1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(response2)
        })

      const { sessionId, data, fetchData } = useSessionIntrospection('session-1')
      await fetchData()
      
      expect(data.value.sessionId).toBe('session-1')
      
      sessionId.value = 'session-2'
      await nextTick()
      
      // Manual refetch required since watchers have immediate: false
      await fetchData()
      expect(data.value.sessionId).toBe('session-2')
    })

    it('should update data when event types filter changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
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

    it('should trigger loading states appropriately', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue(fetchPromise)

      const { sessionId, loading, fetchData } = useSessionIntrospection('test-session-123')
      
      expect(loading.value).toBe(false)
      
      sessionId.value = 'new-session'
      await nextTick()
      
      // Manual fetch required since watchers have immediate: false
      const fetchTask = fetchData()
      expect(loading.value).toBe(true)
      
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })
      
      await fetchTask
      expect(loading.value).toBe(false)
    })

    it('should maintain reactivity across component lifecycle', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionIntrospectionResponse)
      })

      const sessionIdRef = ref('test-session-123')
      const { data, sessionId, fetchData } = useSessionIntrospection(sessionIdRef)
      
      await fetchData()
      expect(data.value.sessionId).toBe('test-session-123')
      
      // Simulate external sessionId change
      sessionIdRef.value = 'new-session'
      await nextTick()
      
      expect(sessionId.value).toBe('new-session')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty session (no events)', async () => {
      const emptyResponse: SessionIntrospectionResponse = {
        sessionId: 'empty-session',
        timeline: [],
        messageCount: 0,
        timeRange: null
      }

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

    it('should handle very large individual messages (>1MB)', async () => {
      const largeContent = 'x'.repeat(1024 * 1024 + 1) // > 1MB
      const largeMessage: SessionTimelineMessage = {
        ...mockSessionTimelineMessage,
        content: {
          prompt: largeContent
        }
      }

      const largeResponse = {
        ...mockSessionIntrospectionResponse,
        timeline: [largeMessage]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeResponse)
      })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(data.value.timeline).toHaveLength(1)
      expect(data.value.timeline[0].content.length).toBeGreaterThan(1024 * 1024)
    })

    it('should handle events with missing required fields', async () => {
      const malformedMessage: Partial<SessionTimelineMessage> = {
        id: 999,
        // Missing type, role, timestamp
        content: { prompt: 'Test' },
        source_event: {
          hook_event_type: 'UserPromptSubmit',
          payload: {}
        }
      }

      const malformedResponse = {
        ...mockSessionIntrospectionResponse,
        timeline: [malformedMessage as SessionTimelineMessage]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(malformedResponse)
      })

      const { fetchData, data } = useSessionIntrospection('test-session-123')
      await fetchData()

      expect(data.value.timeline).toHaveLength(1)
      expect(data.value.timeline[0].type).toBe('user_prompt') // Default fallback
    })
  })
})