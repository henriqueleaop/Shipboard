import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    browserName: 'chromium',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  outputDir: 'test-results',
});
