// ============================================================================
// server.js — standard, zero-dependency Node.js server for the production build.
//
// Serves the static bundle in ./dist with:
//   • SPA history fallback (unknown paths → index.html, for client-side routing)
//   • long-term immutable caching for hashed /assets, no-cache for index.html
//   • path-traversal protection
//
// Usage:   npm run build   &&   node server.js
// Env:     PORT (default 3000)   HOST (default 0.0.0.0)
//
// This is for self-hosting (a VPS, container, Render, Railway, etc.). Vercel does
// NOT use this file — it serves ./dist statically itself (see DEPLOYMENT.md).
// ============================================================================
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    let filePath = resolve(DIST, rel);

    // Block path traversal (e.g. /../../etc/passwd).
    if (filePath !== DIST && !filePath.startsWith(DIST + sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    let ext = extname(filePath).toLowerCase();
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // Not on disk → SPA fallback so client-side routes (/dashboard, …) work.
      filePath = join(DIST, 'index.html');
      ext = '.html';
      body = await readFile(filePath);
    }

    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (filePath.includes(`${sep}assets${sep}`)) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch (err) {
    console.error('[server] request failed', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✓ MeroDoctor — serving ./dist at http://localhost:${PORT}`);
});
