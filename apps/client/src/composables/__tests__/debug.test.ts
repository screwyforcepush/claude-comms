import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionIntrospection } from '../useSessionIntrospection'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Debug Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should debug error handling', async () => {
    console.log('Setting up mock for error case...')
    
    mockFetch.mockResolvedValueOnce({
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
    
    console.log('Mock calls:', mockFetch.mock.calls)
    
    expect(mockFetch).toHaveBeenCalled()
  })
})