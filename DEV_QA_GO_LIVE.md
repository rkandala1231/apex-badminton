# Getting the Dev and QA URLs live

Everything code-side is ready (`dev` and `qa` git branches, `.github/workflows/pipeline.yml`,
`supabase/migrations/`). What's left needs your Vercel and GitHub logins — this session doesn't
have either. Run these once; after that, every `git push` to `dev`/`qa`/`main` deploys itself.

## 0. Push the branches

This session couldn't push directly (`apex-badminton` isn't in its authorized repo set yet — if
you add it, future rounds can skip this step). `main` is already up to date on GitHub (PR #1 is
merged) — the bundle only carries `dev`, `qa`, and the updated `feat/tournament-platform-sync`
(which now also has the versioned migrations, the single-shared-Vercel-project pipeline, and this
runbook). In a local clone of the real repo:

```bash
git fetch /path/to/apex-dev-qa-go-live.bundle 'refs/heads/*:refs/heads/*'
git push origin dev qa feat/tournament-platform-sync
```

## 1. Database — done, verified live against apex-badminton-dev

Everything under `supabase/migrations/` (both `public`-schema files and the `qa-schema/`
counterparts) has already been applied directly to `apex-badminton-dev`, including the admin
role-tier/staff-management schema that turned out to also be missing (13 migrations behind prod,
not just the 3 stats ones originally assumed). Verified with real sessions, not just "should work":
`is_admin()`/`is_super_admin()` resolve correctly for a real JWT, `create_admin_account` →
`list_admin_staff` → `remove_admin_access` round-tripped cleanly on both schemas, and
`get_team_standings`/`get_head_to_head` returned correct aggregates for a real inserted-then-
rolled-back match, as anon, on both `public` and `qa`. `get_advisors` on Dev now shows the same
warnings as prod and nothing new.

Two real bugs surfaced by that testing and got fixed (both now reflected in the migration files,
so a fresh apply elsewhere won't hit them): `admins` on Dev was missing a `created_at` column
entirely (not just `role`/`note` as first assumed) — `list_admin_staff()` needs it, added via
`add column if not exists`. And `create_admin_account`'s `crypt()`/`gen_salt()` calls failed
because pgcrypto lives in Dev's `extensions` schema, not `public` — fixed by schema-qualifying
those calls explicitly rather than relying on search_path.

**Two dev-only bootstrap super_admin accounts were created** — one on `public` (Dev), one on `qa`
(QA), separate from each other and from anything in prod. Credentials were handed to you directly
in chat, not committed anywhere in this repo. Use them to sign into each environment's admin
console once its Vercel URL exists (Step 3), then use "Manage Admins" to add real staff and
retire the bootstrap account if you want.

If you ever need to re-run any of this by hand (a fresh environment, a rollback), everything in
`supabase/migrations/` is idempotent — safe to re-apply.

## 2. Expose the `qa` schema

`apex-badminton-dev` project → **Project Settings → API → Data API → Exposed schemas** → add `qa`
→ Save. This one couldn't be done from SQL (it's a PostgREST/platform config, not a database
object) — still needs you, in the dashboard. Without it, anything pointed at QA gets a
"schema not found" error.

## 3. Create the one shared Dev+QA Vercel project (plus the separate prod one, if it doesn't exist yet)

Dev and QA share **one** Vercel project, not two — matching that they already share one Supabase
project (just a different schema). Both deploy as ordinary Preview deployments there; there's no
`--prod` deploy for this project at all. Each branch gets pinned to its own stable `*.vercel.app`
alias by the pipeline itself (step 4 below sets this up in `pipeline.yml`) rather than by Vercel's
automatic per-branch URL — that automatic URL is a Git-Integration-only feature, and doesn't get
assigned to a deployment pushed via CLI from a third-party CI runner like GitHub Actions (this
pipeline). Confirmed against Vercel's own docs and community forum, not assumed.

```bash
git clone https://github.com/rkandala1231/apex-badminton.git apex-badminton-dev
cd apex-badminton-dev && git checkout dev
cp .env.development .env      # already has real Dev Supabase creds
npm install
npx vercel login              # if not already logged in
npx vercel                    # project name: apex-badminton-dev -- links the folder, no need to deploy yet

# Preview env vars -- these apply to BOTH the dev and qa branches by default
npx vercel env add VITE_SUPABASE_URL preview
npx vercel env add VITE_SUPABASE_ANON_KEY preview

# qa-branch-only override: makes the qa branch's preview point at the `qa` schema instead of `public`.
# This is a plain Vercel CLI feature (branch-scoped Preview env vars) -- no paid plan required.
npx vercel env add VITE_SUPABASE_SCHEMA preview qa
# when prompted for the value, enter: qa

npx vercel deploy              # one-time preview deploy, just to confirm the project + env vars work
```

`apex-badminton-qa.vercel.app` and `apex-badminton-dev.vercel.app` are the two aliases the pipeline
will assign (see `pipeline.yml`'s `deploy` job) — they're on the shared `vercel.app` domain, claimed
on a first-come basis, so if either is already taken by someone else's project, edit those two
literal strings in `pipeline.yml` to a different pair of names before step 5.

If the prod Vercel project doesn't already exist (this runbook assumes it does, since it predates
this round of work), create it the same way against the `main` branch and prod Supabase creds, with
a normal `npx vercel --prod` — prod is the one branch that still gets its own project and its own
real production deploy.

The `npx vercel` link step writes `.vercel/project.json` in the project folder — that's where the
`orgId`/`projectId` for the next step come from.

## 4. Wire up the pipeline (GitHub Actions)

1. **Get a token**: [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token.
2. **Get IDs**: open `.vercel/project.json` in each of the two project folders (the shared dev+qa
   folder, and your existing prod folder) → note `orgId` (same across both) and `projectId`
   (different each).
3. **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**, add:
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_DEV_QA`, `VERCEL_PROJECT_ID_PROD`.
   (Only two project-ID secrets now, since dev and qa share one project — `pipeline.yml` already
   picks `--git-branch=dev` vs `--git-branch=qa` within it and aliases each to its own URL.)
4. Optional but recommended: **Settings → Branches → Add rule** for `main` → require the
   `security` and `evals` checks to pass before merging.

## 5. Test the promotion flow

```bash
# in apex-badminton-dev, on branch `dev`
git push                      # pipeline runs, deploys a Preview build, aliases it to
                               # https://apex-badminton-dev.vercel.app

# once it looks right:
git fetch origin && git merge origin/dev && git push    # on qa branch -> deploys + aliases to
                                                          # https://apex-badminton-qa.vercel.app

# once QA looks right:
git fetch origin && git merge origin/qa && git push     # on main -> real --prod deploy
```

Watch progress under the repo's **Actions** tab — each run shows security/evals/deploy as separate
checks, with both the raw deployment URL and (for dev/qa) the stable alias URL in the deploy job's
summary once it ships. The very first `dev` and `qa` pushes are what actually claim the two
`*.vercel.app` aliases — if either name turns out to already be taken by someone else, that alias
step in the Actions log will say so, and the fix is to change the two literal strings in
`pipeline.yml`'s `deploy` job to different names and push again.
