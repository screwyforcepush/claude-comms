import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSessionIntrospection } from '../useSessionIntrospection'
import type { SessionIntrospectionResponse } from '../../types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Simple test data
const simpleResponse: SessionIntrospectionResponse = {
  sessionId: 'test-session',
  timeline: [],
  messageCount: 0,
  timeRange: null
}

describe('useSessionIntrospection - Focused Tests', () => {
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

  describe('Basic Functionality', () => {
    it('should initialize with correct default state', () => {
      const { data, loading, error, sessionId } = useSessionIntrospection()

      expect(data.value.sessionId).toBe('')
      expect(data.value.timeline).toEqual([])
      expect(data.value.messageCount).toBe(0)
      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(sessionId.value).toBe('')
    })

    it('should accept sessionId parameter', () => {
      const { sessionId } = useSessionIntrospection('test-session-123')
      expect(sessionId.value).toBe('test-session-123')
    })

    it('should manually fetch data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(simpleResponse)
      })

      const { fetchData, data, error, loading } = useSessionIntrospection('test-session')
      
      expect(loading.value).toBe(false)
      
      const fetchPromise = fetchData()
      expect(loading.value).toBe(true)
      
      await fetchPromise
      
      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
      expect(data.value.sessionId).toBe('test-session')
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session/introspect', expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }),
        cache: 'default'
      }))
    })

    it('should handle API errors properly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Session not found' })
      })

      const { fetchData, error, loading } = useSessionIntrospection('test-session')
      
      await fetchData()
      
      expect(loading.value).toBe(false)
      expect(error.value).toBe('Session not found')
    })

    it('should support event type filtering', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(simpleResponse)
      })

      const { fetchData, eventTypes } = useSessionIntrospection('test-session')
      eventTypes.value = ['UserPromptSubmit']
      
      await fetchData()

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session/introspect?types=UserPromptSubmit', expect.objectContaining({
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

    it('should clear data when sessionId becomes empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(simpleResponse)
      })

      const { sessionId, fetchData, data } = useSessionIntrospection('test-session')
      
      await fetchData()
      expect(data.value.sessionId).toBe('test-session')
      
      sessionId.value = ''
      await nextTick()
      
      expect(data.value.sessionId).toBe('')
      expect(data.value.timeline).toEqual([])
    })
  })

  describe('Data Transformation', () => {
    it('should transform basic user message correctly', () => {
      const { transformMessage } = useSessionIntrospection()
      
      const message = {
        id: 1,
        type: 'user_message' as const,
        role: 'User' as const,
        timestamp: 1692728400000,
        content: {
          prompt: 'Hello world'
        },
        source_event: {
          hook_event_type: 'UserPromptSubmit',
          payload: {}
        }
      }

      const result = transformMessage(message)

      expect(result).toEqual({
        id: 1,
        type: 'user_prompt',
        timestamp: 1692728400000,
        content: 'Hello world',
        metadata: {
          session_id: undefined,
          hook_event_type: 'UserPromptSubmit'
        }
      })
    })

    it('should handle missing content gracefully', () => {
      const { transformMessage } = useSessionIntrospection()
      
      const message = {
        id: 2,
        type: 'user_message' as const,
        role: 'User' as const,
        timestamp: 1692728400000,
        content: {},
        source_event: {
          hook_event_type: 'UserPromptSubmit',
          payload: {}
        }
      }

      const result = transformMessage(message)

      expect(result.content).toBe('No content available')
      expect(result.type).toBe('user_prompt')
    })
  })

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(simpleResponse)
      })

      const { fetchData } = useSessionIntrospection('test-session')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1) // Should use cache
    })

    it('should bypass cache on refresh', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(simpleResponse)
      })

      const { fetchData, refresh } = useSessionIntrospection('test-session')
      
      await fetchData()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      await refresh()
      expect(mockFetch).toHaveBeenCalledTimes(2) // Should bypass cache
    })
  })
})