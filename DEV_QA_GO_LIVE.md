# Getting the Dev and QA URLs live

Everything code-side is ready (`dev` and `qa` git branches, `.github/workflows/pipeline.yml`,
`supabase/migrations/`). What's left needs your Vercel and GitHub logins — this session doesn't
have either. Run these once; after that, every `git push` to `dev`/`qa`/`main` deploys itself.

## 0. Push the branches

This session couldn't push directly (`apex-badminton` isn't in its authorized repo set yet — if
you add it, future rounds can skip this step). `main` is already up to date on GitHub (PR #1 is
merged) — the bundle only carries `dev`, `qa`, and the updated `feat/tournament-platform-sync`
(which now also has the versioned migrations and this runbook). In a local clone of the real repo:

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

## 3. Create the two missing Vercel projects

```bash
# Dev
git clone https://github.com/rkandala1231/apex-badminton.git apex-badminton-dev
cd apex-badminton-dev && git checkout dev
cp .env.development .env      # already has real Dev Supabase creds
npm install
npx vercel login              # if not already logged in
npx vercel                    # project name: apex-badminton-dev
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod             # one-time only — pushes to `dev` deploy automatically after this

# QA
cd ..
git clone https://github.com/rkandala1231/apex-badminton.git apex-badminton-qa
cd apex-badminton-qa && git checkout qa
cp .env.qa .env                # same Dev creds + VITE_SUPABASE_SCHEMA=qa
npm install
npx vercel                     # project name: apex-badminton-qa
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_SUPABASE_SCHEMA production   # value: qa
npx vercel --prod              # one-time only
```

Each `npx vercel` run prints a URL and writes `.vercel/project.json` — that's your Dev URL / QA URL,
and where the `orgId`/`projectId` for the next step come from.

## 4. Wire up the pipeline (GitHub Actions)

1. **Get a token**: [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token.
2. **Get IDs**: open `.vercel/project.json` in each of the three project folders (dev, qa, and your
   existing prod folder) → note `orgId` (same across all three) and `projectId` (different each).
3. **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**, add:
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_DEV`, `VERCEL_PROJECT_ID_QA`,
   `VERCEL_PROJECT_ID_PROD`.
4. Optional but recommended: **Settings → Branches → Add rule** for `main` → require the
   `security` and `evals` checks to pass before merging.

## 5. Test the promotion flow

```bash
# in apex-badminton-dev, on branch `dev`
git push                      # pipeline runs, deploys to your Dev URL

# once it looks right:
git fetch origin && git merge origin/dev && git push    # on qa branch -> deploys to QA URL

# once QA looks right:
git fetch origin && git merge origin/qa && git push     # on main -> deploys to prod
```

Watch progress under the repo's **Actions** tab — each run shows security/evals/deploy as separate
checks, with the live URL in the deploy job's summary once it ships.
