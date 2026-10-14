import path from 'path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests/e2e'),
  testMatch: /.*\.spec\.ts/,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
