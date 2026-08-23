import { defineConfig } from '@playwright/test';

const port = Number(process.env.BROWSER_PORT || 3000);
const externalBase = process.env.BROWSER_BASE_URL || '';
const baseURL = externalBase || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs/,
  timeout: 240_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['line'],
    ['html', { outputFolder: '../../.artifacts/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: process.env.HEADED !== '1',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: externalBase ? undefined : {
    command: `bash -lc 'set -a; [ -f .env.local ] && source .env.local; set +a; npx vercel dev --listen ${port}'`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
