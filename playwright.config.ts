import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  workers: 1, // PDF canvases are intentionally rendered one at a time.
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    deviceScaleFactor: 2,
    launchOptions: {
      // Optional system Chromium for sandbox / CI environments.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage']
    }
  },
  webServer: {
    command: 'npx vite --host 0.0.0.0 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
});
