# Automated deployment — 3 agents

You no longer deploy by hand. Every push to `dev` or `main` runs a pipeline
(`.github/workflows/pipeline.yml`) with three jobs — the three "agents" you asked for, each with
one job and each visible as its own check in GitHub:

1. **Security agent** (`security` job) — scans for vulnerable dependencies, leaked secrets, and
   accidentally-committed real `.env` files or service-role keys. Blocks everything downstream if
   it finds a problem.
2. **Evals / guardrails agent** (`evals` job) — typechecks, lints, builds the app, then boots the
   built app and drives a headless browser through every route (`/`, `/register`, `/tournament`,
   `/formats`, `/analytics`, `/admin`), failing the build on any crash, blank page, or uncaught JS
   error. This is the same manual QA pass I used to do by hand, now automatic on every push.
3. **Deployment agent** (`deploy` job) — only runs if security and evals both pass. Looks at which
   branch triggered the run, deploys to the matching Vercel project/environment, and never touches
   the others.

From here on, your workflow is: describe the idea to me (or write the code yourself), push to the
right branch, and the pipeline does the rest. You'll see it running under your repo's **Actions**
tab, and each push gets a pass/fail summary with the live URL once deployed.

> **Policy: no QA, going forward.** Only two environments exist — `dev` and `prod` — and all
> validation/testing happens in `dev` before promoting to `prod`. This project used to have a
> third `qa` branch/environment sharing the `dev` Vercel project via a separate Postgres schema;
> it's been fully removed. See `ENVIRONMENTS.md` for the policy detail and the manual cleanup
> steps (Vercel alias, GitHub secret, Postgres schema) that still need doing on the
> Vercel/Supabase/GitHub side, since this session can't reach those dashboards directly.

## Branch → environment map

| Branch | Vercel project | Deployment type | Site |
|---|---|---|---|
| `dev` | `apex-badminton-dev` | Preview (`--git-branch=dev`) | `apex-badminton-dev.vercel.app` |
| `main` | `apexclubj` | Production | `apexclubj.vercel.app` — the real, public site |

`dev` still gets its own stable URL: the pipeline deploys a Preview build, then runs
`vercel alias set` to pin it to a fixed `*.vercel.app` name (see `pipeline.yml`'s `deploy` job) —
Vercel's automatic per-branch preview URL only gets assigned by its own GitHub App integration, not
by a CLI deploy from a third-party CI runner like this one, so the pipeline claims the alias itself
instead of relying on that.

Opening a **pull request** into either branch runs security + evals only (no deploy) — a gate to
check before you merge. A direct **push** to the branch runs security + evals, then deploys.

## One-time setup (you do this once, per environment)

The pipeline deploys into Vercel projects that must already exist and already have their Supabase
env vars set — it doesn't create projects or set app secrets, it only builds and ships code. That
one-time linking is exactly the `npx vercel` / `npx vercel env add` steps in `DEV_GO_LIVE.md`.
Do that once (one project for dev, one for prod); after that, you never run `npx vercel --prod` or
`npx vercel deploy` by hand again — pushing to the branch does it.

### 1. Get a Vercel token

[vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create Token** → give it a name
like `github-actions` → copy it. You'll paste it into GitHub as `VERCEL_TOKEN` (Step 3).

### 2. Get your Org ID and each Project ID

In each of the two project folders (dev, and your existing prod folder), after running
`npx vercel link` (or the first-time `npx vercel` setup), a file appears at
`.vercel/project.json`:

```json
{ "orgId": "team_xxxxxxxx", "projectId": "prj_xxxxxxxx" }
```

`orgId` is the same across both (same Vercel account/team) — you only need it once.
`projectId` is different for each of the two projects — grab both.

### 3. Add the secrets to GitHub

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret name | Value |
|---|---|
| `VERCEL_TOKEN` | the token from Step 1 |
| `VERCEL_ORG_ID` | the `orgId` from Step 2 |
| `VERCEL_PROJECT_ID_DEV` | `projectId` for `apex-badminton-dev` |
| `VERCEL_PROJECT_ID_PROD` | `projectId` for `apexclubj` |

> If you already had the old 3-branch setup wired up: this replaces the old
> `VERCEL_PROJECT_ID_DEV_QA` secret — rename it (or add the new name and delete the old one) on
> GitHub's secrets page, since `pipeline.yml` now reads `VERCEL_PROJECT_ID_DEV`.

Notice there's no Supabase key here — `vercel pull` fetches `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` directly from the Vercel project's own settings (the ones you already set
with `npx vercel env add`), so nothing sensitive needs to live in GitHub at all.

### 4. Make the checks actually block bad merges (recommended)

**Settings → Branches → Add branch protection rule** for `main` (and optionally `dev`) →
check **Require status checks to pass before merging** → select `security` and `evals`. Now a
pull request into that branch physically cannot merge if either agent fails.

### 5. Push the workflow itself

`.github/workflows/pipeline.yml`, `scripts/smoke-test.mjs`, and the `playwright` /
`start-server-and-test` dev dependencies in `package.json` need to be committed and pushed like any
other code change — copy them into your project folder (or pull the latest zip) and push to `main`
(and merge down into `dev`) so both branches have the pipeline.

## What happens after setup

Push a change to `dev` → security and evals run (~1–2 min) → if clean, it deploys to your Dev URL
automatically. When you're happy with it, merge `dev` into `main`, push → same pipeline runs and
deploys to the real, public site. You watch it happen in the Actions tab; you never type
`vercel --prod` again.

## Tested locally before delivery

I ran the evals agent's exact steps against this codebase before handing it to you: `tsc -b`, lint,
a production build with placeholder (non-real) Supabase credentials to confirm the build never
needs secrets to succeed, and the full Playwright smoke test against all 6 routes — all passing,
including against the placeholder backend (confirming the app degrades gracefully instead of
crashing when Supabase is unreachable, which is what the guardrail is actually checking for).
