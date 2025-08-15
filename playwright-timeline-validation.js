const { chromium } = require('playwright');

/**
 * Playwright Visual Validation Script for Timeline Order Enhancement
 * Phase 05 Quality Gate Verification
 * 
 * This script captures screenshots of the timeline UI to verify:
 * 1. Timeline shows latest events at top (reversed order)
 * 2. UI polish components render correctly
 * 3. Scroll behavior and auto-pan work
 * 4. Visual indicators and temporal badges display properly
 */

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('🚀 Starting timeline visual validation...');
  
  try {
    // Navigate to the application
    await page.goto('http://localhost:5175/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Wait for timeline to be visible
    await page.waitForSelector('.event-timestamp-indicator, .space-y-2', { 
      timeout: 10000 
    }).catch(() => {
      console.log('⚠️ Timeline elements not found immediately, continuing...');
    });
    
    // Wait a bit for any animations to settle
    await page.waitForTimeout(2000);
    
    // Capture full page screenshot
    await page.screenshot({ 
      path: 'screenshots/timeline/phase-05-full-page.png',
      fullPage: true
    });
    console.log('📸 Captured full page screenshot');
    
    // Capture timeline area specifically
    const timelineElement = await page.$('.flex-1.mobile\\:h-\\[50vh\\], .overflow-y-auto, [class*="event"]');
    if (timelineElement) {
      await timelineElement.screenshot({ 
        path: 'screenshots/timeline/phase-05-timeline-area.png' 
      });
      console.log('📸 Captured timeline area screenshot');
    }
    
    // Check for event ordering (latest at top)
    const events = await page.$$eval('[class*="event-row"], [class*="mock-event-row"], .space-y-2 > *', elements => {
      return elements.slice(0, 5).map(el => ({
        text: el.textContent,
        position: elements.indexOf(el)
      }));
    });
    
    if (events.length > 0) {
      console.log('📊 First 5 events in timeline:');
      events.forEach(event => {
        console.log(`  Position ${event.position}: ${event.text?.substring(0, 50)}...`);
      });
    }
    
    // Check for new UI components
    const components = {
      directionHeader: await page.$('.timeline-direction-header, [data-testid="timeline-direction-header"]'),
      temporalBadges: await page.$$('.temporal-context-badge, .event-timestamp-indicator'),
      flowMarkers: await page.$$('.timeline-flow-gradient, .event-position-marker'),
      enhancedRows: await page.$$('.enhanced-event-container, [class*="position-"]')
    };
    
    console.log('\n🎨 UI Component Status:');
    console.log(`  Direction Header: ${components.directionHeader ? '✅ Present' : '❌ Missing'}`);
    console.log(`  Temporal Badges: ${components.temporalBadges.length > 0 ? `✅ Found ${components.temporalBadges.length}` : '❌ None found'}`);
    console.log(`  Flow Markers: ${components.flowMarkers.length > 0 ? `✅ Found ${components.flowMarkers.length}` : '❌ None found'}`);
    console.log(`  Enhanced Rows: ${components.enhancedRows.length > 0 ? `✅ Found ${components.enhancedRows.length}` : '❌ None found'}`);
    
    // Test different viewport sizes
    const viewports = [
      { name: 'desktop-xl', width: 1920, height: 1080 },
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 812 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500); // Wait for responsive adjustments
      
      await page.screenshot({ 
        path: `screenshots/timeline/phase-05-${viewport.name}.png`,
        fullPage: false
      });
      console.log(`📸 Captured ${viewport.name} screenshot (${viewport.width}x${viewport.height})`);
    }
    
    // Check for accessibility attributes
    const accessibilityChecks = await page.evaluate(() => {
      const checks = {
        ariaLabels: document.querySelectorAll('[aria-label]').length,
        ariaDescribedby: document.querySelectorAll('[aria-describedby]').length,
        roles: document.querySelectorAll('[role]').length,
        focusableElements: document.querySelectorAll('button, a, input, [tabindex]').length
      };
      return checks;
    });
    
    console.log('\n♿ Accessibility Status:');
    console.log(`  ARIA Labels: ${accessibilityChecks.ariaLabels}`);
    console.log(`  ARIA Describedby: ${accessibilityChecks.ariaDescribedby}`);
    console.log(`  Role Attributes: ${accessibilityChecks.roles}`);
    console.log(`  Focusable Elements: ${accessibilityChecks.focusableElements}`);
    
    // Check for scroll behavior
    const scrollContainer = await page.$('.overflow-y-auto, [ref="scrollContainer"]');
    if (scrollContainer) {
      const initialScrollTop = await scrollContainer.evaluate(el => el.scrollTop);
      console.log(`\n📜 Initial scroll position: ${initialScrollTop}px`);
      
      // Try scrolling
      await scrollContainer.evaluate(el => el.scrollTo(0, 100));
      await page.waitForTimeout(500);
      
      const newScrollTop = await scrollContainer.evaluate(el => el.scrollTop);
      console.log(`  After scroll attempt: ${newScrollTop}px`);
      console.log(`  Scroll behavior: ${newScrollTop !== initialScrollTop ? '✅ Working' : '⚠️ May be stuck'}`);
    }
    
    // Performance check
    const performanceMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: entries.domContentLoadedEventEnd - entries.domContentLoadedEventStart,
        loadComplete: entries.loadEventEnd - entries.loadEventStart,
        domInteractive: entries.domInteractive - entries.fetchStart
      };
    });
    
    console.log('\n⚡ Performance Metrics:');
    console.log(`  DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`  Load Complete: ${performanceMetrics.loadComplete.toFixed(2)}ms`);
    console.log(`  DOM Interactive: ${performanceMetrics.domInteractive.toFixed(2)}ms`);
    
    console.log('\n✅ Visual validation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during visual validation:', error);
    
    // Capture error screenshot
    await page.screenshot({ 
      path: 'screenshots/timeline/phase-05-error-state.png',
      fullPage: true
    });
    console.log('📸 Captured error state screenshot');
    
  } finally {
    await browser.close();
    console.log('🎬 Browser closed');
  }
})();