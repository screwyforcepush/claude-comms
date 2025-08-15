#!/usr/bin/env node

// DISABLED: WebSocket test was connecting to production server!
// MaxQuantum: EMERGENCY REMOVAL - WebSocket test creating sessions in production
//
// CRITICAL ISSUES FOUND:
// 1. Connects to ws://localhost:4000/api/sessions/multi-stream (PRODUCTION)
// 2. Subscribes to sessions: 'session-1', 'session-2', 'session-3'
// 3. Sends high-frequency updates (20/sec for 10 seconds = 200 updates)
// 4. Creates mock agent status updates that get persisted
// 5. Tests reconnection which creates multiple connection attempts
//
// POLLUTION EVIDENCE:
// - subscribedSessions.add(sessionIds) for test sessions
// - agent_status_update messages sent to production
// - High-frequency updates creating performance test data
// - Reconnection tests creating orphaned connections

/*
ORIGINAL WEBSOCKET REALTIME TEST COMPLETELY DISABLED

This test was:
- Connecting to production WebSocket endpoint
- Creating/subscribing to test sessions: session-1, session-2, session-3
- Sending 200+ high-frequency updates to production
- Testing reconnection scenarios that create orphaned data
- Creating agent status updates in production database

All WebSocket activity was hitting the live production server
and creating persistent test data in events.db
*/

console.warn('⚠️  test-websocket-realtime.js DISABLED - was polluting production via WebSocket');
console.warn('⚠️  Test was connecting to production ws://localhost:4000 and creating test sessions');

// Prevent execution
process.exit(0);