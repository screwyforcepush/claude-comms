# Sessions Tab Implementation Patterns

**Author:** ArchOwl  
**Date:** 2025-08-13  
**Status:** Active Guidance  
**Version:** 1.0  

## Critical Implementation Patterns

### 1. Data Flow Architecture

#### Server to Client Data Transformation
```typescript
// Server-side transformation (apps/server/src/sessions.ts)
function transformToSessionData(rows: SubagentRow[]): SessionData {
  return {
    sessionId: rows[0].session_id,
    displayName: `Session ${rows[0].session_id.slice(0, 8)}`,
    startTime: Math.min(...rows.map(r => r.created_at)),
    endTime: rows.every(r => r.completed_at) 
      ? Math.max(...rows.map(r => r.completed_at)) 
      : undefined,
    status: deriveSessionStatus(rows),
    agents: rows.map(transformToAgent),
    messages: [], // Populated from subagent_messages
    agentCount: rows.length
  };
}
```

#### Client-side Data Adapter
```typescript
// apps/client/src/composables/useMultiSessionData.ts
export function useMultiSessionData() {
  const rawData = ref<any[]>([]);
  const sessionData = computed(() => 
    rawData.value.map(adaptServerResponse)
  );
  
  // Adapter function
  function adaptServerResponse(response: any): SessionData {
    // Transform server response to component expectations
    return {
      sessionId: response.session_id,
      displayName: response.name || `Session ${response.session_id.slice(0, 8)}`,
      startTime: response.created_at,
      endTime: response.completed_at,
      status: mapStatus(response.status),
      agents: response.agents || [],
      messages: response.messages || [],
      agentCount: response.agent_count || 0
    };
  }
}
```

### 2. WebSocket Integration Pattern

#### Extend Existing WebSocket
```typescript
// apps/client/src/composables/useSessionWebSocket.ts
import { useWebSocket } from './useWebSocket';

export function useSessionWebSocket() {
  const { ws, isConnected, events } = useWebSocket('ws://localhost:4000/stream');
  
  // Filter for session-specific events
  const sessionEvents = computed(() => 
    events.value.filter(e => 
      e.hook_event_type === 'agent_status_update' ||
      e.hook_event_type === 'subagent_registered'
    )
  );
  
  // Subscribe to specific sessions
  function subscribeToSessions(sessionIds: string[]) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'subscribe_sessions',
        sessionIds
      }));
    }
  }
  
  return {
    sessionEvents,
    subscribeToSessions,
    isConnected
  };
}
```

### 3. Performance Optimization Patterns

#### Virtual Scrolling Implementation
```typescript
// apps/client/src/composables/useVirtualScroll.ts
export function useVirtualScroll(
  items: Ref<SessionData[]>,
  itemHeight: number = 80
) {
  const scrollTop = ref(0);
  const viewportHeight = ref(600);
  const overscan = 2;
  
  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / itemHeight);
    const end = Math.ceil((scrollTop.value + viewportHeight.value) / itemHeight);
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.value.length, end + overscan)
    };
  });
  
  const visibleItems = computed(() => 
    items.value.slice(visibleRange.value.start, visibleRange.value.end)
  );
  
  const offsetY = computed(() => 
    visibleRange.value.start * itemHeight
  );
  
  return {
    visibleItems,
    offsetY,
    totalHeight: computed(() => items.value.length * itemHeight)
  };
}
```

#### GPU-Accelerated Pan/Zoom
```typescript
// Use transform for GPU acceleration
function applyTransform(element: HTMLElement, x: number, y: number, scale: number) {
  element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  element.style.willChange = 'transform';
}

// Use requestAnimationFrame for smooth animations
function animatePan(targetX: number, targetY: number) {
  let rafId: number;
  const animate = () => {
    currentX += (targetX - currentX) * 0.1;
    currentY += (targetY - currentY) * 0.1;
    
    applyTransform(element, currentX, currentY, zoomLevel);
    
    if (Math.abs(targetX - currentX) > 0.1) {
      rafId = requestAnimationFrame(animate);
    }
  };
  
  rafId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(rafId);
}
```

### 4. Cache Strategy Implementation

#### Two-Tier Cache Pattern
```typescript
// apps/client/src/composables/useSessionCache.ts
export function useSessionCache() {
  // Hot cache - reactive Vue refs
  const hotCache = ref<Map<string, SessionData>>(new Map());
  const HOT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  
  // Warm cache - IndexedDB
  const warmCacheDB = ref<IDBDatabase>();
  const WARM_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  async function get(sessionId: string): Promise<SessionData | null> {
    // Check hot cache first
    const hot = hotCache.value.get(sessionId);
    if (hot && Date.now() - hot.lastFetched < HOT_CACHE_TTL) {
      return hot;
    }
    
    // Check warm cache
    const warm = await getFromIndexedDB(sessionId);
    if (warm && Date.now() - warm.lastFetched < WARM_CACHE_TTL) {
      // Promote to hot cache
      hotCache.value.set(sessionId, warm);
      return warm;
    }
    
    // Cache miss - fetch from server
    return null;
  }
  
  function set(sessionId: string, data: SessionData) {
    // Update both caches
    data.lastFetched = Date.now();
    hotCache.value.set(sessionId, data);
    saveToIndexedDB(sessionId, data);
    
    // LRU eviction for hot cache
    if (hotCache.value.size > 50) {
      const oldest = Array.from(hotCache.value.entries())
        .sort((a, b) => a[1].lastFetched - b[1].lastFetched)[0];
      hotCache.value.delete(oldest[0]);
    }
  }
  
  // Stale-while-revalidate pattern
  async function getWithRevalidation(sessionId: string): Promise<SessionData> {
    const cached = await get(sessionId);
    
    if (cached) {
      // Return stale data immediately
      if (Date.now() - cached.lastFetched > HOT_CACHE_TTL / 2) {
        // Revalidate in background
        fetchFromServer(sessionId).then(fresh => set(sessionId, fresh));
      }
      return cached;
    }
    
    // No cache - fetch and wait
    const fresh = await fetchFromServer(sessionId);
    set(sessionId, fresh);
    return fresh;
  }
  
  return {
    get,
    set,
    getWithRevalidation
  };
}
```

### 5. Memory Management Patterns

#### WeakMap for Metadata
```typescript
// Use WeakMap to allow garbage collection
const sessionMetadata = new WeakMap<SessionData, MetadataType>();

function attachMetadata(session: SessionData, metadata: MetadataType) {
  sessionMetadata.set(session, metadata);
}

// Metadata will be automatically garbage collected when session is removed
```

#### Cleanup Pattern
```typescript
// Proper cleanup in components
onUnmounted(() => {
  // Clear timers
  clearTimeout(tooltipTimer);
  clearInterval(refreshTimer);
  
  // Remove event listeners
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('mousemove', handleMouseMove);
  
  // Cancel animation frames
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // Close WebSocket subscriptions
  unsubscribeFromSessions();
  
  // Clear large data structures
  sessionCache.clear();
  visibleSessions.value = [];
});
```

### 6. API Endpoint Patterns

#### Batch Operations
```typescript
// Server-side batch endpoint
app.post('/api/sessions/batch', async (req, res) => {
  const { sessionIds, includeAgents, includeMessages } = req.body;
  
  // Use IN clause for efficient batch query
  const query = db.prepare(`
    SELECT * FROM subagent_registry 
    WHERE session_id IN (${sessionIds.map(() => '?').join(',')})
    ORDER BY session_id, created_at
  `);
  
  const results = query.all(...sessionIds);
  
  // Group by session
  const grouped = results.reduce((acc, row) => {
    if (!acc[row.session_id]) {
      acc[row.session_id] = [];
    }
    acc[row.session_id].push(row);
    return acc;
  }, {});
  
  // Transform to response format
  const sessions = Object.entries(grouped).map(([id, agents]) => 
    transformToSessionData(agents)
  );
  
  res.json(sessions);
});
```

#### Window Query Pattern
```typescript
// Efficient time window query
app.get('/api/sessions/window', async (req, res) => {
  const { start, end, limit = 50 } = req.query;
  
  const query = db.prepare(`
    WITH session_summary AS (
      SELECT 
        session_id,
        MIN(created_at) as start_time,
        MAX(completed_at) as end_time,
        COUNT(*) as agent_count,
        MAX(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as is_active
      FROM subagent_registry
      WHERE created_at BETWEEN ? AND ?
      GROUP BY session_id
    )
    SELECT * FROM session_summary
    ORDER BY start_time DESC
    LIMIT ?
  `);
  
  const sessions = query.all(start, end, limit);
  res.json(sessions);
});
```

## Testing Patterns

### Performance Testing
```typescript
// Test virtual scrolling performance
describe('Virtual Scrolling Performance', () => {
  it('maintains 60fps with 20 sessions', async () => {
    const sessions = generateMockSessions(20);
    const { visibleItems } = useVirtualScroll(ref(sessions));
    
    const frameTimings: number[] = [];
    let lastTime = performance.now();
    
    // Simulate scrolling
    for (let i = 0; i < 100; i++) {
      scrollTop.value = i * 10;
      await nextTick();
      
      const currentTime = performance.now();
      frameTimings.push(currentTime - lastTime);
      lastTime = currentTime;
    }
    
    const avgFrameTime = frameTimings.reduce((a, b) => a + b) / frameTimings.length;
    expect(avgFrameTime).toBeLessThan(16.67); // 60fps = 16.67ms per frame
  });
});
```

### Memory Leak Testing
```typescript
// Test for memory leaks
describe('Memory Management', () => {
  it('cleans up properly on unmount', async () => {
    const initialMemory = performance.memory?.usedJSHeapSize;
    
    // Mount and unmount component multiple times
    for (let i = 0; i < 10; i++) {
      const wrapper = mount(SessionsView, {
        props: { sessions: generateMockSessions(50) }
      });
      
      await nextTick();
      wrapper.unmount();
    }
    
    // Force garbage collection if available
    if (global.gc) global.gc();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const finalMemory = performance.memory?.usedJSHeapSize;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Should not leak more than 10MB
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

## Critical Success Factors

1. **Data Consistency**: Ensure server and client data models align perfectly
2. **Real-time Performance**: Maintain 60fps with 10 sessions, 30fps with 20
3. **Memory Budget**: Stay under 500MB total memory usage
4. **Cache Hit Rate**: Achieve >70% cache hit rate for better performance
5. **WebSocket Stability**: Handle reconnections gracefully without data loss
6. **Virtual Scrolling**: Activate at exactly 20 sessions threshold

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Memory leaks from event listeners | Use WeakMap, proper cleanup in onUnmounted |
| Performance degradation | Virtual scrolling, progressive rendering |
| WebSocket instability | Reconnection logic, message queuing |
| Cache inconsistency | TTL-based invalidation, versioning |
| Browser compatibility | Feature detection, polyfills |

## Next Steps

1. BackendBison: Implement /api/sessions/window and /api/sessions/batch endpoints
2. DataDolphin: Create useMultiSessionData composable with cache integration
3. UIUnicorn: Implement GPU-accelerated pan/zoom with requestAnimationFrame
4. TestTiger: Create performance and memory leak test suites
5. All: Integrate with existing WebSocket pattern, don't duplicate

---

This document provides tactical implementation patterns that align with the overall architecture. Follow these patterns to ensure consistency, performance, and maintainability.