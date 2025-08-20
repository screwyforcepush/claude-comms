import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionIntrospection } from '../useSessionIntrospection'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Debug Test 2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should debug error handling with persistent mock', async () => {
    console.log('Setting up persistent mock for error case...')
    
    // Use mockResolvedValue instead of mockResolvedValueOnce to persist across retries
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Session not found' })
    })

    console.log('Creating composable...')
    const { fetchData, error, loading } = useSessionIntrospection('test-session')
    
    console.log('Initial state:', { error: error.value, loading: loading.value })
    
    console.log('Calling fetchData...')
    await fetchData()
    
    console.log('After fetchData:', { 
      error: error.value, 
      loading: loading.value,
      fetchCalled: mockFetch.mock.calls.length 
    })
    
    expect(error.value).toBe('Session not found')
  })
})