const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the dev server (using port 5180 as shown in output)
  await page.goto('http://localhost:5180');
  await page.waitForLoadState('networkidle');
  
  // Click on Sessions tab
  await page.click('button:has-text("Sessions")');
  await page.waitForSelector('.sessions-timeline-container', { timeout: 5000 });
  
  // Wait for timeline to fully render
  await page.waitForTimeout(2000);
  
  // Capture desktop screenshot
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ 
    path: 'screenshots/timeline/desktop-main.png',
    fullPage: false 
  });
  
  console.log('✅ Desktop screenshot captured');
  
  // Test interactivity - try clicking on an agent path
  try {
    const agentPath = await page.locator('.agent-path path').first();
    if (await agentPath.isVisible()) {
      await agentPath.click();
      console.log('✅ Agent path is clickable');
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'screenshots/timeline/desktop-agent-selected.png',
        fullPage: false 
      });
    }
  } catch (e) {
    console.log('⚠️ Could not click agent path:', e.message);
  }
  
  // Test time window controls
  try {
    await page.click('button:has-text("15m")');
    console.log('✅ Time window button is clickable');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-15min.png',
      fullPage: false 
    });
  } catch (e) {
    console.log('⚠️ Could not click time window:', e.message);
  }
  
  // Test zoom controls
  try {
    await page.click('button:has-text("Zoom In")');
    console.log('✅ Zoom button is clickable');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'screenshots/timeline/desktop-zoomed.png',
      fullPage: false 
    });
  } catch (e) {
    console.log('⚠️ Could not click zoom:', e.message);
  }
  
  // Mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ 
    path: 'screenshots/timeline/mobile-view.png',
    fullPage: false 
  });
  console.log('✅ Mobile screenshot captured');
  
  await browser.close();
  console.log('🎉 Visual validation complete!');
})();