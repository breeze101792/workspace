import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom gives us a real DOM for window-manager / explorer / search tests.
    environment: 'jsdom',
    include: ['frontend/tests/**/*.test.js'],
    globals: false,
  },
});
