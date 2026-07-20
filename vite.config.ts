import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// The React app is served UNDER /app (the marketing landing page owns /).
// base + BrowserRouter basename keep asset URLs and routes correct.
// The app builds into dist/app/; the landing page is assembled into
// dist/index.html by the build script (see package.json).

/**
 * Serve the marketing landing page at `/` during `vite dev`, so the dev server
 * mirrors production (landing at /, app at /app/). Without this the dev server
 * only serves the app under /app/ and `/` just 302-redirects there. Registered
 * before Vite's internal middlewares so it wins over the base redirect.
 */
function serveLandingInDev(): Plugin {
  const landingUrl = new URL('./landing/index.html', import.meta.url);
  return {
    name: 'md-serve-landing-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '/').split('?')[0];
        if (path === '/' || path === '/index.html') {
          try {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readFileSync(landingUrl, 'utf-8'));
            return;
          } catch (err) {
            next(err as Error);
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/app/',
  plugins: [serveLandingInDev(), react()],
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
