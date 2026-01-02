import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: './',
  build: {
    outDir: '../ui/build',  // Build into React's build directory
    emptyOutDir: false,  // Don't clear the directory (React builds first)
  },
  server: {
    port: 3000,
  },
  define: {
    // Mock Docker Desktop API in development
    ...(process.env.NODE_ENV !== 'production' && {
      'window.ddClient': 'undefined',
    }),
  },
});
