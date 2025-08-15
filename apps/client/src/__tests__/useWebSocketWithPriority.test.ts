import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useWebSocketWithPriority, createWebSocketComposable } from '../composables/useWebSocketWithPriority';

// Mock the original composables
vi.mock('../composables/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    events: { value: [] },
    isConnected: { value: false },
    error: { value: null },
    ws: null
  }))
}));

vi.mock('../composables/usePriorityWebSocket', () => ({
  usePriorityWebSocket: vi.fn(() => ({
    allEvents: { value: [] },
    priorityEvents: { value: [] },
    regularEvents: { value: [] },
    eventStats: { 
      value: {
        total: 0,
        priority: 0,
        regular: 0,
        priorityPercentage: 0,
        serverSupportsPriority: true,
        protocolVersion: '1.0.0'
      }
    },
    isConnected: { value: false },
    error: { value: null },
    serverSupportsPriority: { value: true },
    protocolVersion: { value: '1.0.0' },
    clearBuckets: vi.fn(),
    getPriorityEvents: vi.fn(() => []),
    getRegularEvents: vi.fn(() => []),
    isPriorityEvent: vi.fn(() => false),
    optimizeMemoryUsage: vi.fn(),
    bucketConfig: {
      maxPriorityEvents: 200,
      maxRegularEvents: 100,
      totalDisplayLimit: 250,
      priorityOverflowStrategy: 'remove_oldest_regular',
      enablePriorityIndicators: true
    }
  }))
}));

describe('useWebSocketWithPriority', () => {
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...import.meta.env };
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(originalEnv).forEach(key => {
      (import.meta.env as any)[key] = originalEnv[key];
    });
  });

  describe('Environment Variable Control', () => {
    it('should use legacy WebSocket when priority mode is disabled', async () => {
      // Mock environment variable
      (import.meta.env as any).VITE_DISABLE_PRIORITY_WEBSOCKET = 'true';
      
      const { useWebSocket } = await import('../composables/useWebSocket');
      const mockUseWebSocket = useWebSocket as any;
      
      mockUseWebSocket.mockReturnValue({
        events: { value: [{ id: 1, hook_event_type: 'test' }] },
        isConnected: { value: true },
        error: { value: null },
        ws: {}
      });

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(mockUseWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream');
      expect(result.serverSupportsPriority.value).toBe(false);
      expect(result.eventStats.value.serverSupportsPriority).toBe(false);
    });

    it('should force priority WebSocket when enabled by environment', async () => {
      // Mock environment variable
      (import.meta.env as any).VITE_FORCE_PRIORITY_WEBSOCKET = 'true';
      
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(mockUsePriorityWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream', undefined);
    });

    it('should default to priority WebSocket with fallback', async () => {
      // Ensure no environment variables are set
      delete (import.meta.env as any).VITE_DISABLE_PRIORITY_WEBSOCKET;
      delete (import.meta.env as any).VITE_FORCE_PRIORITY_WEBSOCKET;
      
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(mockUsePriorityWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream', undefined);
    });
  });

  describe('Legacy Mode Compatibility', () => {
    beforeEach(() => {
      (import.meta.env as any).VITE_DISABLE_PRIORITY_WEBSOCKET = 'true';
    });

    it('should provide priority-compatible interface for legacy mode', async () => {
      const { useWebSocket } = await import('../composables/useWebSocket');
      const mockUseWebSocket = useWebSocket as any;
      
      const mockEvents = [
        { id: 1, hook_event_type: 'test1', priority: 1 },
        { id: 2, hook_event_type: 'test2', priority: 0 },
        { id: 3, hook_event_type: 'test3' } // no priority field
      ];
      
      mockUseWebSocket.mockReturnValue({
        events: { value: mockEvents },
        isConnected: { value: true },
        error: { value: null },
        ws: {}
      });

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(result.allEvents.value).toEqual(mockEvents);
      expect(result.priorityEvents.value).toHaveLength(1);
      expect(result.regularEvents.value).toHaveLength(2);
      expect(result.eventStats.value.total).toBe(3);
      expect(result.eventStats.value.priority).toBe(1);
      expect(result.eventStats.value.regular).toBe(2);
      expect(result.eventStats.value.serverSupportsPriority).toBe(false);
    });

    it('should handle priority utility functions in legacy mode', async () => {
      const { useWebSocket } = await import('../composables/useWebSocket');
      const mockUseWebSocket = useWebSocket as any;
      
      const mockEvents = [
        { id: 1, hook_event_type: 'priority', priority: 1 },
        { id: 2, hook_event_type: 'regular', priority: 0 }
      ];
      
      mockUseWebSocket.mockReturnValue({
        events: { value: mockEvents },
        isConnected: { value: true },
        error: { value: null },
        ws: {}
      });

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(result.getPriorityEvents()).toHaveLength(1);
      expect(result.getRegularEvents()).toHaveLength(1);
      expect(result.isPriorityEvent(mockEvents[0])).toBe(true);
      expect(result.isPriorityEvent(mockEvents[1])).toBe(false);
      
      // Clear buckets should clear the events array
      result.clearBuckets();
      expect(mockEvents).toHaveLength(0);
    });

    it('should provide safe bucket configuration in legacy mode', async () => {
      const { useWebSocket } = await import('../composables/useWebSocket');
      const mockUseWebSocket = useWebSocket as any;
      
      mockUseWebSocket.mockReturnValue({
        events: { value: [] },
        isConnected: { value: true },
        error: { value: null },
        ws: {}
      });

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(result.bucketConfig).toEqual({
        maxPriorityEvents: 200,
        maxRegularEvents: 100,
        totalDisplayLimit: 250,
        priorityOverflowStrategy: 'remove_oldest_regular',
        enablePriorityIndicators: false // Disabled in legacy mode
      });
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should fallback to legacy WebSocket when priority WebSocket throws', async () => {
      // Mock priority WebSocket to throw
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;
      mockUsePriorityWebSocket.mockImplementation(() => {
        throw new Error('Priority WebSocket not supported');
      });

      const { useWebSocket } = await import('../composables/useWebSocket');
      const mockUseWebSocket = useWebSocket as any;
      mockUseWebSocket.mockReturnValue({
        events: { value: [] },
        isConnected: { value: true },
        error: { value: null },
        ws: {}
      });

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(mockUseWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream');
      expect(result.serverSupportsPriority.value).toBe(false);
      expect(result.eventStats.value.serverSupportsPriority).toBe(false);
    });

    it('should handle fallback gracefully with empty priority buckets', async () => {
      // Mock priority WebSocket to throw
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;
      mockUsePriorityWebSocket.mockImplementation(() => {
        throw new Error('Priority WebSocket not supported');
      });

      const { useWebSocket } = await import('../composables/useWebSocket');
      const mockUseWebSocket = useWebSocket as any;
      mockUseWebSocket.mockReturnValue({
        events: { value: [{ id: 1, hook_event_type: 'test' }] },
        isConnected: { value: true },
        error: { value: null },
        ws: {}
      });

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      expect(result.priorityEvents.value).toHaveLength(0);
      expect(result.regularEvents.value).toHaveLength(1);
      expect(result.getPriorityEvents()).toHaveLength(0);
      expect(result.isPriorityEvent({})).toBe(false);
    });
  });

  describe('Factory Function', () => {
    it('should create WebSocket composable through factory function', async () => {
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;

      const config = { maxPriorityEvents: 150 };
      const result = createWebSocketComposable('ws://localhost:4000/stream', config);

      expect(mockUsePriorityWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream', config);
    });
  });

  describe('Configuration Passing', () => {
    it('should pass configuration to priority WebSocket', async () => {
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;

      const config = {
        maxPriorityEvents: 150,
        maxRegularEvents: 75,
        totalDisplayLimit: 200,
        priorityOverflowStrategy: 'strict_limits' as const,
        enablePriorityIndicators: false
      };

      const result = useWebSocketWithPriority('ws://localhost:4000/stream', config);

      expect(mockUsePriorityWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream', config);
    });

    it('should handle partial configuration correctly', async () => {
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;

      const partialConfig = {
        maxPriorityEvents: 100
      };

      const result = useWebSocketWithPriority('ws://localhost:4000/stream', partialConfig);

      expect(mockUsePriorityWebSocket).toHaveBeenCalledWith('ws://localhost:4000/stream', partialConfig);
    });
  });

  describe('Interface Consistency', () => {
    it('should provide consistent interface regardless of mode', async () => {
      const { usePriorityWebSocket } = await import('../composables/usePriorityWebSocket');
      const mockUsePriorityWebSocket = usePriorityWebSocket as any;

      const result = useWebSocketWithPriority('ws://localhost:4000/stream');

      // Check that all expected properties exist
      expect(result).toHaveProperty('allEvents');
      expect(result).toHaveProperty('priorityEvents');
      expect(result).toHaveProperty('regularEvents');
      expect(result).toHaveProperty('eventStats');
      expect(result).toHaveProperty('isConnected');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('serverSupportsPriority');
      expect(result).toHaveProperty('protocolVersion');
      expect(result).toHaveProperty('clearBuckets');
      expect(result).toHaveProperty('getPriorityEvents');
      expect(result).toHaveProperty('getRegularEvents');
      expect(result).toHaveProperty('isPriorityEvent');
      expect(result).toHaveProperty('optimizeMemoryUsage');
      expect(result).toHaveProperty('bucketConfig');

      // Check that functions are callable
      expect(typeof result.clearBuckets).toBe('function');
      expect(typeof result.getPriorityEvents).toBe('function');
      expect(typeof result.getRegularEvents).toBe('function');
      expect(typeof result.isPriorityEvent).toBe('function');
      expect(typeof result.optimizeMemoryUsage).toBe('function');
    });
  });
});