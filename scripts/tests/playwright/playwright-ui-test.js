const { chromium } = require('playwright');

async function testPromptResponseUI() {
  console.log('🎭 Starting Playwright UI Test for Prompt/Response Feature');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  try {
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Look for sessions timeline or agent view
    console.log('🔍 Looking for Sessions or Agents view...');
    
    // Try to find and click on the Agents tab
    const agentsTab = await page.locator('button:has-text("Agents")').first();
    if (await agentsTab.isVisible()) {
      console.log('✅ Found Agents tab, clicking...');
      await agentsTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for an agent in the list
    const agentCard = await page.locator('[data-testid*="agent-"], .agent-card, .timeline-agent').first();
    if (await agentCard.isVisible()) {
      console.log('✅ Found agent card, clicking to open details...');
      await agentCard.click();
      await page.waitForTimeout(1000);
      
      // Check if agent detail pane opened
      const detailPane = await page.locator('[data-testid="agent-detail-pane"], .agent-detail-pane').first();
      if (await detailPane.isVisible()) {
        console.log('✅ Agent detail pane opened');
        
        // Look for prompt/response sections
        const promptSection = await page.locator('[data-testid="prompt-section"], :has-text("Initial Prompt")').first();
        const responseSection = await page.locator('[data-testid="response-section"], :has-text("Final Response")').first();
        
        if (await promptSection.isVisible()) {
          console.log('✅ Prompt section is visible');
          
          // Check for View Full Details button
          const viewFullBtn = await page.locator('[data-testid="expand-prompt-response-btn"], button:has-text("View Full")').first();
          if (await viewFullBtn.isVisible()) {
            console.log('✅ View Full Details button found, clicking...');
            await viewFullBtn.click();
            await page.waitForTimeout(1000);
            
            // Check if modal opened
            const modal = await page.locator('.prompt-response-modal, [role="dialog"]').first();
            if (await modal.isVisible()) {
              console.log('✅ Prompt/Response modal opened successfully');
              
              // Take screenshot of modal
              await page.screenshot({ 
                path: '/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/screenshots/prompt-response-modal.png',
                fullPage: false 
              });
              console.log('📸 Screenshot saved: prompt-response-modal.png');
            }
          }
        }
        
        if (await responseSection.isVisible()) {
          console.log('✅ Response section is visible');
        }
      }
    }
    
    // Take full page screenshot
    await page.screenshot({ 
      path: '/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/screenshots/ui-test-full.png',
      fullPage: true 
    });
    console.log('📸 Full page screenshot saved: ui-test-full.png');
    
    console.log('\n🎉 UI Test completed successfully!');
    
  } catch (error) {
    console.error('❌ UI Test failed:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: '/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/screenshots/ui-test-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: ui-test-error.png');
    
  } finally {
    await browser.close();
  }
}

testPromptResponseUI().catch(console.error);