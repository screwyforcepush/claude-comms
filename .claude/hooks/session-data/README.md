# Session Data Fetching Script

## Overview

The `get_session_data.py` script fetches comprehensive session data from the Claude Code observability API for analysis by review agents. It provides both raw and formatted output options with robust error handling.

## Features

- **Comprehensive Data Fetching**: Retrieves events, agents, messages, and metadata
- **Multiple Output Formats**: Raw JSON, formatted for review agents, or human-readable
- **Robust Error Handling**: Connection errors, timeouts, API errors, invalid responses
- **Input Validation**: Session ID format validation and sanitization
- **Review Agent Integration**: Structured output optimized for AI analysis

## Usage

```bash
# Default output (formatted for review agent consumption)
python get_session_data.py --session-id session-123

# Raw JSON output
python get_session_data.py --session-id session-123 --json

# Human-readable formatted output
python get_session_data.py --session-id session-123 --formatted

# Custom API endpoint
python get_session_data.py --session-id session-123 --api-base http://custom-host:8000
```

## Output Formats

### Default (Review Agent Format)

```json
{
  "session_summary": {
    "session_id": "session-123",
    "total_events": 25,
    "total_agents": 3,
    "total_messages": 8,
    "duration_ms": 45000
  },
  "performance_metrics": {
    "total_duration_ms": 45000,
    "total_tokens": 5000,
    "avg_tokens_per_agent": 1667,
    "avg_duration_per_agent": 15000
  },
  "error_analysis": {
    "error_count": 2,
    "error_rate": 0.08,
    "error_types": ["PreToolUse_Error"],
    "failed_agents": 1
  },
  "agent_coordination": {
    "completion_rate": 0.67,
    "message_to_agent_ratio": 2.67
  },
  "raw_data": { ... }
}
```

### Raw JSON Format (`--json`)

Returns the direct API response with minimal processing.

### Human-Readable Format (`--formatted`)

```
Session: session-123
Status: success
Fetched: 2025-08-20 12:34:56

Summary Statistics:
  Events: 25
  Agents: 3
  Messages: 8
  Duration: 45000 ms

Agents:
  - Agent1 (completed) - 15000ms, 1500 tokens
  - Agent2 (completed) - 20000ms, 2000 tokens
  - Agent3 (failed) - 10000ms, 1500 tokens
```

## Error Handling

The script gracefully handles various error conditions:

- **Connection Errors**: API server unavailable
- **Timeouts**: Request exceeds 10-second timeout
- **HTTP Errors**: 404 (session not found), 500 (server error), etc.
- **Invalid JSON**: Malformed API responses
- **Invalid Session IDs**: Format validation with descriptive errors

All errors return structured error information with appropriate exit codes.

## Integration with Review Agents

The default output format is specifically designed for AI review agents:

1. **session_summary**: Overview metrics for quick assessment
2. **performance_metrics**: Quantitative data for performance analysis
3. **error_analysis**: Error patterns and failure rates
4. **agent_coordination**: Communication and coordination metrics
5. **raw_data**: Complete dataset for detailed analysis

## API Endpoint

Fetches data from: `http://localhost:4000/api/sessions/<session-id>/introspect`

Expected API response structure:
```json
{
  "session_id": "string",
  "events": [array of event objects],
  "agents": [array of agent objects],
  "messages": [array of message objects],
  "metadata": {object with session metadata}
}
```

## Testing

Comprehensive test suite available in `test_get_session_data.py`:

```bash
python test_get_session_data.py -v
```

Tests cover:
- Successful data fetching
- All error conditions
- Output format validation
- CLI interface
- Input validation
- Edge cases and recovery

## Dependencies

- Python 3.8+
- requests library
- Standard library modules (json, sys, re, argparse, datetime)

## Author

RafaelQuantum - Session Review System Implementation
Date: 2025-08-20