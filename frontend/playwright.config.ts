import { defineConfig, devices } from '@playwright/test'

// End-to-end tests in a real browser, against a running stack (web + api + postgres).
// They sign in with a real account and create data, so point them at a throw-away stack:
//
//   E2E_URL=http://localhost:8080 E2E_TENANT_ID=... E2E_EMAIL=... E2E_PASSWORD=... npm run e2e
//
// How to start such a stack locally: ../deploy/README.md ("ทดสอบ stack ในเครื่อง").
export default defineConfig({
  testDir: './e2e',
  // The tests share one account and one database; run them in order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:8080',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
