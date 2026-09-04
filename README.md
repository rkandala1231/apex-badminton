# Apex Collegiate Badminton — React + TypeScript

The Apex tournament site, rebuilt as a React + TypeScript single-page app (Vite). Same live Supabase backend as the previous plain-HTML version (registration, admin dashboard, live analytics) — this rebuild focuses on mobile responsiveness and UI polish (motion, toasts, loading states, optimistic admin updates).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (theme tokens in `src/index.css`)
- `@supabase/supabase-js` — data, auth, RPC calls
- `@tanstack/react-query` — data fetching/caching/optimistic updates
- `react-router-dom` — `/` and `/admin` routes (admin code-split, lazy-loaded)
- `react-hook-form` + `zod` — registration form validation
- `framer-motion` — section reveals, chart entrances, mobile nav drawer
- `sonner` — toast notifications

## Environments — policy

**Only two environments exist: `dev` and `prod`. There is no QA environment, and there will not be
one going forward.** All validation and testing happens in `dev` before a change is promoted to
`prod` — there is no separate QA stage in between. That means exactly **two** live URLs for this
project:

| Environment | Branch | URL |
|---|---|---|
| Dev | `dev` | `apex-badminton-dev.vercel.app` |
| Prod | `main` | `apexclubj.vercel.app` — the real, public site |

A `qa` branch/environment (a third Vercel alias, a separate Postgres schema) existed earlier and
has been fully retired — see `ENVIRONMENTS.md` for what that involved and the one-time manual
cleanup it still needs on the Vercel/Supabase/GitHub side. Don't recreate a `qa` branch, Vercel
project, alias, or Supabase schema without updating this note and `ENVIRONMENTS.md` — the pipeline
(`.github/workflows/pipeline.yml`) and `src/lib/supabase.ts` are both written assuming only these
two environments exist.

See `CI_CD.md` for how the pipeline promotes `dev` → `prod`, and `DEV_GO_LIVE.md` for one-time
Vercel/GitHub setup.

## Local development

```bash
npm install
cp .env.example .env   # already has the live project's URL + publishable key
npm run dev
```

## Environment variables

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxfbocoktyfbiukxsyer.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the publishable/anon key from `.env.example` |

These are safe to expose client-side (that's what the anon/publishable key is for) — every table it touches is protected by Postgres row-level security, and public writes go through the `register_for_apex` RPC. No secret keys are used here.

## Deploying to Vercel (connected to your GitHub repo)

1. **Push this project to your `apex-badminton` GitHub repo.** You can replace the repo's contents entirely — the old `index.html` (GitHub Pages version) is no longer needed once Vercel is serving the site. From this project folder:
   ```bash
   git init
   git remote add origin https://github.com/rkandala1231/apex-badminton.git
   git add .
   git commit -m "Rebuild as React + TypeScript"
   git branch -M main
   git push -u origin main --force
   ```
   (`--force` only if you want this to fully replace the old GitHub Pages HTML — otherwise push to a new branch and merge.)

2. **Import the repo in Vercel**: [vercel.com/new](https://vercel.com/new) → select the `apex-badminton` repo. Vercel auto-detects Vite, no build config needed (`npm run build`, output `dist/`).

3. **Add the environment variables** in the Vercel project's Settings → Environment Variables, before the first deploy (or redeploy after adding them):
   - `VITE_SUPABASE_URL` = `https://xxfbocoktyfbiukxsyer.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the key from `.env.example`)

4. **Deploy.** Vercel gives you a `*.vercel.app` URL immediately; you can attach a custom domain afterward in Settings → Domains.

5. **Turn off GitHub Pages** (optional cleanup) in the repo's Settings → Pages, once you've confirmed the Vercel URL works — otherwise the two will coexist without conflict.

`vercel.json` in this project already handles SPA routing (so refreshing `/admin` doesn't 404), and the app auto-redirects the old `#admin` hash link to `/admin`.

## Project structure

```
src/
  components/
    sections/     HomeHero, Mission, Purpose, CoreValues, WhatWeDo, Impact,
                   FounderMessage, ClosingCta, Registration, Tournament, Formats, Analytics
    charts/       TrendChart, BarChart, Bracket (all SVG, framer-motion entrances)
    admin/        AdminAuthForm, AdminDashboard
    ui/           Button, SectionHead, Reveal
    Nav.tsx        hamburger-only nav (all breakpoints), Footer.tsx, PageShell.tsx
  pages/
    Home.tsx           Mission/Vision/Founder's Message + stats (the landing page)
    Register.tsx        registration form — its own route
    TournamentPage.tsx  schedule, venue, bracket diagram — its own route
    FormatsPage.tsx      the six event formats — its own route
    AnalyticsPage.tsx    live registration analytics — its own route
    Admin.tsx            auth-gated staff dashboard (lazy-loaded)
  lib/
    supabase.ts    Supabase client
    queries.ts     react-query hooks (analytics, registration RPC, admin CRUD)
    useAuth.ts      auth state + is_admin check
    types.ts        shared types + event/region metadata
```

## Site structure

The site is now multi-page rather than a single long scroll. `/` is the landing page — built entirely
around the Mission, Vision, Core Values, and Founder's Message from `APEX_Mission_Vision_Founders_Message.pdf`,
plus a stats band (`HomeHero.tsx`) with illustrative membership/partnership numbers themed to that document
(these are marketing stats, not pulled from the database — the live, database-backed numbers live on the
`/analytics` page). Register, Tournament, Formats, and Analytics are each their own route, reachable only
through the hamburger menu (shown at every screen size, not just mobile) — there's no longer a horizontal
nav bar. Old `#registration` / `#tournament` / `#formats` / `#analytics` / `#mission` / `#admin` hash links
from the previous single-page version auto-redirect to the new routes.

## Database contract (unchanged from the previous version)

- `register_for_apex(p_college_name, p_captain_name, p_captain_email, p_region, p_roster_size, p_notes, p_event_codes)` — RPC, public write
- `is_admin()` — RPC, checks the caller against the `admins` allowlist
- `admin_registrations_view` — authenticated-admin-only read
- `public_summary_stats`, `public_event_counts`, `public_region_counts`, `public_weekly_trend` — public read-only analytics views
- `registrations.status` updates — authenticated-admin-only, via the admin dashboard
