import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app is served UNDER /app (the marketing landing page owns /).
// base + BrowserRouter basename keep asset URLs and routes correct.
// It builds into dist/app/; the landing page is assembled into dist/index.html
// by the build script (see package.json).
// https://vitejs.dev/config/
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          router: ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
