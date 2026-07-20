# Deploying MeroDoctor

The MeroDoctor app is a **Vite + React + TypeScript** single-page app that talks to
Firebase (Auth + Firestore + Storage). This guide covers deploying it to **Vercel**
(recommended) and to a **standard Node.js server** (self-hosting).

---

## Project structure — development vs. deployment

Everything you edit lives in the **project root**; the deployable output is generated
into **`dist/`**.

```
MeroDoctor/
├── src/                 # source code (components, pages, services, context…)
├── index.html           # app HTML entry
├── package.json         # deps + scripts
├── vite.config.ts       # build config
├── tsconfig*.json        # TypeScript config
├── server.js            # zero-dep Node.js static server (self-hosting)
├── vercel.json          # Vercel SPA rewrites + asset caching
├── .env.local           # local Firebase config (gitignored — NOT deployed)
├── node_modules/        # dependencies (gitignored — reinstalled on build)
└── dist/                # ← PRODUCTION BUILD (generated; gitignored)
    ├── index.html
    └── assets/          # hashed JS/CSS — the only files a host needs to serve
```

- **Committed to git:** source, config, `server.js`, `vercel.json`, `DEPLOYMENT.md`.
- **Never committed (see `.gitignore`):** `node_modules/`, `dist/`, caches, logs, `.env.local`.
- **The deployment package is `dist/` only** — no source, no `node_modules`, no config.

---

## Prerequisites

- **Node.js ≥ 18** and npm.
- Firebase web config (project `merodoctor-baaa7`) — the six `VITE_FIREBASE_*` values.

---

## Build (produces `dist/`)

```bash
npm install        # first time only (or `npm ci` for a clean, lockfile-exact install)
npm run build      # type-checks, then builds → dist/
```

`dist/` now contains only what a host serves: `index.html` + hashed `assets/`.

> ⚠️ **Environment variables are baked in at build time.** Vite inlines every
> `VITE_*` value when `npm run build` runs, so the config must be present *before*
> the build. Locally that's `.env.local`; on Vercel it's the dashboard env vars
> (below). If they're missing the app shows a **"Setup needed"** screen.

---

## Option A — Deploy to Vercel (recommended)

1. **Push to GitHub** (already done): `git push origin main`.
2. In Vercel → **Add New… → Project** → import `Pankaj-sudo/MeroDoctor`.
3. **Framework Preset:** Vite · **Root Directory:** `/` (repo root).
   Build Command `npm run build` and Output Directory `dist` are set by `vercel.json`.
4. **Settings → Environment Variables** → add all six for **Production** *and* **Preview**:

   ```
   VITE_FIREBASE_API_KEY=AIzaSyD43R1ilpEcLAvv2gq52x9sZf8aJWuFctU
   VITE_FIREBASE_AUTH_DOMAIN=merodoctor-baaa7.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=merodoctor-baaa7
   VITE_FIREBASE_STORAGE_BUCKET=merodoctor-baaa7.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=790065955827
   VITE_FIREBASE_APP_ID=1:790065955827:web:9f596938ecdecf71828886
   ```

5. **Deploy** (or **Redeploy** if the vars were added after the first deploy — env
   changes only apply to a *new* build).

`vercel.json` rewrites all client routes to `index.html`, so deep-links and refresh
(e.g. `/dashboard`) work, and hashed assets get a 1-year immutable cache.

---

## Option B — Self-host with a standard Node.js server

`server.js` is a zero-dependency Node server (built-in `http` only) that serves
`dist/` with SPA fallback and correct caching.

```bash
# 1. Build with your Firebase config present (e.g. in .env.local)
npm ci
npm run build

# 2. Serve the build
npm start                 # → http://localhost:3000
PORT=8080 npm start       # custom port
```

**What to deploy to the server:** only `dist/`, `server.js`, and `package.json`
(plus a Node runtime). You do **not** need `src/`, `node_modules`, or dev config on
the server — `server.js` has no dependencies.

**Production tips**
- Keep it running with a process manager: `pm2 start server.js --name merodoctor`.
- Put it behind Nginx/Caddy for TLS; proxy to `PORT`.
- Or skip `server.js` entirely and use any static host: `npx serve -s dist`.

Containerized (example):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # pass VITE_FIREBASE_* as build args/env here
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Firebase Console — required for Google sign-in to work

Independent of the host, in the [Firebase Console](https://console.firebase.google.com)
(project `merodoctor-baaa7`):

1. **Authentication → Sign-in method → enable Google** (set a support email).
2. **Authentication → Settings → Authorised domains** → add your deploy domain
   (`merodoctor.vercel.app`, plus any custom domain). `localhost` is there for dev.
3. **Firestore** → create the database and deploy security rules for `users/{uid}`
   (owner read/write; self-role limited to `patient`).

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| **Blank screen** / `auth/invalid-api-key` in console | `VITE_FIREBASE_*` not set at build time | Add them to Vercel env (or `.env.local`) and **rebuild/redeploy** |
| **"Setup needed"** screen | Same as above, handled gracefully | Same fix |
| **404 on refresh at `/dashboard`** | Missing SPA fallback | `vercel.json` handles it on Vercel; `server.js` handles it when self-hosting |
| **Popup: `auth/unauthorized-domain`** | Deploy domain not authorised | Add it in Firebase → Auth → Settings → Authorised domains |
| **Popup: `auth/operation-not-allowed`** | Google provider disabled | Enable it in Firebase → Auth → Sign-in method |
