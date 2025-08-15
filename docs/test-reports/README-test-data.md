# Test Data Scripts

This directory contains scripts for populating and managing test data for UI validation and development.

## populate-test-agents.ts

Generates comprehensive test data including agents, events, and inter-agent messages for UI testing.

### Usage
```bash
bun run scripts/populate-test-agents.ts
```

### What it creates:
- **3 Sessions** with different scenarios:
  - `session-2024-01-15-auth-feature`: 5 agents (3 completed, 1 in_progress, 1 pending)
  - `session-2024-01-15-ui-components`: 3 agents (all completed)
  - `session-2024-01-15-database-migration`: 2 agents (1 completed, 1 in_progress)

- **10 Realistic Agents** with names like JohnSmith, SarahJones, MikeChang, etc.

- **Varied Metadata**:
  - Durations: 500ms to 120,000ms (2 minutes)
  - Token counts: 100 to 50,000 tokens
  - Tool counts: 1 to 30 tools used

- **45 Events** covering all major hook types:
  - task_started, task_completed, status_update
  - tool_usage, communication_sent

- **Inter-agent Messages** demonstrating team communication

### UI Test Scenarios Covered:
- Multiple sessions with different agent counts
- All agent statuses (pending, in_progress, completed)
- Wide range of performance metrics
- Realistic agent names and types
- Inter-agent communication examples
- Chat transcripts and summaries

## verify-test-data.ts

Verifies that test data was inserted correctly into the database.

### Usage
```bash
bun run scripts/verify-test-data.ts
```

### What it checks:
- Agent count and distribution across sessions
- Event count and type distribution
- Message count
- Data integrity validation

## Notes

- The populate script will **clear existing test data** for sessions matching the pattern `session-2024-01-15-%`
- Real production data from other sessions will be preserved
- Both scripts are safe to run multiple times
- The test data provides comprehensive edge cases for UI component testing

## Development Workflow

1. Run `populate-test-agents.ts` to create test data
2. Start the observability system with `./scripts/start-system.sh`
3. View the dashboard at http://localhost:5173 to see test scenarios
4. Use `verify-test-data.ts` to confirm data integrity
5. Reset with `populate-test-agents.ts` as needed during development