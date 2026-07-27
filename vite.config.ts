import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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

/**
 * Run the `api/` serverless functions inside `vite dev`.
 *
 * Vercel serves `api/*.ts` as functions in production, but the Vite dev server
 * knows nothing about them — it 404s `/api/...` with an empty body, which the
 * client can only report as a generic failure. This plugin closes that gap so
 * `npm run dev` exercises the real handlers (no Vercel CLI required):
 *
 *   /api/consultations/room  →  api/consultations/room.ts  (default export)
 *
 * It shims the two pieces of `@vercel/node` the handlers actually use — a
 * parsed `req.body` and the `res.status().json()` chain — and loads modules
 * through `ssrLoadModule` so TypeScript is transpiled on the fly.
 */
function serveApiInDev(): Plugin {
  const root = dirname(fileURLToPath(import.meta.url));

  return {
    name: 'md-serve-api-dev',
    apply: 'serve',
    configureServer(server) {
      // Server-side secrets (DAILY_API_KEY, FIREBASE_*) have no VITE_ prefix,
      // so Vite does not expose them. Load them into process.env for the
      // handlers only — they never reach the browser bundle.
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith('VITE_') && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      server.middlewares.use((req, res, next) => {
        const path = (req.url || '/').split('?')[0];
        if (!path.startsWith('/api/')) return next();

        void (async () => {
          const rel = path.slice('/api/'.length);
          // Reject traversal before it ever reaches the filesystem.
          if (!rel || rel.includes('..')) return next();

          const file = resolve(root, 'api', `${rel}.ts`);
          if (!file.startsWith(resolve(root, 'api')) || !existsSync(file)) return next();

          const fail = (status: number, error: string) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error, code: 'server_error' }));
          };

          try {
            const mod = await server.ssrLoadModule(file);
            const handler = (mod as { default?: (q: unknown, s: unknown) => Promise<void> }).default;
            if (typeof handler !== 'function') {
              return fail(500, `api/${rel}.ts has no default export.`);
            }

            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const raw = Buffer.concat(chunks).toString('utf8');

            let body: unknown;
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                return fail(400, 'Request body was not valid JSON.');
              }
            }

            const vercelRes = Object.assign(res, {
              status(code: number) {
                res.statusCode = code;
                return vercelRes;
              },
              json(data: unknown) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return vercelRes;
              },
              send(data: unknown) {
                res.end(typeof data === 'string' ? data : JSON.stringify(data));
                return vercelRes;
              },
            });

            await handler(Object.assign(req, { body }), vercelRes);
          } catch (err) {
            console.error(`[dev-api] ${rel} failed`, err);
            fail(500, err instanceof Error ? err.message : 'Dev API handler failed.');
          }
        })();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/app/',
  plugins: [serveLandingInDev(), serveApiInDev(), react()],
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
