import { chromium } from 'playwright';
import path from 'path';

async function validateSessionsUI() {
  console.log('🔍 Starting Sessions Tab UI Validation...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to the Sessions tab
    console.log('📍 Navigating to Sessions tab...');
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000); // Wait for initial load
    
    // Click on Sessions tab
    await page.click('text=Sessions');
    await page.waitForTimeout(3000); // Wait for tab to load
    
    // Take initial screenshot
    const timestamp = Date.now();
    await page.screenshot({ 
      path: `screenshots/sessions-initial-${timestamp}.png`,
      fullPage: true 
    });
    console.log('✅ Captured initial Sessions tab state');
    
    // Test 1: Click on an agent (if available)
    console.log('\n🧪 Test 1: Clicking on an agent...');
    const agentPath = await page.$('svg path.agent-path');
    if (agentPath) {
      await agentPath.click();
      await page.waitForTimeout(1500);
      
      // Check for side pane (AgentDetailPane)
      const agentPane = await page.$('.agent-detail-pane');
      if (agentPane) {
        console.log('✅ AgentDetailPane opened as side pane');
        await page.screenshot({ 
          path: `screenshots/sessions-agent-pane-${timestamp}.png`,
          fullPage: true 
        });
      } else {
        console.log('❌ AgentDetailPane not found');
      }
      
      // Check for modal (DetailPanel) - should NOT exist
      const modal = await page.$('.detail-panel');
      if (modal) {
        console.log('❌ FAIL: DetailPanel modal found (should not exist)');
      } else {
        console.log('✅ No DetailPanel modal found (correct)');
      }
      
      // Close the pane
      const closeButton = await page.$('.agent-detail-pane button[aria-label="Close agent details"]');
      if (closeButton) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('⚠️ No agents found to click');
    }
    
    // Test 2: Click on a message (if available)
    console.log('\n🧪 Test 2: Clicking on a message...');
    const messageCircle = await page.$('svg circle.session-messages circle');
    if (messageCircle) {
      await messageCircle.click();
      await page.waitForTimeout(1500);
      
      // Check for side pane (MessageDetailPane)
      const messagePane = await page.$('.message-detail-pane');
      if (messagePane) {
        console.log('✅ MessageDetailPane opened as side pane');
        await page.screenshot({ 
          path: `screenshots/sessions-message-pane-${timestamp}.png`,
          fullPage: true 
        });
      } else {
        console.log('❌ MessageDetailPane not found');
      }
      
      // Check for modal (DetailPanel) - should NOT exist
      const modal = await page.$('.detail-panel');
      if (modal) {
        console.log('❌ FAIL: DetailPanel modal found (should not exist)');
      } else {
        console.log('✅ No DetailPanel modal found (correct)');
      }
      
      // Close the pane
      const closeButton = await page.$('.message-detail-pane button[aria-label="Close message details"]');
      if (closeButton) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('⚠️ No messages found to click');
    }
    
    // Test 3: Verify no session selection is required
    console.log('\n🧪 Test 3: Verifying direct click functionality...');
    
    // Try clicking on a session background (should not select it)
    const sessionLane = await page.$('svg rect.session-lane');
    if (sessionLane) {
      await sessionLane.click();
      await page.waitForTimeout(500);
      
      // Check if selection info bar appears (it shouldn't for session clicks)
      const selectionInfo = await page.$('.selection-info');
      if (selectionInfo) {
        const text = await selectionInfo.textContent();
        if (text.includes('Selected Agent') || text.includes('Selected Message')) {
          console.log('✅ Selection info shows agent/message selection only');
        } else {
          console.log('⚠️ Unexpected selection info content');
        }
      } else {
        console.log('✅ No session selection detected (correct)');
      }
    }
    
    // Final verification summary
    console.log('\n📊 Validation Summary:');
    console.log('=======================');
    
    // Check for DetailPanel import
    const pageContent = await page.content();
    const hasDetailPanel = pageContent.includes('detail-panel') || pageContent.includes('DetailPanel');
    
    if (hasDetailPanel) {
      console.log('❌ CRITICAL: DetailPanel references found in rendered HTML');
    } else {
      console.log('✅ No DetailPanel references in rendered HTML');
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: `screenshots/sessions-final-${timestamp}.png`,
      fullPage: true 
    });
    console.log('\n📸 Screenshots saved to screenshots/ directory');
    
  } catch (error) {
    console.error('❌ Validation error:', error);
  } finally {
    await browser.close();
  }
}

// Run the validation
validateSessionsUI().catch(console.error);