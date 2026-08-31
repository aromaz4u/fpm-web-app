# FPM web app (standalone)

This is the FPM prototype as a real, deployable website — not a Claude.ai artifact preview.
That matters because Claude.ai's artifact sandbox blocks outbound network requests to
anything except a small fixed allowlist of CDN domains (a browser-level security policy,
`Content-Security-Policy: connect-src`). That's what was silently breaking every attempt
to call a real backend from inside the artifact. A real website has no such restriction —
once deployed here, it can call your backend normally.

This app talks to the backend in `/fpm-video-backend` for **everything AI-related**:
competitor analysis, ad script generation, AI customization, and real Runway/Wan video
generation. Deploy that backend first (see its own README), then come back here.

## Local development

```bash
npm install
cp .env.example .env
```

Open `.env` and set `VITE_API_BASE_URL` to your backend's URL (e.g.
`http://localhost:8787` if you're running the backend locally too, per its README).

```bash
npm run dev
```

Opens at `http://localhost:5173` (Vite's default). This is a real page in a real browser
tab — none of the Claude.ai artifact restrictions apply here.

## Deploying for real

Either of these works the same general way: connect a Git repo, they auto-detect Vite,
you set one environment variable, done.

### Vercel

1. Push this `fpm-web-app` folder to a GitHub repo (can be the same repo as the backend,
   in a subfolder, or a separate repo — either is fine).
2. Go to vercel.com, sign in, **Add New → Project**, import that repo.
3. Vercel auto-detects the Vite framework preset — leave build command
   (`npm run build`) and output directory (`dist`) as detected.
4. Under **Environment Variables**, add `VITE_API_BASE_URL` set to your deployed
   backend's URL (from Render, e.g. `https://fpm-video-backend.onrender.com`).
5. Click **Deploy**. Vercel gives you a public URL when it finishes.

### Netlify

1. Push to GitHub as above.
2. Go to netlify.com, **Add new site → Import an existing project**, pick the repo.
3. Build command: `npm run build`. Publish directory: `dist`.
4. Under **Site configuration → Environment variables**, add `VITE_API_BASE_URL` the
   same way as above.
5. Deploy.

## Important: `VITE_API_BASE_URL` is baked in at build time

Vite environment variables are compiled into the built JavaScript — they are not read at
runtime from the server. If you change the backend URL later, you need to update the env
var in Vercel/Netlify's dashboard **and trigger a new deploy** for it to take effect.

If you'd rather not hardcode a default at all (e.g. you're distributing this app and want
each user to configure their own backend), just leave `VITE_API_BASE_URL` unset — the
app's Accounts page lets anyone paste in a backend URL directly, stored in their own
browser's localStorage, which always overrides the build-time default.

## What changed from the Claude.ai artifact version

- `askClaude()` now calls your backend's `/api/ask-claude` route instead of a
  Claude.ai-only proxy that doesn't exist outside the sandbox.
- `window.storage` (the artifact's built-in persistence API) is now polyfilled by
  `src/storageShim.js` on top of real browser `localStorage` — same interface, so no
  other code needed to change.
- Everything else — the UI, the Runway/Wan integration, the free instant storyboard
  render, leads/CRM, funnels, etc. — is the same code as the artifact version.
