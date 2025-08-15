const { chromium } = require('playwright');

(async () => {
  console.log('🎯 Quality Gate Visual Validation');
  console.log('================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate to the application
    console.log('📱 Testing desktop viewport (1920x1080)...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Capture main view
    await page.screenshot({ 
      path: 'screenshots/quality-gate/desktop-main.png',
      fullPage: false 
    });
    console.log('✅ Desktop main view captured');

    // Test Sessions tab
    const sessionsTab = await page.locator('[data-testid="sessions-tab"], button:has-text("Sessions")');
    if (await sessionsTab.count() > 0) {
      await sessionsTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: 'screenshots/quality-gate/sessions-view.png',
        fullPage: false 
      });
      console.log('✅ Sessions view captured');
    }

    // Test Timeline tab
    const timelineTab = await page.locator('[data-testid="timeline-tab"], button:has-text("Timeline")');
    if (await timelineTab.count() > 0) {
      await timelineTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: 'screenshots/quality-gate/timeline-view.png',
        fullPage: false 
      });
      console.log('✅ Timeline view captured');
    }

    // Test responsive design - tablet
    console.log('📱 Testing tablet viewport (768x1024)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/tablet-view.png',
      fullPage: false 
    });
    console.log('✅ Tablet view captured');

    // Test responsive design - mobile
    console.log('📱 Testing mobile viewport (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshots/quality-gate/mobile-view.png',
      fullPage: false 
    });
    console.log('✅ Mobile view captured');

    // Check for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Test for accessibility issues
    console.log('♿ Checking basic accessibility...');
    
    // Check for proper heading hierarchy
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => 
      elements.map(el => ({
        level: el.tagName,
        text: el.textContent,
        visible: el.offsetParent !== null
      }))
    );
    
    // Check for interactive elements
    const buttons = await page.$$eval('button', elements => elements.length);
    const links = await page.$$eval('a', elements => elements.length);
    
    console.log(`  - Found ${headings.filter(h => h.visible).length} visible headings`);
    console.log(`  - Found ${buttons} buttons`);
    console.log(`  - Found ${links} links`);
    
    if (consoleErrors.length > 0) {
      console.warn('⚠️ Console errors detected:', consoleErrors);
    }

    console.log('\\n✅ Visual validation complete!');
    console.log('📸 Screenshots saved to screenshots/quality-gate/');

  } catch (error) {
    console.error('❌ Visual validation failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();