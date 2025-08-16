# Priority Event Bucket System - Test Plan

## Overview

This document outlines the comprehensive testing strategy for the priority event bucket system implementation. The test plan ensures data integrity, performance, and backward compatibility across all system layers.

## Test Framework Architecture

### Test-Driven Development Approach

All tests are written **BEFORE** implementation using TDD principles:
1. **Red Phase**: Write failing tests that specify expected behavior
2. **Green Phase**: Implement minimal code to make tests pass  
3. **Refactor Phase**: Optimize code while maintaining test coverage

### Test Pyramid Structure

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

## Test Suites Overview

### 1. Database Migration Tests
**File**: `apps/server/src/__tests__/priority-database-migration.test.ts`

**Purpose**: Validate schema changes, data integrity, and rollback procedures

**Key Test Categories**:
- Schema migration without data loss
- Priority value backfill for existing events
- Index creation and optimization
- Rollback and restore procedures
- Performance validation for large datasets
- Edge cases and error handling

**Critical Test Cases**:
- ✅ Add priority column without data loss
- ✅ Backfill priority values correctly (UserPromptSubmit, Notification, Stop, SubagentStop = priority 1)
- ✅ Create all required indexes for performance
- ✅ Idempotent migration (safe to run multiple times)
- ✅ Handle empty database migration
- ✅ Preserve data relationships and timestamp ordering
- ✅ Validate priority metadata format
- ✅ Handle special characters and large payloads

### 2. Server Logic Tests
**File**: `apps/server/src/__tests__/priority-server-logic.test.ts`

**Purpose**: Test priority classification, dual-bucket retrieval, and retention policies

**Key Test Categories**:
- Event priority classification
- Priority retrieval algorithms
- Session-specific queries
- Intelligent event limiting
- Performance optimization
- Error handling

**Critical Test Cases**:
- ✅ Classify priority events correctly (UserPromptSubmit, Notification, Stop, SubagentStop, SubagentComplete = priority 1)
- ✅ Return mixed priority and regular events in correct proportions
- ✅ Preserve priority events when total limit exceeded
- ✅ Apply retention windows (24h priority, 4h regular)
- ✅ Maintain timestamp ordering in results
- ✅ Filter events by session with priority awareness
- ✅ Handle concurrent queries efficiently
- ✅ Query performance <100ms for production datasets

### 3. WebSocket Protocol Tests  
**File**: `apps/server/src/__tests__/priority-websocket-protocol.test.ts`

**Purpose**: Validate protocol enhancements, backward compatibility, and real-time broadcasting

**Key Test Categories**:
- Enhanced message format
- Initial connection handling
- Backward compatibility
- Multi-session support
- Error handling and resilience
- Performance and scalability

**Critical Test Cases**:
- ✅ Broadcast priority events with enhanced metadata
- ✅ Send priority-aware initial events with statistics
- ✅ Support legacy clients without breaking changes
- ✅ Route events to subscribed sessions only
- ✅ Handle client disconnection gracefully
- ✅ Broadcast to multiple clients efficiently
- ✅ Maintain consistent message structure
- ✅ Handle large event payloads and rapid broadcasting

### 4. Client Bucket Validation Tests
**File**: `apps/client/src/__tests__/priority-bucket-validation.test.ts`

**Purpose**: Test dual-bucket management, overflow strategies, and memory optimization

**Key Test Categories**:
- Event allocation to buckets
- Overflow management strategies
- Display limiting algorithms
- Initial event loading
- Statistics and monitoring
- Memory management
- Performance optimization

**Critical Test Cases**:
- ✅ Allocate events to correct buckets by priority
- ✅ Handle bucket overflow with different strategies (remove_oldest_regular, remove_oldest_priority, strict_limits)
- ✅ Load initial events respecting bucket limits
- ✅ Calculate bucket statistics correctly
- ✅ Perform memory cleanup based on retention policies
- ✅ Handle high-frequency event additions efficiently
- ✅ Maintain performance with large event volumes
- ✅ Handle edge cases (missing timestamps, invalid priorities)

### 5. Performance Benchmarks
**File**: `apps/server/src/__tests__/priority-performance-benchmarks.test.ts`

**Purpose**: Validate query optimization, memory usage, and scalability requirements

**Key Test Categories**:
- Query performance validation
- Memory usage monitoring
- Throughput measurement
- Index effectiveness
- Resource optimization
- Database growth handling

**Critical Test Cases**:
- ✅ Meet <100ms query time requirement for priority retrieval
- ✅ Utilize database indexes for priority queries
- ✅ Scale performance with dataset size (sub-linear growth)
- ✅ Handle concurrent query load efficiently
- ✅ Maintain reasonable memory usage with large datasets
- ✅ No memory leaks with repeated queries
- ✅ High event insertion throughput (>100 events/second)
- ✅ Query throughput under load (>10 queries/second)
- ✅ Index effectiveness demonstration (>1.5x speedup)

### 6. Integration Test Foundation
**File**: `apps/server/src/__tests__/priority-integration-foundation.test.ts`

**Purpose**: End-to-end validation and Batch 2 implementation readiness

**Key Test Categories**:
- Database integration
- Server-client integration
- End-to-end priority flow
- Backward compatibility
- System validation
- Data consistency
- Error scenarios

**Critical Test Cases**:
- ✅ Integrate with migrated priority schema
- ✅ Establish WebSocket connections with priority support
- ✅ Complete full priority event lifecycle
- ✅ Maintain priority ordering in retrieval
- ✅ Handle rapid event sequences correctly
- ✅ Support legacy clients without priority features
- ✅ Pass comprehensive integration validation
- ✅ Maintain consistency between database and WebSocket broadcasts
- ✅ Handle concurrent operations without data corruption

## Test Configuration and Environment

### Server Test Setup (Bun)
```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch", 
    "test:coverage": "bun test --coverage",
    "test:priority": "bun test --match='Priority*'"
  }
}
```

### Client Test Setup (Vitest)
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:priority": "vitest --run --grep='Priority'"
  }
}
```

### Test Database Configuration
- **In-Memory Database**: For unit and integration tests
- **Test Database Copy**: Production data copy for migration testing  
- **Performance Test Database**: Large dataset for load testing

### Mock Implementations
All tests include comprehensive mock implementations that define expected interfaces:
- Database functions with priority support
- WebSocket protocol handlers
- Client bucket management
- Memory management utilities
- Performance measurement tools

## Performance Requirements

### Query Performance
- **Target**: <100ms query response time (95th percentile)
- **Load**: 10,000+ events in database
- **Concurrency**: 10+ concurrent clients
- **Throughput**: >100 events/second insertion, >10 queries/second

### Memory Performance  
- **Client Limit**: <50MB memory usage
- **Server Efficiency**: No memory leaks over extended operation
- **Cleanup**: Automatic cleanup every 60 seconds

### Scalability
- **Database Size**: Support 100,000+ events
- **Client Count**: Handle 50+ concurrent WebSocket connections
- **Event Volume**: Process 1,000+ events/minute sustained

## Quality Gates

### Code Coverage Requirements
- **Unit Tests**: >95% coverage for new priority logic
- **Integration Tests**: 100% pass rate required for merge
- **Performance Tests**: All benchmarks must meet defined criteria
- **Memory Tests**: No memory leaks detected

### Test Execution Schedule
- **Unit Tests**: Run on every commit (Git hooks)
- **Integration Tests**: Run on pull request
- **Performance Tests**: Run nightly on main branch  
- **E2E Tests**: Run before releases

### Continuous Integration
```yaml
test_priority_buckets:
  stages:
    - unit_tests
    - integration_tests
    - performance_tests
    - e2e_tests
  
  coverage_threshold: 95%
  performance_thresholds:
    query_time: 100ms
    memory_usage: 50MB
    websocket_latency: 10ms
```

## Risk-Based Testing

### High-Risk Areas (Extra Coverage)
- Database migration scripts (data integrity critical)
- Priority classification logic (business logic core)
- Memory management and cleanup (performance critical)
- WebSocket protocol changes (backward compatibility essential)

### Critical Path Testing
- End-to-end priority event preservation
- Backward compatibility with existing clients
- Performance under production-like loads
- Data consistency across all layers

### Edge Case Coverage
- Empty databases and malformed data
- Network failures and connection issues
- Very large event payloads (>50KB)
- Rapid client connect/disconnect cycles
- Concurrent access and race conditions

## Test Success Criteria

### Functional Criteria
- [ ] All priority events correctly classified and stored
- [ ] Dual-bucket retrieval works as specified
- [ ] Client bucket management handles all overflow scenarios  
- [ ] WebSocket enhancement maintains full compatibility
- [ ] Integration tests validate end-to-end workflows

### Performance Criteria  
- [ ] Query response times <100ms (95th percentile)
- [ ] Memory usage <50MB client-side limit
- [ ] WebSocket message overhead <5% increase
- [ ] Database migration completes in <30 minutes
- [ ] Throughput meets production requirements

### Quality Criteria
- [ ] >95% code coverage achieved for new functionality
- [ ] Zero critical or high-severity bugs in final testing
- [ ] All performance benchmarks consistently met
- [ ] Backward compatibility 100% verified with legacy clients
- [ ] Integration validation passes all system checks

## Implementation Readiness for Batch 2

The test framework provides validation for:

1. **Database Migration**: AdamMigrate can use migration tests to validate schema changes
2. **Server Logic**: BellaServer can implement against server logic test specifications  
3. **WebSocket Protocol**: CarlosSocket can validate protocol changes with WebSocket tests
4. **Client Implementation**: Team can use bucket validation tests for client-side features
5. **Performance Validation**: FionaMemory can use benchmark tests for optimization
6. **Integration Verification**: All components can validate against integration test foundation

Each test suite includes comprehensive mock implementations that serve as specifications for the actual implementation, ensuring consistent behavior across all system components.

## Test Artifacts Location

- **Server Tests**: `apps/server/src/__tests__/priority-*.test.ts`
- **Client Tests**: `apps/client/src/__tests__/priority-*.test.ts`  
- **Test Helpers**: `apps/*/src/__tests__/utils/`
- **Mock Data**: Generated programmatically in test files
- **Coverage Reports**: Generated in `coverage/` directories
- **Performance Reports**: Logged to console and CI artifacts

This comprehensive test plan ensures the priority event bucket system meets all requirements for data integrity, performance, and user experience while maintaining backward compatibility.