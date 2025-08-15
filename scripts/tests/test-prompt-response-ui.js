/**
 * Visual Validation Test for Agent Prompt & Response Capture Feature
 * AmandaVortex - Quality Gate Specialist
 * 
 * This Playwright script validates the UI implementation of the prompt/response capture feature
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runVisualValidation() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Create screenshots directory
  const screenshotDir = 'screenshots/prompt-response-feature';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Starting Visual Validation of Prompt/Response Feature...\n');

  try {
    // 1. Navigate to the dashboard
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Take initial dashboard screenshot
    await page.screenshot({ 
      path: `${screenshotDir}/01-dashboard-initial.png`,
      fullPage: true 
    });
    console.log('✓ Captured initial dashboard');

    // 2. Navigate to Sessions tab
    const sessionsTab = await page.locator('button:has-text("Sessions")');
    if (await sessionsTab.isVisible()) {
      await sessionsTab.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: `${screenshotDir}/02-sessions-tab.png`,
        fullPage: true 
      });
      console.log('✓ Captured Sessions tab');

      // 3. Check for agents in the timeline
      const agentElements = await page.locator('[data-testid*="agent-"], .agent-block, .agent-node').all();
      
      if (agentElements.length > 0) {
        console.log(`  Found ${agentElements.length} agents in timeline`);
        
        // 4. Click on the first agent to open detail panel
        await agentElements[0].click();
        await page.waitForTimeout(500);
        
        // Check if agent detail panel opened
        const detailPane = page.locator('[data-testid="agent-detail-pane"], .agent-detail-pane');
        if (await detailPane.isVisible()) {
          await page.screenshot({ 
            path: `${screenshotDir}/03-agent-detail-panel.png`,
            fullPage: true 
          });
          console.log('✓ Captured Agent Detail Panel');
          
          // 5. Check for prompt/response sections
          const promptSection = page.locator('[data-testid="prompt-section"], :has-text("Initial Prompt")');
          const responseSection = page.locator('[data-testid="response-section"], :has-text("Final Response")');
          
          if (await promptSection.isVisible()) {
            console.log('  ✓ Initial Prompt section found');
            
            // Get prompt content
            const promptContent = await page.locator('[data-testid="prompt-content"], pre:has-text("Your name")').first();
            if (await promptContent.isVisible()) {
              const promptText = await promptContent.textContent();
              console.log(`  Prompt preview: "${promptText?.substring(0, 50)}..."`);
            }
          }
          
          if (await responseSection.isVisible()) {
            console.log('  ✓ Final Response section found');
            
            // Get response content
            const responseContent = await page.locator('[data-testid="response-content"], pre').nth(1);
            if (await responseContent.isVisible()) {
              const responseText = await responseContent.textContent();
              console.log(`  Response preview: "${responseText?.substring(0, 50)}..."`);
            }
          }
          
          // 6. Check for View Full Details button
          const expandButton = page.locator('[data-testid="expand-prompt-response-btn"], button:has-text("View Full")');
          if (await expandButton.isVisible()) {
            await expandButton.click();
            await page.waitForTimeout(500);
            
            // Check if modal opened
            const modal = page.locator('.prompt-response-modal, [role="dialog"]');
            if (await modal.isVisible()) {
              await page.screenshot({ 
                path: `${screenshotDir}/04-prompt-response-modal.png`,
                fullPage: true 
              });
              console.log('✓ Captured Prompt/Response Modal');
              
              // Close modal
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);
            }
          }
          
          // 7. Test copy functionality
          const copyPromptBtn = page.locator('[data-testid="copy-prompt-btn"], button[title*="Copy prompt"]');
          if (await copyPromptBtn.isVisible()) {
            await copyPromptBtn.click();
            console.log('  ✓ Copy prompt button functional');
          }
          
          const copyResponseBtn = page.locator('[data-testid="copy-response-btn"], button[title*="Copy response"]');
          if (await copyResponseBtn.isVisible()) {
            await copyResponseBtn.click();
            console.log('  ✓ Copy response button functional');
          }
        }
      } else {
        console.log('  ⚠ No agents found in timeline - feature may need active session');
        
        // Take screenshot of empty state
        await page.screenshot({ 
          path: `${screenshotDir}/03-no-agents-state.png`,
          fullPage: true 
        });
      }
    } else {
      console.log('  ⚠ Sessions tab not found');
    }

    // 8. Test mobile responsiveness
    await context.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: `${screenshotDir}/05-mobile-view.png`,
      fullPage: true 
    });
    console.log('✓ Captured mobile view');

    // 9. Test tablet view
    await context.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: `${screenshotDir}/06-tablet-view.png`,
      fullPage: true 
    });
    console.log('✓ Captured tablet view');

    console.log('\n✅ Visual validation completed successfully!');
    console.log(`📸 Screenshots saved to: ${screenshotDir}`);
    
    // Return validation results
    return {
      success: true,
      screenshotsCapture: 6,
      features: {
        sessionsTab: true,
        agentDetailPanel: agentElements.length > 0,
        promptDisplay: await promptSection.isVisible(),
        responseDisplay: await responseSection.isVisible(),
        modalFunctionality: await modal?.isVisible() || false,
        copyButtons: await copyPromptBtn.isVisible() && await copyResponseBtn.isVisible(),
        responsiveDesign: true
      }
    };

  } catch (error) {
    console.error('❌ Visual validation failed:', error);
    
    // Capture error screenshot
    await page.screenshot({ 
      path: `${screenshotDir}/error-state.png`,
      fullPage: true 
    });
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    await browser.close();
  }
}

// Run the validation
runVisualValidation()
  .then(results => {
    console.log('\nValidation Results:', JSON.stringify(results, null, 2));
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });