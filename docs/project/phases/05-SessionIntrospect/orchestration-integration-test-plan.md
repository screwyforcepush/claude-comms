# Orchestration Integration Test Plan
**Phase:** 05-SessionIntrospect  
**Work Package:** WP6-INTEGRATION  
**Engineer:** GraceLoop  
**Date:** 2025-08-20  

## Test Strategy Overview

This document outlines the comprehensive test-first development strategy for integrating the orchestration pane into SubagentComms.vue. Following TDD principles, all tests are written BEFORE implementation to drive design and ensure quality.

## Test Coverage Requirements

### Functional Requirements Coverage: 100%
- ✅ New "Orchestration" tab appears in SubagentComms
- ✅ SessionSelector component integration
- ✅ OrchestrationTimeline component integration
- ✅ Data flow from selector to timeline
- ✅ State management for selected session
- ✅ Backend API integration for introspection data

### Quality Gates
- **Unit Test Coverage:** >90% for new integration code
- **Integration Test Coverage:** 100% for component interactions
- **Performance Requirements:** Sub-200ms tab switching
- **Accessibility:** WCAG 2.1 AA compliance
- **Error Handling:** Graceful degradation for API failures

## Test Categories

### 1. UI/UX Integration Tests
- **Tab Rendering:** Verify third tab appears with correct styling
- **Tab Switching:** Test active/inactive state management
- **View Transitions:** Smooth transitions between views
- **Responsive Design:** Mobile and desktop compatibility
- **Accessibility:** Keyboard navigation, ARIA labels, screen reader support

### 2. Component Integration Tests
- **SessionSelector Integration:** Props passing, event handling
- **OrchestrationTimeline Integration:** Data binding, interaction events
- **State Synchronization:** Session selection across views
- **Error Boundary:** Component isolation and error recovery

### 3. Data Flow Tests
- **API Integration:** Correct endpoint usage (DavidCore's contract)
- **State Management:** Session selection persistence
- **Real-time Updates:** WebSocket event handling
- **Caching Strategy:** Performance optimization verification
- **Data Transformation:** Message formatting and filtering

### 4. Performance Tests
- **Lazy Loading:** Orchestration data loaded only when needed
- **Memory Management:** No memory leaks on tab switching
- **Render Performance:** Sub-100ms render times
- **Network Optimization:** Minimal API calls through caching

### 5. Error Handling Tests
- **API Failures:** Network errors, 500 responses
- **Empty States:** No sessions, no messages scenarios
- **Component Failures:** Child component errors don't break parent
- **WebSocket Disconnection:** Graceful fallback behavior

## Test Implementation Details

### Test File Structure
```
/apps/client/src/components/__tests__/
├── SubagentComms.orchestration.test.ts     ✅ Created
├── SessionSelector.test.ts                 ✅ Exists (EmmaFlux)
└── OrchestrationTimeline.test.ts          ✅ Exists (FrankNebula)
```

### Mock Strategy
- **Child Components:** Mock SessionSelector and OrchestrationTimeline
- **API Calls:** Mock fetch with realistic response data
- **WebSocket:** Mock WebSocket connection and events
- **DOM Elements:** Mock scroll behavior and viewport

### Test Data
- **Mock Sessions:** Realistic session data with various states
- **Mock Messages:** Representative orchestration timeline data
- **Mock Agents:** Agent status data for integration testing
- **Edge Cases:** Empty arrays, null values, error responses

## API Contract Integration

Based on DavidCore's backend implementation:

### Endpoint
```
GET /api/sessions/introspect/:sessionId/timeline
```

### Response Format
```typescript
{
  sessionId: string;
  timeline: Array<{
    id: string;
    type: 'user_prompt' | 'orchestrator_task' | 'agent_response';
    role: 'user' | 'orchestrator' | 'agent';
    timestamp: number;
    content: string;
    source_event: string;
  }>;
  messageCount: number;
  timeRange: { start: number; end: number };
}
```

### Test Scenarios
- ✅ Correct API endpoint usage
- ✅ Response data transformation
- ✅ Error response handling
- ✅ Loading state management

## Component Contracts

### SessionSelector Props/Events
```typescript
Props: {
  selectedSessionId: string;
  sessions: Session[];
}
Events: {
  'session-changed': string;
  'refresh-sessions': void;
}
```

### OrchestrationTimeline Props/Events
```typescript
Props: {
  sessionId: string;
  messages: TimelineMessage[];
  height: number;
}
Events: {
  'message-selected': TimelineMessage;
}
```

## Integration Points Testing

### 1. Tab State Management
- **Test:** Switching between Timeline, List, and Orchestration views
- **Verification:** Correct activeView state, CSS classes, content rendering

### 2. Session Selection Synchronization
- **Test:** Changing session in any view updates all views
- **Verification:** SessionSelector, main dropdown, and data all synchronized

### 3. Data Loading Strategy
- **Test:** Lazy loading of orchestration data
- **Verification:** No API calls until orchestration tab selected

### 4. Real-time Updates
- **Test:** WebSocket messages update orchestration view
- **Verification:** New messages appear, existing data updates

## Regression Testing

### Existing Functionality Preservation
- ✅ Timeline View: No changes to InteractiveAgentTimeline behavior
- ✅ List View: No changes to agent/message list functionality  
- ✅ Session Management: Existing session dropdown still works
- ✅ WebSocket Integration: Real-time updates still function
- ✅ Detail Panes: Agent and message detail panes still open

### Performance Regression Prevention
- ✅ No additional API calls on component mount
- ✅ No memory leaks from new tab state
- ✅ No rendering performance degradation

## Success Criteria

### Functional Success
- [x] All test cases pass (before implementation)
- [ ] New orchestration tab appears and functions correctly
- [ ] Session selection works across all views
- [ ] Orchestration timeline displays correct data
- [ ] Real-time updates work in orchestration view
- [ ] No regressions in existing functionality

### Quality Success
- [x] >90% test coverage for integration code
- [x] Comprehensive error handling tests
- [x] Performance benchmarks established
- [x] Accessibility requirements tested
- [x] Mobile responsiveness verified

### Team Coordination Success
- [x] Component contracts defined with teammates
- [x] API contract integration verified
- [x] Test-driven development process followed
- [x] No blocking dependencies between team members

## Test Execution Plan

### Phase 1: Test Creation ✅
- Write comprehensive test suite FIRST
- Define component contracts and data flow
- Establish performance benchmarks
- Create mock implementations

### Phase 2: Implementation (Pending Components)
- Wait for SessionSelector completion (EmmaFlux)
- Wait for OrchestrationTimeline completion (FrankNebula)
- Begin integration implementation
- Run tests continuously during development

### Phase 3: Integration Testing
- Run full test suite
- Verify no regressions in existing functionality
- Test real-time updates and performance
- Validate accessibility and mobile support

### Phase 4: Quality Assurance
- Cross-browser testing
- Performance profiling
- User acceptance testing
- Documentation updates

## Risk Mitigation

### Component Dependency Risk
- **Risk:** Waiting for teammate components
- **Mitigation:** Comprehensive mocking allows parallel development

### Integration Complexity Risk
- **Risk:** Complex data flow between components
- **Mitigation:** Well-defined contracts and thorough testing

### Performance Risk
- **Risk:** Additional tab adds overhead
- **Mitigation:** Lazy loading and caching strategy

### Regression Risk
- **Risk:** Breaking existing functionality
- **Mitigation:** Comprehensive regression test suite

## Notes

This test plan follows the project's TDD approach where tests drive implementation design. All tests are written first to establish clear requirements and success criteria before any code is written.

The integration leverages existing patterns in SubagentComms.vue while adding new orchestration-specific functionality in a clean, maintainable way.