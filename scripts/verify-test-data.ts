#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { resolve } from 'path';

async function verifyTestData() {
  console.log('🔍 Verifying test data...');
  
  const dbPath = resolve('./apps/server/events.db');
  const db = new Database(dbPath);
  
  try {
    // Count agents
    const agentCount = db.prepare(`
      SELECT COUNT(*) as count FROM subagent_registry 
      WHERE session_id LIKE 'session-2024-01-15-%'
    `).get() as { count: number };
    
    // Count events
    const eventCount = db.prepare(`
      SELECT COUNT(*) as count FROM events 
      WHERE session_id LIKE 'session-2024-01-15-%'
    `).get() as { count: number };
    
    // Count messages
    const messageCount = db.prepare(`
      SELECT COUNT(*) as count FROM subagent_messages
    `).get() as { count: number };
    
    // Get agent status breakdown
    const statusBreakdown = db.prepare(`
      SELECT session_id, 
             COUNT(*) as total_agents
      FROM subagent_registry 
      WHERE session_id LIKE 'session-2024-01-15-%'
      GROUP BY session_id
      ORDER BY session_id
    `).all() as { session_id: string; total_agents: number }[];
    
    // Get recent events sample
    const recentEvents = db.prepare(`
      SELECT hook_event_type, COUNT(*) as count
      FROM events 
      WHERE session_id LIKE 'session-2024-01-15-%'
      GROUP BY hook_event_type
      ORDER BY count DESC
    `).all() as { hook_event_type: string; count: number }[];
    
    console.log('✅ Data Verification Results:');
    console.log('============================');
    console.log(`👥 Total Agents: ${agentCount.count}`);
    console.log(`📊 Total Events: ${eventCount.count}`);
    console.log(`💬 Total Messages: ${messageCount.count}`);
    console.log('');
    console.log('📋 Session Breakdown:');
    statusBreakdown.forEach(session => {
      console.log(`  ${session.session_id}: ${session.total_agents} agents`);
    });
    console.log('');
    console.log('📈 Event Type Distribution:');
    recentEvents.forEach(event => {
      console.log(`  ${event.hook_event_type}: ${event.count} events`);
    });
    
    // Verify expected counts
    const expectedAgents = 10;
    const expectedEvents = 45; 
    const expectedMessages = 4;
    
    if (agentCount.count === expectedAgents && 
        eventCount.count === expectedEvents && 
        messageCount.count >= expectedMessages) {
      console.log('');
      console.log('🎉 All test data verified successfully!');
      console.log('The UI dashboard should now display comprehensive test scenarios.');
      return true;
    } else {
      console.log('');
      console.log('⚠️  Data counts don\'t match expectations:');
      console.log(`  Expected agents: ${expectedAgents}, got: ${agentCount.count}`);
      console.log(`  Expected events: ${expectedEvents}, got: ${eventCount.count}`);
      console.log(`  Expected messages: ${expectedMessages}, got: ${messageCount.count}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error verifying test data:', error);
    return false;
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  verifyTestData();
}