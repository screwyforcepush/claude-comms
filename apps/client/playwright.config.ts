import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * Manages test server lifecycle to prevent zombie processes
 */
export default defineConfig({
  testDir: './tests/playwright',
  
  // Fail fast on CI
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  
  // CRITICAL: Limit workers to prevent resource exhaustion
  workers: process.env.CI ? 1 : 1,
  
  // Reporter configuration
  reporter: 'html',
  
  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // CRITICAL: Manage dev server lifecycle
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // Ensure server shuts down after tests
    stdout: 'pipe',
    stderr: 'pipe',
  },
});