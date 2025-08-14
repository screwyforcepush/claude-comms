#!/usr/bin/env node

// Test script to verify prompt/response capture functionality
const fetch = require('node:fetch').default || require('node-fetch');

const SERVER_URL = 'http://localhost:4000';
const SESSION_ID = `test-session-${Date.now()}`;
const AGENT_NAME = 'TestAgent';

async function testPromptCapture() {
  console.log('🚀 Starting Agent Prompt & Response Capture Test');
  console.log(`📍 Session ID: ${SESSION_ID}`);
  console.log(`🤖 Agent Name: ${AGENT_NAME}`);
  
  try {
    // 1. Register the agent
    console.log('\n1️⃣ Registering agent...');
    const registerResponse = await fetch(`${SERVER_URL}/subagents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: SESSION_ID,
        name: AGENT_NAME,
        subagent_type: 'engineer'
      })
    });
    
    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${registerResponse.status}`);
    }
    
    const registerData = await registerResponse.json();
    console.log('✅ Agent registered:', registerData);
    
    // 2. Store initial prompt
    console.log('\n2️⃣ Storing initial prompt...');
    const testPrompt = `Your name is ${AGENT_NAME}. 
You are tasked with implementing a new authentication feature.
Please ensure the following:
- Use secure password hashing
- Implement rate limiting
- Add proper error handling
- Write comprehensive tests`;
    
    const promptResponse = await fetch(`${SERVER_URL}/subagents/${SESSION_ID}/${AGENT_NAME}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initial_prompt: testPrompt
      })
    });
    
    if (!promptResponse.ok) {
      throw new Error(`Prompt update failed: ${promptResponse.status}`);
    }
    
    const promptData = await promptResponse.json();
    console.log('✅ Prompt stored:', promptData);
    
    // 3. Simulate agent completion with response
    console.log('\n3️⃣ Storing final response...');
    const testResponse = `I have successfully implemented the authentication feature with the following:

1. **Password Security**: Implemented bcrypt with salt rounds of 12
2. **Rate Limiting**: Added rate limiting middleware (10 attempts per 15 minutes)
3. **Error Handling**: Comprehensive try-catch blocks with proper error messages
4. **Tests**: Written 25 unit tests and 5 integration tests with 95% coverage

The implementation is production-ready and follows security best practices.`;
    
    const responseUpdate = await fetch(`${SERVER_URL}/subagents/${SESSION_ID}/${AGENT_NAME}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        final_response: testResponse
      })
    });
    
    if (!responseUpdate.ok) {
      throw new Error(`Response update failed: ${responseUpdate.status}`);
    }
    
    const responseData = await responseUpdate.json();
    console.log('✅ Response stored:', responseData);
    
    // 4. Update completion status
    console.log('\n4️⃣ Updating completion status...');
    const completionResponse = await fetch(`${SERVER_URL}/subagents/update-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: SESSION_ID,
        name: AGENT_NAME,
        status: 'completed',
        completion_metadata: {
          total_duration_ms: 45000,
          total_tokens: 1500,
          total_tool_use_count: 12,
          input_tokens: 500,
          output_tokens: 1000
        }
      })
    });
    
    if (!completionResponse.ok) {
      throw new Error(`Completion update failed: ${completionResponse.status}`);
    }
    
    const completionData = await completionResponse.json();
    console.log('✅ Completion updated:', completionData);
    
    // 5. Retrieve full agent data
    console.log('\n5️⃣ Retrieving full agent data...');
    const fullDataResponse = await fetch(`${SERVER_URL}/subagents/${SESSION_ID}/${AGENT_NAME}/full`);
    
    if (!fullDataResponse.ok) {
      throw new Error(`Data retrieval failed: ${fullDataResponse.status}`);
    }
    
    const fullData = await fullDataResponse.json();
    console.log('✅ Full agent data retrieved:');
    console.log('   - Has prompt:', fullData.has_prompt);
    console.log('   - Has response:', fullData.has_response);
    console.log('   - Prompt length:', fullData.prompt_length);
    console.log('   - Response length:', fullData.response_length);
    console.log('   - Status:', fullData.status);
    console.log('   - Duration:', fullData.total_duration_ms, 'ms');
    console.log('   - Tokens:', fullData.total_tokens);
    
    // 6. Verify in agents list
    console.log('\n6️⃣ Verifying in agents list...');
    const agentsResponse = await fetch(`${SERVER_URL}/subagents/${SESSION_ID}`);
    
    if (!agentsResponse.ok) {
      throw new Error(`Agents list failed: ${agentsResponse.status}`);
    }
    
    const agents = await agentsResponse.json();
    const ourAgent = agents.find(a => a.name === AGENT_NAME);
    
    if (!ourAgent) {
      throw new Error('Agent not found in list');
    }
    
    console.log('✅ Agent found in list with:');
    console.log('   - Initial prompt:', ourAgent.initial_prompt ? 'Present' : 'Missing');
    console.log('   - Final response:', ourAgent.final_response ? 'Present' : 'Missing');
    
    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS: All tests passed!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('✅ Agent registration works');
    console.log('✅ Prompt storage works');
    console.log('✅ Response storage works');
    console.log('✅ Completion metadata updates work');
    console.log('✅ Data retrieval works');
    console.log('✅ Agent appears in list with all data');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testPromptCapture().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});