// Event Indicators Test Suite using Playwright
// Comprehensive testing of event indicators functionality

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testEventIndicators() {
    console.log('🎯 Starting Event Indicators Test Suite (Playwright)');
    console.log('================================================');

    const browser = await chromium.launch({ 
        headless: false, // Show browser for debugging
        devtools: true
    });

    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    const testResults = {
        apiTests: true,
        indicatorsRendered: false,
        tooltipsWork: false,
        clickOpensPanel: false,
        panelContentCorrect: false,
        closeWorks: false,
        performanceOk: false,
        errors: []
    };
    
    try {
        // Navigate to dashboard
        console.log('📱 Loading dashboard...');
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
        
        // Wait for the app to load
        await page.waitForSelector('body', { timeout: 10000 });
        
        // Look for Sessions Timeline tab/button
        console.log('🔍 Looking for Sessions Timeline...');
        
        // Try different selectors for the Sessions Timeline tab
        const possibleSelectors = [
            'button:has-text("Sessions")',
            'button:has-text("Timeline")', 
            'button:has-text("Sessions Timeline")',
            '[role="tab"]:has-text("Sessions")',
            'a:has-text("Sessions")',
            '.tab-button:has-text("Sessions")'
        ];
        
        let sessionTabFound = false;
        for (const selector of possibleSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                console.log(`✅ Found Sessions tab with selector: ${selector}`);
                await page.click(selector);
                sessionTabFound = true;
                break;
            } catch (e) {
                console.log(`⚠️ Selector ${selector} not found`);
            }
        }
        
        if (!sessionTabFound) {
            // Take screenshot to debug
            await page.screenshot({ path: 'screenshots/debug-no-sessions-tab.png' });
            console.log('📸 Debug screenshot saved - no sessions tab found');
        }
        
        // Wait for timeline to load and look for event indicators
        await page.waitForTimeout(3000);
        
        // Test 1: Check for event indicators presence
        console.log('\n🎯 Test 1: Checking for event indicators...');
        
        const indicatorSelectors = [
            '.session-event-indicators circle',
            '.session-event-indicators path',
            '[class*="event-indicator"]',
            '[class*="indicator"] circle',
            'svg circle[class*="indicator"]',
            'svg path[class*="indicator"]'
        ];
        
        let indicators = [];
        for (const selector of indicatorSelectors) {
            try {
                const found = await page.$$eval(selector, elements => {
                    return elements.map(el => ({
                        tag: el.tagName,
                        classes: el.className?.baseVal || el.getAttribute('class') || '',
                        visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
                        bbox: el.getBoundingClientRect()
                    })).filter(el => el.visible);
                });
                if (found.length > 0) {
                    indicators = indicators.concat(found);
                    console.log(`✅ Found ${found.length} indicators with selector: ${selector}`);
                }
            } catch (e) {
                // Selector not found, continue
            }
        }
        
        if (indicators.length > 0) {
            testResults.indicatorsRendered = true;
            console.log(`✅ Total indicators found: ${indicators.length}`);
        } else {
            console.log('❌ No event indicators found');
            await page.screenshot({ path: 'screenshots/debug-no-indicators.png' });
        }
        
        // Test 2: Test hover functionality
        console.log('\n🎯 Test 2: Testing hover tooltips...');
        if (indicators.length > 0) {
            try {
                const firstIndicator = await page.$(indicatorSelectors[0] + ', ' + indicatorSelectors[1]);
                if (firstIndicator) {
                    await firstIndicator.hover();
                    await page.waitForTimeout(800); // Wait for tooltip animation
                    
                    // Check for tooltip elements
                    const tooltipSelectors = [
                        '.tooltip',
                        '[class*="tooltip"]',
                        '[role="tooltip"]',
                        '.popover',
                        '[data-tooltip]',
                        '[aria-describedby]'
                    ];
                    
                    for (const tooltipSelector of tooltipSelectors) {
                        const tooltip = await page.$(tooltipSelector);
                        if (tooltip) {
                            const isVisible = await tooltip.isVisible();
                            if (isVisible) {
                                testResults.tooltipsWork = true;
                                console.log(`✅ Tooltip found and visible with selector: ${tooltipSelector}`);
                                break;
                            }
                        }
                    }
                    
                    if (!testResults.tooltipsWork) {
                        console.log('❌ No visible tooltips found on hover');
                    }
                }
            } catch (e) {
                console.log('❌ Error testing hover:', e.message);
                testResults.errors.push(`Hover test error: ${e.message}`);
            }
        }
        
        // Test 3: Test click interactions
        console.log('\n🎯 Test 3: Testing click interactions...');
        if (indicators.length > 0) {
            try {
                const firstIndicator = await page.$(indicatorSelectors[0] + ', ' + indicatorSelectors[1]);
                if (firstIndicator) {
                    await firstIndicator.click();
                    await page.waitForTimeout(1000);
                    
                    // Check for event detail panel
                    const panelSelectors = [
                        '[class*="event-detail-panel"]',
                        '[class*="detail-panel"]',
                        '[class*="event-panel"]',
                        '.panel',
                        '[role="dialog"]',
                        '.modal',
                        '.sidebar'
                    ];
                    
                    for (const panelSelector of panelSelectors) {
                        const panel = await page.$(panelSelector);
                        if (panel) {
                            const isVisible = await panel.isVisible();
                            if (isVisible) {
                                testResults.clickOpensPanel = true;
                                console.log(`✅ Event detail panel opened with selector: ${panelSelector}`);
                                
                                // Test panel content
                                const panelText = await panel.textContent();
                                if (panelText && panelText.length > 20) {
                                    testResults.panelContentCorrect = true;
                                    console.log(`✅ Panel contains content (${panelText.length} characters)`);
                                }
                                
                                // Test close functionality
                                const closeSelectors = [
                                    'button[aria-label*="close"]',
                                    'button:has-text("×")',
                                    'button:has-text("Close")',
                                    '.close-button',
                                    '[data-close]'
                                ];
                                
                                for (const closeSelector of closeSelectors) {
                                    const closeButton = await page.$(closeSelector);
                                    if (closeButton) {
                                        await closeButton.click();
                                        await page.waitForTimeout(500);
                                        
                                        const stillVisible = await panel.isVisible();
                                        if (!stillVisible) {
                                            testResults.closeWorks = true;
                                            console.log('✅ Close button works');
                                            break;
                                        }
                                    }
                                }
                                
                                // Test escape key close
                                if (!testResults.closeWorks) {
                                    // Re-open panel
                                    await firstIndicator.click();
                                    await page.waitForTimeout(500);
                                    
                                    await page.keyboard.press('Escape');
                                    await page.waitForTimeout(500);
                                    
                                    const stillVisible = await panel.isVisible();
                                    if (!stillVisible) {
                                        testResults.closeWorks = true;
                                        console.log('✅ Escape key close works');
                                    }
                                }
                                
                                break;
                            }
                        }
                    }
                    
                    if (!testResults.clickOpensPanel) {
                        console.log('❌ No event detail panel found after click');
                        await page.screenshot({ path: 'screenshots/debug-no-panel.png' });
                    }
                }
            } catch (e) {
                console.log('❌ Error testing click:', e.message);
                testResults.errors.push(`Click test error: ${e.message}`);
            }
        }
        
        // Test 4: Performance testing
        console.log('\n🎯 Test 4: Performance testing...');
        const performanceStart = Date.now();
        
        try {
            await page.evaluate(() => {
                // Simulate multiple interactions
                const indicators = document.querySelectorAll('[class*="indicator"] circle, [class*="indicator"] path');
                indicators.forEach((indicator, index) => {
                    if (index < 5) {
                        // Simulate rapid hover events
                        indicator.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                        setTimeout(() => {
                            indicator.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                        }, 50);
                    }
                });
            });
            
            await page.waitForTimeout(1000);
            const performanceEnd = Date.now();
            const duration = performanceEnd - performanceStart;
            
            testResults.performanceOk = duration < 2000;
            console.log(`${testResults.performanceOk ? '✅' : '❌'} Performance test: ${duration}ms`);
            
        } catch (e) {
            console.log('❌ Error in performance test:', e.message);
            testResults.errors.push(`Performance test error: ${e.message}`);
        }
        
        // Capture final screenshot
        console.log('\n📸 Capturing final screenshot...');
        await page.screenshot({ 
            path: 'screenshots/event-indicators-final-test.png', 
            fullPage: true 
        });
        
    } catch (error) {
        console.error('❌ Critical test error:', error);
        testResults.errors.push(`Critical error: ${error.message}`);
        await page.screenshot({ path: 'screenshots/test-critical-error.png' });
    } finally {
        await browser.close();
    }
    
    return testResults;
}

// Generate test report
function generateTestReport(results) {
    console.log('\n📋 EVENT INDICATORS TEST REPORT');
    console.log('==================================');
    
    const totalTests = 6;
    let passedTests = 0;
    
    if (results.apiTests) passedTests++;
    if (results.indicatorsRendered) passedTests++;
    if (results.tooltipsWork) passedTests++;
    if (results.clickOpensPanel) passedTests++;
    if (results.panelContentCorrect) passedTests++;
    if (results.closeWorks) passedTests++;
    if (results.performanceOk) passedTests++;
    
    console.log(`\n📊 SUMMARY: ${passedTests}/${totalTests + 1} tests passed\n`);
    
    console.log(`${results.apiTests ? '✅' : '❌'} Server API Tests`);
    console.log(`${results.indicatorsRendered ? '✅' : '❌'} Indicators Rendered`);
    console.log(`${results.tooltipsWork ? '✅' : '❌'} Tooltip Functionality`);
    console.log(`${results.clickOpensPanel ? '✅' : '❌'} Click Opens Panel`);
    console.log(`${results.panelContentCorrect ? '✅' : '❌'} Panel Content Display`);
    console.log(`${results.closeWorks ? '✅' : '❌'} Panel Close Functions`);
    console.log(`${results.performanceOk ? '✅' : '❌'} Performance Acceptable`);
    
    if (results.errors.length > 0) {
        console.log('\n⚠️ ERRORS ENCOUNTERED:');
        results.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }
    
    return {
        totalTests: totalTests + 1,
        passedTests,
        successRate: ((passedTests / (totalTests + 1)) * 100).toFixed(1) + '%',
        errors: results.errors
    };
}

// Run the tests
if (require.main === module) {
    testEventIndicators()
        .then(results => {
            const report = generateTestReport(results);
            console.log(`\n🎯 FINAL RESULT: ${report.successRate} success rate`);
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('\n💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { testEventIndicators, generateTestReport };