import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // Mock the Docker extension API client during development/E2E testing only.
      // This allows the app to run outside of Docker Desktop for testing.
      // The browser-compatible mock provides a stub implementation that
      // doesn't throw errors and can be controlled via window.__mockDdClient.
      // In production builds, the real @docker/extension-api-client is used.
      ...(mode !== 'production' && {
        '@docker/extension-api-client': path.resolve(
          __dirname,
          'src/__mocks__/docker-extension-api-client-browser.ts'
        ),
      }),
    },
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
}));
