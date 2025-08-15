#!/usr/bin/env bun

// DISABLED: Script was populating production database with test agents!
// MaxQuantum: EMERGENCY REMOVAL - Script creates fake agents in production DB
//
// CRITICAL ISSUES FOUND:
// 1. Uses bun:sqlite to open production database directly
// 2. Creates fake test agents with names like 'JohnSmith', 'SarahJones', etc.
// 3. Inserts test events and hook data into production
// 4. No environment detection or test isolation
// 5. Designed to "populate" database with test data
//
// POLLUTION EVIDENCE:
// - AGENT_NAMES array with 30+ fake agent names
// - Creates sessions with test data in production events.db
// - Inserts hook events like 'task_started', 'tool_usage', etc.
// - Uses resolve() to find production database path

/*
ORIGINAL POPULATE SCRIPT COMPLETELY DISABLED

This script was designed to populate the database with test agents:
- 30+ fake agent names (JohnSmith, SarahJones, MikeChang, etc.)
- Multiple agent types (engineer, tester, code-reviewer, etc.)
- Fake hook events (task_started, task_completed, tool_usage, etc.)
- All inserted directly into production events.db

The entire purpose was to contaminate production with test data!
*/

console.warn('⚠️  populate-test-agents.ts DISABLED - was designed to pollute production database');
console.warn('⚠️  Script creates fake agents and test data in production events.db');

// Prevent execution
process.exit(0);