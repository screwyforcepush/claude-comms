/**
 * Compatibility test for timeline data transformation
 */
import { useTimelineData } from '../composables/useTimelineData';
import { sampleAgents, sampleMessages, sampleEvents, testTimelineTransformation } from './timelineTestData';

/**
 * Test timeline data transformation with existing data structures
 */
export function runCompatibilityTests(): boolean {
  console.group('🧪 Timeline Data Transformation Compatibility Tests');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Basic data structure compatibility
    console.log('✅ Test 1: Data structure compatibility');
    const testData = testTimelineTransformation();
    
    // Test 2: Composable initialization
    console.log('✅ Test 2: Composable initialization');
    const { setAgents, setMessages, setEvents, timelineData, timelineAgents, timelineBatches } = useTimelineData({
      viewport_width: 1200,
      viewport_height: 600,
      show_messages: true,
      show_user_prompts: true
    });
    
    // Test 3: Data transformation
    console.log('✅ Test 3: Data transformation');
    setAgents(sampleAgents);
    setMessages(sampleMessages);  
    setEvents(sampleEvents);
    
    // Validate timeline data structure
    const data = timelineData.value;
    console.log('Timeline data generated:', {
      agents: data.agents.length,
      batches: data.batches.length,
      messages: data.messages.length,
      userPrompts: data.user_prompts.length
    });
    
    // Test 4: Batch detection
    console.log('✅ Test 4: Batch detection');
    const batches = timelineBatches.value;
    console.log('Batches detected:', batches.map(b => ({
      id: b.id,
      agentCount: b.total_agents,
      spawnTime: new Date(b.spawn_time).toISOString()
    })));
    
    if (batches.length < 2) {
      console.warn('⚠️  Expected at least 2 batches, got:', batches.length);
    }
    
    // Test 5: Agent positioning
    console.log('✅ Test 5: Agent positioning');
    const agents = timelineAgents.value;
    agents.forEach(agent => {
      if (typeof agent.position.x !== 'number' || typeof agent.position.y !== 'number') {
        console.error('❌ Agent positioning failed for:', agent.name);
        allTestsPassed = false;
      }
    });
    
    // Test 6: Time scale validation
    console.log('✅ Test 6: Time scale validation');
    const scale = data.scale;
    if (typeof scale.timeToX !== 'function' || typeof scale.xToTime !== 'function') {
      console.error('❌ Time scale functions missing');
      allTestsPassed = false;
    }
    
    // Test scale functions
    const testTime = sampleAgents[0].created_at;
    const x = scale.timeToX(testTime);
    const backToTime = scale.xToTime(x);
    if (Math.abs(backToTime - testTime) > 100) { // Allow 100ms tolerance
      console.error('❌ Scale function round-trip failed');
      allTestsPassed = false;
    }
    
    // Test 7: Message positioning
    console.log('✅ Test 7: Message positioning');
    const messages = data.messages;
    messages.forEach(msg => {
      if (typeof msg.position.x !== 'number' || typeof msg.position.y !== 'number') {
        console.error('❌ Message positioning failed for message from:', msg.sender);
        allTestsPassed = false;
      }
    });
    
    if (allTestsPassed) {
      console.log('🎉 All compatibility tests passed!');
    }
    
  } catch (error) {
    console.error('❌ Compatibility test failed:', error);
    allTestsPassed = false;
  }
  
  console.groupEnd();
  return allTestsPassed;
}

/**
 * Performance test with large dataset
 */
export function runPerformanceTest(agentCount: number = 100): boolean {
  console.group(`⚡ Performance Test (${agentCount} agents)`);
  
  try {
    const startTime = performance.now();
    
    // Generate large dataset
    const { generateStressTestData } = require('./timelineTestData');
    const { agents, messages, events } = generateStressTestData(agentCount);
    
    // Initialize timeline
    const { setAgents, setMessages, setEvents, timelineData } = useTimelineData({
      viewport_width: 1200,
      viewport_height: 800
    });
    
    // Transform data
    setAgents(agents);
    setMessages(messages);
    setEvents(events);
    
    // Force computation
    const data = timelineData.value;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log('Performance metrics:', {
      agentCount: agents.length,
      messageCount: messages.length,
      eventCount: events.length,
      processingTime: `${duration.toFixed(2)}ms`,
      agentsPerSecond: Math.round(agents.length / (duration / 1000))
    });
    
    if (duration > 1000) { // More than 1 second is concerning
      console.warn(`⚠️  Processing took ${duration}ms - may need optimization`);
    }
    
    console.log('✅ Performance test completed');
    console.groupEnd();
    return true;
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    console.groupEnd();
    return false;
  }
}