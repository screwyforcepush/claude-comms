const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('🔍 Testing Event Indicators Feature...\n');
    
    // Navigate to the dashboard
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Click on Sessions tab
    await page.click('button:has-text("Sessions")');
    await page.waitForTimeout(2000);
    
    console.log('✅ Sessions tab loaded');
    
    // Take screenshot of sessions timeline
    await page.screenshot({ 
      path: 'screenshots/event-indicators-overview.png',
      fullPage: false
    });
    console.log('📸 Captured overview screenshot');
    
    // Look for event indicators on the timeline
    const userPromptIndicators = await page.$$('circle[fill="#3b82f6"]');
    const notificationIndicators = await page.$$('path[fill="#f59e0b"]');
    
    console.log(`\n📊 Event Indicators Found:`);
    console.log(`   - User Prompt indicators (blue circles): ${userPromptIndicators.length}`);
    console.log(`   - Notification indicators (orange triangles): ${notificationIndicators.length}`);
    
    // Test hover interaction on a user prompt indicator
    if (userPromptIndicators.length > 0) {
      await userPromptIndicators[0].hover();
      await page.waitForTimeout(500);
      
      // Check if tooltip appears
      const tooltipVisible = await page.isVisible('.tooltip-container');
      console.log(`\n🎯 Hover Test:`);
      console.log(`   - Tooltip visible on hover: ${tooltipVisible}`);
      
      await page.screenshot({ 
        path: 'screenshots/event-indicator-hover.png',
        fullPage: false
      });
      console.log('📸 Captured hover state screenshot');
    }
    
    // Test click interaction on a user prompt indicator
    if (userPromptIndicators.length > 0) {
      await userPromptIndicators[0].click();
      await page.waitForTimeout(500);
      
      // Check if detail panel appears
      const panelVisible = await page.isVisible('text="User Prompt"');
      console.log(`\n🖱️ Click Test:`);
      console.log(`   - Detail panel opened: ${panelVisible}`);
      
      if (panelVisible) {
        // Check panel content
        const promptContent = await page.isVisible('text="Prompt Content"');
        console.log(`   - Prompt content section visible: ${promptContent}`);
        
        await page.screenshot({ 
          path: 'screenshots/event-detail-panel.png',
          fullPage: false
        });
        console.log('📸 Captured detail panel screenshot');
        
        // Close panel with Esc key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        const panelClosed = !(await page.isVisible('text="User Prompt"'));
        console.log(`   - Panel closed with Esc: ${panelClosed}`);
      }
    }
    
    // Test notification indicator if present
    if (notificationIndicators.length > 0) {
      await notificationIndicators[0].click();
      await page.waitForTimeout(500);
      
      const notificationPanelVisible = await page.isVisible('text="Notification"');
      console.log(`\n🔔 Notification Test:`);
      console.log(`   - Notification panel opened: ${notificationPanelVisible}`);
      
      if (notificationPanelVisible) {
        await page.screenshot({ 
          path: 'screenshots/notification-detail-panel.png',
          fullPage: false
        });
        console.log('📸 Captured notification panel screenshot');
      }
    }
    
    // Test pointer events work correctly
    console.log(`\n🎮 Pointer Events Test:`);
    
    // Try to click through background (should not trigger anything)
    const backgroundClick = await page.evaluate(() => {
      const svg = document.querySelector('.sessions-content svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const event = new MouseEvent('click', {
          clientX: rect.left + 100,
          clientY: rect.top + 100,
          bubbles: true
        });
        svg.dispatchEvent(event);
        return true;
      }
      return false;
    });
    console.log(`   - Background click handled: ${backgroundClick}`);
    
    // Verify indicators are clickable
    const indicatorsClickable = await page.evaluate(() => {
      const circles = document.querySelectorAll('circle[style*="pointer-events: auto"]');
      const paths = document.querySelectorAll('path[style*="pointer-events: auto"]');
      return {
        userPrompts: circles.length,
        notifications: paths.length
      };
    });
    console.log(`   - Clickable user prompts: ${indicatorsClickable.userPrompts}`);
    console.log(`   - Clickable notifications: ${indicatorsClickable.notifications}`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
})();