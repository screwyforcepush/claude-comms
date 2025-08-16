# Testing Strategy - Phase 11: Priority Event Buckets

## Testing Philosophy

The priority event bucket system requires comprehensive testing across database, server, and client layers to ensure data integrity, performance, and backward compatibility. Our testing strategy emphasizes early detection of issues through continuous testing and validation gates.

## Testing Scope

### Functional Testing
- Priority event classification and storage
- Dual-bucket retrieval algorithms  
- Client-side bucket management and overflow
- WebSocket protocol enhancements
- Configuration and environment variable handling

### Non-Functional Testing
- Database migration performance and safety
- Query performance with priority indexing
- Memory usage and leak detection
- WebSocket throughput and latency
- Concurrent access and race condition testing

### Compatibility Testing
- Backward compatibility with existing clients
- Cross-browser client functionality
- Multi-session priority event handling
- Database schema migration safety

## Test Pyramid Strategy

```
                    ┌─────────────────┐
                    │   E2E Tests     │ (10%)
                    │  - Full System  │
                    │  - User Journeys│
                    └─────────────────┘
                           ▲
                ┌─────────────────────────┐
                │   Integration Tests     │ (30%)
                │  - Component Interaction│  
                │  - API Contracts        │
                │  - Database Integration │
                └─────────────────────────┘
                           ▲
        ┌─────────────────────────────────────┐
        │         Unit Tests                  │ (60%)
        │  - Individual Functions             │
        │  - Priority Logic                   │
        │  - Bucket Management               │
        │  - WebSocket Message Handling      │
        └─────────────────────────────────────┘
```

## Test Categories

### 1. Database Layer Testing

#### Migration Testing
```typescript
describe('Database Migration', () => {
  test('should add priority column without data loss', async () => {
    // Setup: Create database with existing events
    // Execute: Run migration script
    // Verify: All existing events preserved, priority column added
  });
  
  test('should backfill priority values correctly', async () => {
    // Setup: Database with UserPromptSubmit, Notification, Stop events
    // Execute: Migration backfill script
    // Verify: Correct priority values assigned (1 for priority events, 0 for regular)
  });
  
  test('should create all required indexes', async () => {
    // Verify: All priority-based indexes exist and perform optimally
  });
});
```

#### Priority Storage Testing
```typescript
describe('Priority Event Storage', () => {
  test('should classify and store priority events correctly', async () => {
    const event = createTestEvent('UserPromptSubmit');
    const stored = insertEvent(event);
    expect(stored.priority).toBe(1);
    expect(stored.priority_metadata).toBeDefined();
  });
  
  test('should handle unknown event types as regular priority', async () => {
    const event = createTestEvent('UnknownEventType');
    const stored = insertEvent(event);
    expect(stored.priority).toBe(0);
  });
});
```

#### Query Performance Testing
```typescript
describe('Priority Query Performance', () => {
  test('should retrieve priority events within 100ms', async () => {
    // Setup: Database with 10,000 events (mix of priority/regular)
    const startTime = Date.now();
    const events = getRecentEventsWithPriority({ totalLimit: 100 });
    const queryTime = Date.now() - startTime;
    expect(queryTime).toBeLessThan(100);
  });
});
```

### 2. Server Layer Testing

#### Priority Retrieval Algorithm Testing
```typescript
describe('Priority Retrieval Algorithm', () => {
  test('should return mixed priority and regular events', async () => {
    // Setup: Database with both priority and regular events
    const events = getRecentEventsWithPriority({
      totalLimit: 10,
      priorityLimit: 7,
      regularLimit: 3
    });
    
    const priorityEvents = events.filter(e => e.priority > 0);
    const regularEvents = events.filter(e => e.priority === 0);
    
    expect(priorityEvents.length).toBeGreaterThan(0);
    expect(regularEvents.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(10);
  });
  
  test('should preserve priority events when total limit exceeded', async () => {
    // Setup: More events than total limit
    const events = getRecentEventsWithPriority({
      totalLimit: 5,
      priorityLimit: 10, // More priority events than total limit
      regularLimit: 5
    });
    
    // Should prioritize keeping priority events
    const priorityEvents = events.filter(e => e.priority > 0);
    expect(priorityEvents.length).toBeGreaterThan(0);
  });
});
```

#### WebSocket Enhancement Testing
```typescript
describe('WebSocket Priority Enhancement', () => {
  test('should broadcast events with priority metadata', async () => {
    const mockClient = createMockWebSocketClient();
    const priorityEvent = createTestEvent('UserPromptSubmit');
    
    insertEvent(priorityEvent); // Should trigger broadcast
    
    const message = JSON.parse(mockClient.lastMessage);
    expect(message.type).toBe('priority_event');
    expect(message.data.priority).toBe(1);
    expect(message.priority_info).toBeDefined();
  });
  
  test('should maintain backward compatibility', async () => {
    const legacyClient = createLegacyWebSocketClient();
    const event = createTestEvent('UserPromptSubmit');
    
    insertEvent(event);
    
    // Legacy client should still receive event without errors
    const message = JSON.parse(legacyClient.lastMessage);
    expect(message.data.id).toBe(event.id);
    // Should not break on additional priority fields
  });
});
```

### 3. Client Layer Testing

#### Dual-Bucket Management Testing
```typescript
describe('Dual-Bucket Management', () => {
  test('should allocate events to correct buckets', () => {
    const { allocateEvent } = usePriorityWebSocket();
    
    const priorityEvent = { ...mockEvent, priority: 1 };
    const regularEvent = { ...mockEvent, priority: 0 };
    
    allocateEvent(priorityEvent);
    allocateEvent(regularEvent);
    
    expect(priorityBucket.value).toContain(priorityEvent);
    expect(regularBucket.value).toContain(regularEvent);
  });
  
  test('should handle overflow strategies correctly', () => {
    const config = {
      maxPriorityEvents: 2,
      maxRegularEvents: 2,
      priorityOverflowStrategy: 'remove_oldest_regular'
    };
    
    // Fill buckets beyond capacity
    // Verify overflow strategy behavior
  });
});
```

#### Memory Management Testing
```typescript
describe('Memory Management', () => {
  test('should cleanup expired events', () => {
    // Setup: Events older than retention window
    // Execute: Memory cleanup
    // Verify: Old events removed, memory usage reduced
  });
  
  test('should respect memory limits', () => {
    const config = { memoryLimit: 1024 * 1024 }; // 1MB
    // Simulate high event volume
    // Verify: Memory usage stays below limit
  });
});
```

### 4. Integration Testing

#### End-to-End Priority Flow Testing
```typescript
describe('End-to-End Priority Flow', () => {
  test('should preserve priority events longer than regular events', async () => {
    // Setup: Generate mix of priority and regular events over time
    // Wait: Simulate retention window passage
    // Verify: Priority events still available, regular events cleaned up
  });
  
  test('should handle concurrent client connections', async () => {
    // Setup: Multiple WebSocket clients
    // Execute: Send priority events
    // Verify: All clients receive priority events correctly
  });
});
```

#### Multi-Session Integration Testing
```typescript
describe('Multi-Session Priority Integration', () => {
  test('should route priority events to subscribed sessions', async () => {
    // Setup: Multi-session client subscribed to specific sessions
    // Execute: Send priority events for subscribed and non-subscribed sessions
    // Verify: Only subscribed session priority events received
  });
});
```

### 5. Performance Testing

#### Load Testing
```typescript
describe('Performance Under Load', () => {
  test('should handle high event volume without degradation', async () => {
    // Generate 1000 events/second for 60 seconds
    // Measure: Query response times, memory usage, WebSocket latency
    // Verify: Performance metrics stay within acceptable bounds
  });
  
  test('should scale with multiple concurrent clients', async () => {
    // Setup: 50 concurrent WebSocket clients
    // Execute: High event volume
    // Verify: All clients receive events, no client starved
  });
});
```

#### Memory Leak Testing
```typescript
describe('Memory Leak Detection', () => {
  test('should not leak memory over extended operation', async () => {
    // Run: 24-hour simulation with event generation/cleanup
    // Monitor: Memory usage patterns
    // Verify: No continuous memory growth
  });
});
```

### 6. Compatibility Testing

#### Backward Compatibility Testing
```typescript
describe('Backward Compatibility', () => {
  test('should work with existing client code', async () => {
    // Use: Original useWebSocket composable
    // Verify: Events received correctly, no errors thrown
  });
  
  test('should migrate existing database safely', async () => {
    // Setup: Database with existing production-like data
    // Execute: Migration
    // Verify: No data loss, application continues functioning
  });
});
```

## Test Data Management

### Test Database Setup
- **In-Memory Database**: For unit and integration tests
- **Test Database Copy**: Production data copy for migration testing
- **Performance Test Database**: Large dataset for load testing

### Test Event Generation
```typescript
export const TestEventFactory = {
  createPriorityEvent: (type: 'UserPromptSubmit' | 'Notification' | 'Stop') => ({
    source_app: 'test',
    session_id: generateTestSessionId(),
    hook_event_type: type,
    payload: generateTestPayload(),
    timestamp: Date.now()
  }),
  
  createRegularEvent: () => ({
    source_app: 'test',
    session_id: generateTestSessionId(),
    hook_event_type: 'RegularEvent',
    payload: generateTestPayload(),
    timestamp: Date.now()
  }),
  
  generateEventBatch: (count: number, priorityRatio: number = 0.3) => {
    // Generate batch with specified priority/regular ratio
  }
};
```

## Continuous Testing Strategy

### Test Execution Schedule
- **Unit Tests**: Run on every commit (Git hooks)
- **Integration Tests**: Run on pull request
- **Performance Tests**: Run nightly on main branch
- **Compatibility Tests**: Run weekly and before releases

### Quality Gates
1. **Code Coverage**: >95% for new priority logic
2. **Performance Benchmarks**: All tests must pass defined criteria
3. **Integration Tests**: 100% pass rate required for merge
4. **Memory Tests**: No memory leaks detected

### Test Reporting
- **Coverage Reports**: Generated on every test run
- **Performance Dashboards**: Track query times, memory usage trends
- **Compatibility Matrix**: Track supported client/server version combinations

## Test Environment Setup

### Local Development
```bash
# Setup test database
npm run test:db:setup

# Run unit tests
npm run test:unit

# Run integration tests  
npm run test:integration

# Run performance tests
npm run test:performance
```

### CI/CD Pipeline
```yaml
test_priority_buckets:
  stages:
    - unit_tests
    - integration_tests  
    - performance_tests
    - compatibility_tests
  
  coverage_threshold: 95%
  performance_thresholds:
    query_time: 100ms
    memory_usage: 50MB
    websocket_latency: 10ms
```

## Risk-Based Testing

### High-Risk Areas (Extra Test Coverage)
- Database migration scripts
- Priority classification logic
- Memory management and cleanup
- WebSocket protocol changes

### Critical Path Testing
- End-to-end priority event preservation
- Backward compatibility with existing clients
- Performance under production-like loads

### Edge Case Testing
- Empty databases
- Very large event payloads
- Network connection failures
- Rapid client connect/disconnect cycles

## Test Success Criteria

### Functional Criteria
- [ ] All priority events correctly classified and stored
- [ ] Dual-bucket retrieval works as specified
- [ ] Client bucket management handles all overflow scenarios
- [ ] WebSocket enhancement maintains compatibility

### Performance Criteria
- [ ] Query response times <100ms (95th percentile)
- [ ] Memory usage <50MB client-side limit
- [ ] WebSocket message overhead <5% increase
- [ ] Database migration completes in <30 minutes

### Quality Criteria
- [ ] >95% code coverage achieved
- [ ] Zero critical or high-severity bugs in final testing
- [ ] All performance benchmarks met
- [ ] Backward compatibility 100% verified