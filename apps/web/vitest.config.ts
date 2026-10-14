import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['./tests/setup.ts'], exclude: ['tests/e2e/**'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
