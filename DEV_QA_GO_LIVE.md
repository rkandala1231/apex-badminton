# Getting the Dev and QA URLs live

Everything code-side is ready (`dev` and `qa` git branches, `.github/workflows/pipeline.yml`,
`supabase/migrations/`). What's left needs your Vercel and GitHub logins — this session doesn't
have either. Run these once; after that, every `git push` to `dev`/`qa`/`main` deploys itself.

## 0. Push the branches

This session couldn't push directly (`apex-badminton` isn't in its authorized repo set yet — if
you add it, future rounds can skip this step). For now, apply the bundle sent alongside this file:

```bash
git fetch /path/to/apex-tournament-platform-sync.bundle 'refs/heads/*:refs/heads/*'
git push origin main dev qa
```

## 1. Confirm the Dev/QA database is caught up

The `qa` migration file (`supabase/migrations/qa-schema/20260902_qa_live_scoring_match_stats.sql`)
was written **without live access** to `apex-badminton-dev` — verify its two assumptions before
running it (the file's header has the exact check queries):
- `qa.is_admin()` already exists (from the earlier Dev/QA setup work).
- The `qa` schema itself already exists.

If both hold, run that file against `apex-badminton-dev` via the SQL editor. Then run the three
files directly under `supabase/migrations/` (the `public`-schema versions) against
`apex-badminton-dev` too, for the Dev environment itself.

## 2. Expose the `qa` schema

`apex-badminton-dev` project → **Project Settings → API → Data API → Exposed schemas** → add `qa`
→ Save. Without this, anything pointed at QA gets a "schema not found" error.

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
