import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  events: WebSocketEvent[];
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const { url, autoConnect = true, reconnectInterval = 3000, maxReconnectAttempts = 5 } = options;
  
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected to:', url);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Handle different message types from the server
          if (message.type === 'initial' && Array.isArray(message.data)) {
            // Initial batch of events
            const initialEvents = message.data.map((evt: any) => ({
              id: evt.id ? evt.id.toString() : crypto.randomUUID(),
              type: evt.hook_event_type || 'event',
              data: evt,
              timestamp: evt.timestamp || Date.now()
            }));
            setEvents(initialEvents.slice(-100)); // Keep last 100
          } else if (message.type === 'event' || message.type === 'priority_event') {
            // Single new event
            const wsEvent: WebSocketEvent = {
              id: message.data.id ? message.data.id.toString() : crypto.randomUUID(),
              type: message.data.hook_event_type || message.type || 'event',
              data: message.data,
              timestamp: message.data.timestamp || Date.now()
            };
            setEvents(prev => [...prev.slice(-99), wsEvent]); // Keep last 100 events
          } else {
            // Fallback for other message formats
            const wsEvent: WebSocketEvent = {
              id: crypto.randomUUID(),
              type: message.type || 'unknown',
              data: message.data || message,
              timestamp: Date.now()
            };
            setEvents(prev => [...prev.slice(-99), wsEvent]);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err, event.data);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setError(`Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Max reconnection attempts reached');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setError(null);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    events,
    isConnected,
    error,
    connect,
    disconnect,
    clearEvents
  };
};