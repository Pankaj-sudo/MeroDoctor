import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Split heavy, rarely-changing vendors into their own long-cached chunks.
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
