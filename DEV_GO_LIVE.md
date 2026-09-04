# Getting the Dev and Prod URLs live

> Renamed from `DEV_QA_GO_LIVE.md` — QA has been retired (dropped from the pipeline, git branches,
> and Vercel/Supabase setup). If you already have the old 3-branch setup wired up, see
> `ENVIRONMENTS.md` for the manual cleanup steps (Vercel alias, GitHub secret rename, un-exposing
> the `qa` Postgres schema) — this doc only covers the current dev+prod setup going forward.

Everything code-side is ready (`dev` git branch, `.github/workflows/pipeline.yml`,
`supabase/migrations/`). What's left needs your Vercel and GitHub logins — this session doesn't
have either. Run these once; after that, every `git push` to `dev`/`main` deploys itself.

## 0. Push the branch

This session couldn't push directly (`apex-badminton` isn't in its authorized repo set yet — if
you add it, future rounds can skip this step). `main` is already up to date on GitHub. In a local
clone of the real repo, pull in whatever bundle/patch carries the latest `dev` branch and push it:

```bash
git push origin dev
```

## 1. Database — done, verified live against apex-badminton-dev

Everything under `supabase/migrations/` has already been applied directly to `apex-badminton-dev`,
including the admin role-tier/staff-management schema that turned out to also be missing (13
migrations behind prod, not just the 3 stats ones originally assumed). Verified with real sessions,
not just "should work": `is_admin()`/`is_super_admin()` resolve correctly for a real JWT,
`create_admin_account` → `list_admin_staff` → `remove_admin_access` round-tripped cleanly, and
`get_team_standings`/`get_head_to_head` returned correct aggregates for a real inserted-then-
rolled-back match, as anon. `get_advisors` on Dev now shows the same warnings as prod and nothing
new.

Two real bugs surfaced by that testing and got fixed (both now reflected in the migration files, so
a fresh apply elsewhere won't hit them): `admins` on Dev was missing a `created_at` column entirely
(not just `role`/`note` as first assumed) — `list_admin_staff()` needs it, added via
`add column if not exists`. And `create_admin_account`'s `crypt()`/`gen_salt()` calls failed
because pgcrypto lives in Dev's `extensions` schema, not `public` — fixed by schema-qualifying
those calls explicitly rather than relying on search_path.

**A dev-only bootstrap super_admin account was created** on `public` (Dev), separate from anything
in prod. Credentials were handed to you directly in chat, not committed anywhere in this repo. Use
it to sign into the Dev admin console once its Vercel URL exists (Step 2), then use "Manage Admins"
to add real staff and retire the bootstrap account if you want.

If you ever need to re-run any of this by hand (a fresh environment, a rollback), everything in
`supabase/migrations/` is idempotent — safe to re-apply.

## 2. Create the Dev Vercel project (plus the separate prod one, if it doesn't exist yet)

```bash
git clone https://github.com/rkandala1231/apex-badminton.git apex-badminton-dev
cd apex-badminton-dev && git checkout dev
cp .env.development .env      # already has real Dev Supabase creds
npm install
npx vercel login              # if not already logged in
npx vercel                    # project name: apex-badminton-dev -- links the folder, no need to deploy yet

npx vercel env add VITE_SUPABASE_URL preview
npx vercel env add VITE_SUPABASE_ANON_KEY preview

npx vercel deploy              # one-time preview deploy, just to confirm the project + env vars work
```

`apex-badminton-dev.vercel.app` is the alias the pipeline will assign (see `pipeline.yml`'s `deploy`
job) — it's on the shared `vercel.app` domain, claimed on a first-come basis, so if it's already
taken by someone else's project, edit that literal string in `pipeline.yml` to a different name
before Step 3.

If the prod Vercel project doesn't already exist (this runbook assumes it does, since it predates
this round of work), create it the same way against the `main` branch and prod Supabase creds, with
a normal `npx vercel --prod` — prod is the branch that gets its own project and its own real
production deploy.

The `npx vercel` link step writes `.vercel/project.json` in the project folder — that's where the
`orgId`/`projectId` for the next step come from.

## 3. Wire up the pipeline (GitHub Actions)

1. **Get a token**: [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token.
2. **Get IDs**: open `.vercel/project.json` in each of the two project folders (dev and prod) →
   note `orgId` (same across both) and `projectId` (different each).
3. **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**, add:
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_DEV`, `VERCEL_PROJECT_ID_PROD`.
4. Optional but recommended: **Settings → Branches → Add rule** for `main` → require the
   `security` and `evals` checks to pass before merging.

## 4. Test the promotion flow

```bash
# in apex-badminton-dev, on branch `dev`
git push                      # pipeline runs, deploys a Preview build, aliases it to
                               # https://apex-badminton-dev.vercel.app

# once it looks right:
git fetch origin && git merge origin/dev && git push    # on main -> real --prod deploy
```

Watch progress under the repo's **Actions** tab — each run shows security/evals/deploy as separate
checks, with both the raw deployment URL and the stable alias URL in the deploy job's summary once
it ships. The very first `dev` push is what actually claims the `apex-badminton-dev.vercel.app`
alias — if that name turns out to already be taken by someone else, the alias step in the Actions
log will say so, and the fix is to change that literal string in `pipeline.yml`'s `deploy` job to a
different name and push again.
