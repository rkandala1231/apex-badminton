# Apex Badminton — Dev / QA / Prod environments

> **Superseded for the Vercel-project part:** Step 3 below (3 separate Vercel projects) was the
> original plan; it changed the same way the Supabase side did — see `DEV_QA_GO_LIVE.md` for the
> current, accurate steps (dev and qa now share **one** Vercel project, split by branch, each with
> its own alias; only prod is separate). Everything else on this page (the database/schema history,
> Steps 1, 2, and 5) is still accurate.

## Urgent — a live bug just got fixed, redeploy needed

While setting up QA, I found and fixed a real bug affecting the **live, public** site: the earlier
fix for a Supabase security-advisor warning (setting `security_invoker = true` on the 4 public
analytics views) silently broke public read access — anonymous visitors got a permission error
instead of stats, ever since that migration. It's fixed at the database level on both Prod and Dev
already (verified), and the frontend code (`src/lib/queries.ts`, `src/lib/supabase.ts`) is updated
in this package to match. **This needs a prod redeploy as soon as you can** — see Step 5.

## Status right now

| Environment | Where the data lives | Status |
|---|---|---|
| **Prod** | `apex-badminton-prod` project (`xxfbocoktyfbiukxsyer`), `NJ Badminton Org` | ✅ live; bug fixed, needs redeploy |
| **Dev** | `apex-badminton-dev` project (`nzimhzzfbxcxjmqstjlx`), new org | ✅ ready; bug fixed, needs redeploy |
| **QA** | **same project as Dev**, separate `qa` Postgres schema | ✅ schema created, verified — needs one dashboard step (Step 2) |

### Why QA shares Dev's project (a correction from the original plan)

The original plan was 3 fully separate Supabase projects. While building it, project creation for
QA failed with a real Supabase constraint I had wrong earlier: **the free-tier 2-project cap is per
account, across every org you own or admin — not per organization.** Moving Dev to a new org didn't
create a fresh quota, because you're still the owner there too. You picked the fix: QA lives in the
same project as Dev, in its own Postgres schema (`qa`, alongside Dev's `public`) — fully separate
tables, RLS policies, and functions, just sharing the underlying compute. Verified working and
verified that `anon` still can't read raw rows (only the aggregate stats functions), same as Prod
and Dev.

This doesn't undo anything you already did — Dev's transfer to the new org is fine and unaffected;
it just means QA didn't need a *third* org after all.

## Step 1 — already done, nothing for you here

Dev is in its own org, QA's schema exists inside Dev's project with the full table/RLS/function set,
verified clean. No action needed.

## Step 2 — Expose the `qa` schema (you do this, ~1 minute)

Supabase only serves schemas you explicitly expose via its API. `public` is exposed by default;
`qa` isn't yet.

1. Open the **`apex-badminton-dev`** project in the [Supabase dashboard](https://supabase.com/dashboard).
2. **Project Settings → API → Data API** (or **API Settings**, naming varies slightly by dashboard version).
3. Find **Exposed schemas**, add `qa` to the list (it'll already show `public`).
4. Save.

Without this step, anything pointed at the QA environment will get a "schema not found"-style error.

> **Deploys are now automated** — see `CI_CD.md` for the 3-agent pipeline (security → evals →
> deploy) that runs on every push. The manual `npx vercel --prod` steps below are still needed
> **once per environment** to create the Vercel project and set its Supabase env vars — after that,
> pushing to the branch deploys it, you don't run that command again.

## Step 3 — Vercel projects (one per environment)

Still **3 separate Vercel projects** — that part of the plan is unchanged, only the database side
changed. Each is fed by its own local folder checked out to its own git branch, each with its own
`.env`:

```bash
# from wherever you keep your projects, e.g. Documents/
git clone https://github.com/rkandala1231/apex-badminton.git apex-badminton-dev
cd apex-badminton-dev
git checkout -b dev
git push -u origin dev
copy ..\apex-react\.env.development .env    # Windows: copy, macOS/Linux: cp
npm install
npx vercel login          # if not already logged in
npx vercel                # first-time setup — when asked for a project name, use: apex-badminton-dev
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod
```

QA is the same pattern — note `.env.qa` now has real values (same URL/key as Dev, plus one extra
variable that points it at the `qa` schema instead of `public`):

```bash
cd ..
git clone https://github.com/rkandala1231/apex-badminton.git apex-badminton-qa
cd apex-badminton-qa
git checkout -b qa
git push -u origin qa
copy ..\apex-react\.env.qa .env
npm install
npx vercel               # project name: apex-badminton-qa
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_SUPABASE_SCHEMA production    # value: qa
npx vercel --prod
```

Your existing prod folder keeps working exactly as it does today.

## Step 4 — Day-to-day workflow (promoting a change)

No more manual deploys once the pipeline in `CI_CD.md` is set up:

1. **Build the change in `apex-badminton-dev`**, on the `dev` branch. `git push` — the pipeline
   runs security + evals, then deploys to the Dev URL automatically.
2. **Promote to QA**: in `apex-badminton-qa`: `git fetch origin && git merge origin/dev && git push`
   — same pipeline runs, deploys to QA automatically.
3. **Promote to Prod**: in your prod folder: `git fetch origin && git merge origin/qa && git push`
   — same pipeline runs, deploys to the real, public `apexclubj.vercel.app` site automatically.

## Step 5 — Redeploy Prod and Dev now (fixes the live bug)

This one's time-sensitive. Pull the updated `src/lib/queries.ts` and `src/lib/supabase.ts` from this
package into your existing prod folder and your new dev folder, then:

```bash
npx vercel --prod
```

...in each. That ships the fix. (Once the CI/CD pipeline from `CI_CD.md` is wired up, this step
disappears — a push does it automatically.)

## What's left

- [x] Dev + QA data layer (QA as a schema inside Dev's project) — done, verified
- [ ] Expose the `qa` schema in the dashboard (Step 2)
- [ ] One-time Vercel setup for `apex-badminton-dev` and `apex-badminton-qa` (Step 3)
- [ ] Redeploy Prod and Dev to ship the analytics bug fix (Step 5) — **do this one soon**
- [ ] Follow `CI_CD.md` to wire up the 3-agent pipeline (GitHub secrets + branch protection)
- [ ] Test a full dev → qa → prod promotion — just a `git push`, nothing else
