import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // Mock the Docker extension API client for dev server (used by E2E tests)
      '@docker/extension-api-client': path.resolve(__dirname, 'src/__mocks__/docker-extension-api-client.ts'),
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
});
