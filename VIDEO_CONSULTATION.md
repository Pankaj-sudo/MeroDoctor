# Video Consultation — Setup & Test Guide

Secure, provider-agnostic HD video consultations (default provider: **Daily.co**).
Patients and the assigned doctor join an encrypted room from inside the app after
the doctor approves the consultation.

- Secrets (Daily key, Firebase Admin key) live **only** on the server
  (Vercel serverless functions in `api/`), never in the browser bundle.
- Rooms are private at the provider; a leaked room URL is useless without a
  server-minted, per-user join token.
- Swapping providers (Zoom / LiveKit / Agora / Twilio / Meet) means writing one
  adapter — see the interfaces in `api/_lib/providers/types.ts` and
  `src/services/video/types.ts`.

---

## 1. Environment variables

Two audiences. **`VITE_`-prefixed = browser** (safe to expose). **No prefix =
server-only secret** (never prefix these with `VITE_` or they leak into the bundle).

### Server-only (required)
| Variable | Where it comes from |
|---|---|
| `DAILY_API_KEY` | dashboard.daily.co → Developers → API keys |
| `VIDEO_PROVIDER` | optional; defaults to `daily` |
| `FIREBASE_PROJECT_ID` | `merodoctor-baaa7` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` in the service-account JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` in the JSON — keep the `\n`s, wrap in double quotes |

Firebase Admin JSON: Firebase console → Project settings → **Service accounts**
→ **Generate new private key**.

### Where to put them
- **Local dev** → `.env.local` (gitignored). Read at server startup.
- **Production** → Vercel → Settings → Environment Variables, then **Redeploy**
  (Vercel does NOT apply env changes to the existing deployment).

---

## 2. Deploy the Firestore rules

The video collections (`videoRooms`, `consultationMessages`, `consultationEvents`)
are denied until the updated `firestore.rules` is live.

One-time login, then deploy in one command:

```bash
npx firebase-tools login
npm run deploy:rules        # firestore:rules + storage rules
```

(Or paste `firestore.rules` into Firebase console → Firestore → Rules → Publish.)

`firebase.json`, `.firebaserc` and `firestore.indexes.json` are already set up.
No composite indexes are needed.

---

## 3. Run locally

```bash
npm run dev
```

`vite.config.ts` runs the `api/` functions in-process during dev (no Vercel CLI
needed). **After changing `vite.config.ts` or `.env.local`, fully restart** —
Vite hot-reloads `src/` but never its own config or env.

> Rule of thumb: changed `src/*`? hot reload handles it. Changed `vite.config.ts`
> or `.env.local`? Stop and restart `npm run dev`, then hard-refresh the browser
> (Cmd+Shift+R).

---

## 4. The flow

```
Patient books → pays → doctor verifies payment
  → doctor: "Approve & open video room"   (assigns + provisions the room)
  → patient sees Join button (or a countdown, if scheduled)
  → both join the encrypted room → consult + chat + screen share
  → doctor: "End consultation"            (tears the room down)
  → doctor writes prescription → patient views it
```

- **Consult Now** (default): join opens the moment the room is created.
- **Scheduled**: join opens 15 min before the time (`JOIN_WINDOW_BEFORE_MINUTES`
  in `src/config/video.ts`). All timing constants live there.

---

## 5. Test checklist

Sign in with two accounts (doctor = `pankaj.ydv707@gmail.com`, plus any patient
account) in two browsers / a normal + incognito window.

- [ ] Doctor: open a payment-verified consultation
- [ ] Doctor: **Approve & open video room** → no error
- [ ] Patient: consultation shows **Join** (or a countdown if scheduled)
- [ ] Patient: Join → camera + mic prompt → sees own video
- [ ] Doctor: Join → both see each other
- [ ] Mute / camera toggle work on both sides
- [ ] Doctor: screen share works (patient has no share button — by design)
- [ ] Chat: message from each side appears on the other, with timestamps
- [ ] Connection quality indicator + call timer render
- [ ] Doctor: **End consultation** → room closes for both
- [ ] Patient can no longer rejoin (join gate closed)
- [ ] A third, unrelated signed-in account visiting `/consultation/<id>/room`
      is blocked ("not yours")
- [ ] Mobile Safari: video autoplays, controls reachable, chat usable

### Credential self-checks (no real call needed)
```bash
# Firebase Admin creds valid? → expect 401 (not 500):
curl -s -X POST http://localhost:5173/api/consultations/join \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer fake' \
  -d '{"consultationId":"x"}'

# Daily key valid? → expect HTTP 200:
curl -s -o /dev/null -w "%{http_code}\n" https://api.daily.co/v1/ \
  -H "Authorization: Bearer $DAILY_API_KEY"
```

---

## 6. Reading errors

Dev shows the real cause on screen; production shows friendly copy and logs the
detail server-side (Vercel → your function's logs).

| Symptom | Cause | Fix |
|---|---|---|
| `HTTP 404 at /api/...` | dev server started before `api/` existed | restart `npm run dev` |
| `FIREBASE_… is not configured` | server env var missing | add to `.env.local` / Vercel + restart/redeploy |
| `Server error: …DECODER…` / PEM error | `FIREBASE_PRIVATE_KEY` mangled | re-paste with `\n`s intact, in double quotes |
| Room reads denied | rules not published | `npm run deploy:rules` |
| Generic "Something went wrong" text | stale browser bundle | hard-refresh (Cmd+Shift+R) |

---

## 7. Security notes

- Only the assigned patient and clinical staff can create/join/read a room —
  re-verified server-side on every request, not just in the UI.
- Room names carry 128 bits of entropy and are never reused.
- Chat is immutable (no edit/delete) — it's a clinical record.
- If an API key ever appears in a screenshot, chat, or commit, **rotate it**
  (Daily dashboard / regenerate the Firebase service-account key).

## 8. Future

Recording (Daily cloud recording + explicit medical consent), AI transcription
into the SOAP fields, multi-doctor (scope room access to `assignedDoctorId`
before adding a second doctor), and a pre-join device check are the natural next
steps. See the end of the implementation notes for details.
