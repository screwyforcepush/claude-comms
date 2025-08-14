// Sessions Tab Quality Gate Visual Validation
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false, // Show browser for visual verification
    slowMo: 100 // Slow down for visual inspection
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  
  const page = await context.newPage();
  
  console.log('🔍 Starting Sessions Tab Quality Gate Validation...\n');
  
  try {
    // 1. Navigate to application
    console.log('📱 Loading application...');
    await page.goto('http://localhost:5183', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 2. Wait for initial load
    await page.waitForTimeout(2000);
    
    // 3. Click on Sessions tab
    console.log('🔄 Navigating to Sessions tab...');
    const sessionsTab = await page.locator('[data-test="sessions-tab"]');
    
    if (await sessionsTab.count() > 0) {
      await sessionsTab.click();
      await page.waitForTimeout(1500);
      
      // 4. Capture initial state
      console.log('📸 Capturing initial Sessions tab state...');
      await page.screenshot({ 
        path: 'screenshots/sessions-initial-1920x1080.png',
        fullPage: false 
      });
      
      // 5. Check for SessionsView component
      const sessionsView = await page.locator('[data-test="sessions-view"]');
      const sessionsViewExists = await sessionsView.count() > 0;
      console.log(`✅ SessionsView component: ${sessionsViewExists ? 'FOUND' : 'MISSING'}`);
      
      // 6. Check for Interactive Timeline
      const timeline = await page.locator('.sessions-timeline-container');
      const timelineExists = await timeline.count() > 0;
      console.log(`✅ Interactive Timeline: ${timelineExists ? 'FOUND' : 'MISSING'}`);
      
      // 7. Check for filters
      const filterToggle = await page.locator('button:has-text("📊")');
      if (await filterToggle.count() > 0) {
        console.log('🔍 Opening filter panel...');
        await filterToggle.click();
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: 'screenshots/sessions-filters-open-1920x1080.png',
          fullPage: false 
        });
        
        const filterPanel = await page.locator('[data-test="filter-panel"], .sessions-filter-panel, [class*="SessionFilterPanel"]');
        const filterPanelExists = await filterPanel.count() > 0;
        console.log(`✅ Filter Panel: ${filterPanelExists ? 'FOUND' : 'MISSING'}`);
      }
      
      // 8. Check for time window controls
      const timeWindowControls = await page.locator('button:has-text("1hr"), button:has-text("15m"), button:has-text("6hr"), button:has-text("24hr")');
      const timeControlsCount = await timeWindowControls.count();
      console.log(`✅ Time Window Controls: ${timeControlsCount} found`);
      
      // 9. Check for zoom controls
      const zoomControls = await page.locator('button:has-text("Zoom")');
      const zoomControlsExist = await zoomControls.count() > 0;
      console.log(`✅ Zoom Controls: ${zoomControlsExist ? 'FOUND' : 'MISSING'}`);
      
      // 10. Check for SVG timeline
      const svgTimeline = await page.locator('svg.sessions-timeline, .sessions-content svg');
      const svgExists = await svgTimeline.count() > 0;
      console.log(`✅ SVG Timeline Rendering: ${svgExists ? 'FOUND' : 'MISSING'}`);
      
      // 11. Test responsive view - mobile
      console.log('\n📱 Testing mobile responsiveness...');
      await context.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'screenshots/sessions-mobile-390x844.png',
        fullPage: false 
      });
      
      // 12. Test tablet view
      console.log('📱 Testing tablet responsiveness...');
      await context.setViewportSize({ width: 768, height: 1024 }); // iPad
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'screenshots/sessions-tablet-768x1024.png',
        fullPage: false 
      });
      
      // 13. Performance check
      console.log('\n⚡ Checking performance metrics...');
      const performanceMetrics = await page.evaluate(() => {
        const entries = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: Math.round(entries.domContentLoadedEventEnd - entries.domContentLoadedEventStart),
          loadComplete: Math.round(entries.loadEventEnd - entries.loadEventStart),
          domInteractive: Math.round(entries.domInteractive),
          responseTime: Math.round(entries.responseEnd - entries.requestStart)
        };
      });
      
      console.log('Performance Metrics:');
      console.log(`  DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
      console.log(`  Page Load Complete: ${performanceMetrics.loadComplete}ms`);
      console.log(`  DOM Interactive: ${performanceMetrics.domInteractive}ms`);
      console.log(`  Response Time: ${performanceMetrics.responseTime}ms`);
      
      // 14. Check for errors in console
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('❌ Console Error:', msg.text());
        }
      });
      
      page.on('pageerror', error => {
        console.error('❌ Page Error:', error.message);
      });
      
      // Summary
      console.log('\n📊 VALIDATION SUMMARY:');
      console.log('=' .repeat(40));
      
      const issues = [];
      
      if (!sessionsViewExists) issues.push('SessionsView component not found');
      if (!timelineExists) issues.push('Interactive Timeline not found');
      if (timeControlsCount === 0) issues.push('Time window controls missing');
      if (!svgExists) issues.push('SVG timeline not rendering');
      
      if (issues.length === 0) {
        console.log('✅ All critical UI elements detected');
        console.log('✅ Screenshots captured successfully');
        console.log('✅ Responsive views tested');
      } else {
        console.log('❌ ISSUES FOUND:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      }
      
      console.log('\n📁 Screenshots saved to:');
      console.log('  - screenshots/sessions-initial-1920x1080.png');
      console.log('  - screenshots/sessions-filters-open-1920x1080.png');
      console.log('  - screenshots/sessions-mobile-390x844.png');
      console.log('  - screenshots/sessions-tablet-768x1024.png');
      
    } else {
      console.error('❌ CRITICAL: Sessions tab button not found!');
      console.log('Attempting to capture current state...');
      await page.screenshot({ 
        path: 'screenshots/sessions-tab-missing-error.png',
        fullPage: true 
      });
    }
    
  } catch (error) {
    console.error('❌ VALIDATION ERROR:', error.message);
    await page.screenshot({ 
      path: 'screenshots/sessions-error-state.png',
      fullPage: true 
    });
  }
  
  // Keep browser open for manual inspection
  console.log('\n🔍 Browser will remain open for manual inspection.');
  console.log('Press Ctrl+C to close when done.');
  
  // await browser.close();
})();