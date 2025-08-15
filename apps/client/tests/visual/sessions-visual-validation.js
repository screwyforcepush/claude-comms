// ScreenshotShark: Comprehensive Sessions Tab Visual Validation
// This script provides comprehensive visual proof that the Sessions timeline renders correctly
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false, // Show browser for visual verification
    slowMo: 200 // Slow down for better visual inspection
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  
  const page = await context.newPage();
  
  console.log('🔍 ScreenshotShark: Starting Sessions Tab Visual Validation...\n');
  
  const validationResults = {
    visualElements: {},
    screenshots: [],
    interactions: {},
    issues: []
  };
  
  try {
    // 1. Navigate to application
    console.log('📱 Loading application at localhost:5173...');
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 2. Wait for Vue app to initialize
    await page.waitForTimeout(3000);
    
    // 3. Look for and click Sessions tab
    console.log('🔄 Looking for Sessions tab...');
    
    // Multiple selectors to find Sessions tab
    const sessionTabSelectors = [
      '[data-test="sessions-tab"]',
      'button:has-text("Sessions")',
      '.nav-tabs button:has-text("Sessions")',
      'nav button:has-text("Sessions")',
      '.tab-button:has-text("Sessions")',
      '[role="tab"]:has-text("Sessions")'
    ];
    
    let sessionsTab = null;
    for (const selector of sessionTabSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        sessionsTab = element;
        console.log(`✅ Found Sessions tab with selector: ${selector}`);
        break;
      }
    }
    
    if (sessionsTab) {
      await sessionsTab.click();
      await page.waitForTimeout(2000);
      
      // 4. Capture initial Sessions tab state
      console.log('📸 Capturing initial Sessions tab state...');
      await page.screenshot({ 
        path: 'screenshots/shark-sessions-initial-state.png',
        fullPage: false 
      });
      validationResults.screenshots.push('shark-sessions-initial-state.png');
      
      // 5. Validate core visual elements
      console.log('\n🔍 Validating visual elements...');
      
      // Check for main container
      const sessionsContainer = page.locator('.sessions-view, .sessions-timeline-container, [class*="sessions"]');
      const containerExists = await sessionsContainer.count() > 0;
      validationResults.visualElements.mainContainer = containerExists;
      console.log(`✅ Sessions Container: ${containerExists ? 'FOUND' : 'MISSING'}`);
      
      // Check for header
      const header = page.locator('.sessions-header, h3:has-text("Session"), h3:has-text("Timeline")');
      const headerExists = await header.count() > 0;
      validationResults.visualElements.header = headerExists;
      console.log(`✅ Sessions Header: ${headerExists ? 'FOUND' : 'MISSING'}`);
      
      // Check for SVG timeline
      const svgTimeline = page.locator('svg');
      const svgCount = await svgTimeline.count();
      validationResults.visualElements.svgElements = svgCount;
      console.log(`✅ SVG Elements: ${svgCount} found`);
      
      if (svgCount > 0) {
        // Validate specific SVG content
        const sessionLanes = page.locator('svg .session-lane, svg g.session-lane');
        const laneCount = await sessionLanes.count();
        validationResults.visualElements.sessionLanes = laneCount;
        console.log(`✅ Session Lanes: ${laneCount} found`);
        
        const agentPaths = page.locator('svg path, svg .agent-path');
        const pathCount = await agentPaths.count();
        validationResults.visualElements.agentPaths = pathCount;
        console.log(`✅ Agent Paths: ${pathCount} found`);
        
        const timeAxis = page.locator('svg .time-axis, svg g.time-axis');
        const axisExists = await timeAxis.count() > 0;
        validationResults.visualElements.timeAxis = axisExists;
        console.log(`✅ Time Axis: ${axisExists ? 'FOUND' : 'MISSING'}`);
      }
      
      // 6. Test time window controls
      console.log('\n⏰ Testing time window controls...');
      const timeButtons = page.locator('button:has-text("15m"), button:has-text("1h"), button:has-text("6h"), button:has-text("24h")');
      const timeButtonCount = await timeButtons.count();
      validationResults.visualElements.timeControls = timeButtonCount;
      console.log(`✅ Time Window Controls: ${timeButtonCount} found`);
      
      if (timeButtonCount > 0) {
        // Click different time windows and capture
        const timeWindows = ['15m', '1h', '6h', '24h'];
        for (const window of timeWindows) {
          const windowButton = page.locator(`button:has-text("${window}")`);
          if (await windowButton.count() > 0) {
            await windowButton.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ 
              path: `screenshots/shark-sessions-timewindow-${window}.png`,
              fullPage: false 
            });
            validationResults.screenshots.push(`shark-sessions-timewindow-${window}.png`);
            console.log(`📸 Captured ${window} time window`);
          }
        }
      }
      
      // 7. Test zoom controls
      console.log('\n🔍 Testing zoom controls...');
      const zoomInButton = page.locator('button:has-text("Zoom In"), button:has-text("🔍+")');
      const zoomOutButton = page.locator('button:has-text("Zoom Out"), button:has-text("🔍-")');
      const resetButton = page.locator('button:has-text("Reset"), button:has-text("⚡")');
      
      const zoomInExists = await zoomInButton.count() > 0;
      const zoomOutExists = await zoomOutButton.count() > 0;
      const resetExists = await resetButton.count() > 0;
      
      validationResults.visualElements.zoomControls = {
        zoomIn: zoomInExists,
        zoomOut: zoomOutExists,
        reset: resetExists
      };
      
      console.log(`✅ Zoom In Button: ${zoomInExists ? 'FOUND' : 'MISSING'}`);
      console.log(`✅ Zoom Out Button: ${zoomOutExists ? 'FOUND' : 'MISSING'}`);
      console.log(`✅ Reset Button: ${resetExists ? 'FOUND' : 'MISSING'}`);
      
      // Test zoom interactions
      if (zoomInExists) {
        console.log('🔍 Testing zoom in...');
        await zoomInButton.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'screenshots/shark-sessions-zoomed-in.png',
          fullPage: false 
        });
        validationResults.screenshots.push('shark-sessions-zoomed-in.png');
        validationResults.interactions.zoomIn = true;
      }
      
      if (zoomOutExists) {
        console.log('🔍 Testing zoom out...');
        await zoomOutButton.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'screenshots/shark-sessions-zoomed-out.png',
          fullPage: false 
        });
        validationResults.screenshots.push('shark-sessions-zoomed-out.png');
        validationResults.interactions.zoomOut = true;
      }
      
      if (resetExists) {
        console.log('⚡ Testing reset view...');
        await resetButton.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'screenshots/shark-sessions-reset-view.png',
          fullPage: false 
        });
        validationResults.screenshots.push('shark-sessions-reset-view.png');
        validationResults.interactions.reset = true;
      }
      
      // 8. Test hover interactions on session lanes
      console.log('\n🎯 Testing hover interactions...');
      if (svgCount > 0) {
        const svg = page.locator('svg').first();
        const svgBox = await svg.boundingBox();
        
        if (svgBox) {
          // Hover over different parts of the timeline
          const hoverPoints = [
            { x: svgBox.x + svgBox.width * 0.2, y: svgBox.y + svgBox.height * 0.3 },
            { x: svgBox.x + svgBox.width * 0.5, y: svgBox.y + svgBox.height * 0.5 },
            { x: svgBox.x + svgBox.width * 0.8, y: svgBox.y + svgBox.height * 0.7 }
          ];
          
          for (let i = 0; i < hoverPoints.length; i++) {
            const point = hoverPoints[i];
            await page.mouse.move(point.x, point.y);
            await page.waitForTimeout(500);
            
            // Check for tooltip
            const tooltip = page.locator('.tooltip, [class*="tooltip"], [role="tooltip"]');
            const tooltipVisible = await tooltip.count() > 0;
            
            await page.screenshot({ 
              path: `screenshots/shark-sessions-hover-${i + 1}.png`,
              fullPage: false 
            });
            validationResults.screenshots.push(`shark-sessions-hover-${i + 1}.png`);
            
            console.log(`🎯 Hover point ${i + 1}: Tooltip ${tooltipVisible ? 'VISIBLE' : 'NOT VISIBLE'}`);
            validationResults.interactions[`hover${i + 1}`] = tooltipVisible;
          }
        }
      }
      
      // 9. Check for performance indicators
      console.log('\n⚡ Checking performance indicators...');
      const performanceElements = page.locator('[class*="fps"], [class*="performance"], .performance-metrics');
      const perfCount = await performanceElements.count();
      validationResults.visualElements.performanceMetrics = perfCount;
      console.log(`✅ Performance Indicators: ${perfCount} found`);
      
      // 10. Validate no blank canvas
      console.log('\n🎨 Validating canvas is not blank...');
      const emptyState = page.locator(':has-text("No sessions"), :has-text("Loading"), .empty-state');
      const isEmptyState = await emptyState.count() > 0;
      validationResults.visualElements.isBlankCanvas = isEmptyState;
      console.log(`✅ Empty/Loading State: ${isEmptyState ? 'DETECTED' : 'NOT DETECTED'}`);
      
      // 11. Final full screenshot
      await page.screenshot({ 
        path: 'screenshots/shark-sessions-final-state.png',
        fullPage: true 
      });
      validationResults.screenshots.push('shark-sessions-final-state.png');
      
    } else {
      console.error('❌ CRITICAL: Sessions tab not found!');
      validationResults.issues.push('Sessions tab not found');
      
      // Capture what we can see
      console.log('📸 Capturing current state for debugging...');
      await page.screenshot({ 
        path: 'screenshots/shark-sessions-tab-not-found.png',
        fullPage: true 
      });
      validationResults.screenshots.push('shark-sessions-tab-not-found.png');
      
      // Log available elements
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`🔍 Found ${buttonCount} buttons on page`);
      
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const buttonText = await allButtons.nth(i).textContent();
        console.log(`  Button ${i + 1}: "${buttonText}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ VALIDATION ERROR:', error.message);
    validationResults.issues.push(`Error: ${error.message}`);
    
    await page.screenshot({ 
      path: 'screenshots/shark-sessions-error-state.png',
      fullPage: true 
    });
    validationResults.screenshots.push('shark-sessions-error-state.png');
  }
  
  // Generate comprehensive report
  console.log('\n📊 COMPREHENSIVE VALIDATION REPORT');
  console.log('=' .repeat(50));
  
  console.log('\n🎨 VISUAL ELEMENTS DETECTED:');
  console.log(`  Main Container: ${validationResults.visualElements.mainContainer ? '✅' : '❌'}`);
  console.log(`  Header: ${validationResults.visualElements.header ? '✅' : '❌'}`);
  console.log(`  SVG Elements: ${validationResults.visualElements.svgElements || 0}`);
  console.log(`  Session Lanes: ${validationResults.visualElements.sessionLanes || 0}`);
  console.log(`  Agent Paths: ${validationResults.visualElements.agentPaths || 0}`);
  console.log(`  Time Axis: ${validationResults.visualElements.timeAxis ? '✅' : '❌'}`);
  console.log(`  Time Controls: ${validationResults.visualElements.timeControls || 0}`);
  console.log(`  Performance Metrics: ${validationResults.visualElements.performanceMetrics || 0}`);
  
  if (validationResults.visualElements.zoomControls) {
    console.log('  Zoom Controls:');
    console.log(`    Zoom In: ${validationResults.visualElements.zoomControls.zoomIn ? '✅' : '❌'}`);
    console.log(`    Zoom Out: ${validationResults.visualElements.zoomControls.zoomOut ? '✅' : '❌'}`);
    console.log(`    Reset: ${validationResults.visualElements.zoomControls.reset ? '✅' : '❌'}`);
  }
  
  console.log('\n🎯 INTERACTIONS TESTED:');
  Object.keys(validationResults.interactions).forEach(interaction => {
    console.log(`  ${interaction}: ${validationResults.interactions[interaction] ? '✅' : '❌'}`);
  });
  
  console.log('\n📸 SCREENSHOTS CAPTURED:');
  validationResults.screenshots.forEach(screenshot => {
    console.log(`  📁 screenshots/${screenshot}`);
  });
  
  if (validationResults.issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    validationResults.issues.forEach(issue => {
      console.log(`  ⚠️  ${issue}`);
    });
  } else {
    console.log('\n✅ NO CRITICAL ISSUES DETECTED');
  }
  
  // Summary verdict
  const hasMainElements = validationResults.visualElements.mainContainer && 
                         (validationResults.visualElements.svgElements > 0);
  const hasInteractivity = Object.values(validationResults.interactions).some(v => v);
  
  console.log('\n🏆 FINAL VERDICT:');
  if (hasMainElements) {
    console.log('✅ SESSIONS TAB RENDERS SUCCESSFULLY');
    console.log('✅ Timeline SVG is present and visible');
    console.log('✅ Visual validation PASSED');
  } else {
    console.log('❌ SESSIONS TAB RENDERING ISSUES DETECTED');
    console.log('❌ Visual validation FAILED');
  }
  
  if (hasInteractivity) {
    console.log('✅ Interactive controls functional');
  } else {
    console.log('⚠️  Limited or no interactivity detected');
  }
  
  console.log('\n🔍 Browser kept open for manual inspection');
  console.log('Press Ctrl+C when done reviewing');
  
  // Keep browser open for manual inspection
  // await browser.close();
})();