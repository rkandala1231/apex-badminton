# Apex Badminton — Dev / Prod environments

> ## Policy: no QA, going forward
>
> **Only two environments exist: `dev` and `prod`.** There is no QA environment and none is
> planned — all validation and testing happens in `dev` before a change is promoted to `prod`.
> That means exactly **two** live URLs for this project, full stop:
>
> | Environment | Branch | URL |
> |---|---|---|
> | Dev | `dev` | `apex-badminton-dev.vercel.app` |
> | Prod | `main` | `apexclubj.vercel.app` |
>
> A `qa` branch/environment (a third Vercel alias, sharing the Dev Vercel project and Dev Supabase
> project via a separate `qa` Postgres schema) existed earlier and has been fully retired — its
> role in the pipeline, its Vercel alias, and its migration files have all been removed from the
> codebase. What's left below is the manual cleanup on the Vercel/Supabase/GitHub side, which this
> session can't reach directly (no dashboard login). Don't recreate a `qa` branch, project, alias,
> or schema without updating this file, `README.md`, and `.github/workflows/pipeline.yml`'s header
> comment together — they're written assuming only these two environments exist. For the up-to-date
> one-time Vercel/GitHub setup, see `DEV_GO_LIVE.md` (name kept for history; content now covers
> dev+prod only).

## Manual cleanup — things you need to do that code changes can't reach

1. **Delete the `apex-badminton-qa.vercel.app` alias / QA deployments.** In the
   `apex-badminton-dev` Vercel project → **Deployments**, find any Preview deployments from the
   `qa` branch and remove them (or just let them age out — they'll stop being reachable once the
   alias is deleted). Project **Settings → Domains**, remove the `apex-badminton-qa.vercel.app`
   alias if it's listed there.
2. **Remove the `qa`-branch-scoped `VITE_SUPABASE_SCHEMA` env var.** Project **Settings →
   Environment Variables**, find the entry scoped to the `qa` git branch and delete it. (Don't add
   a general/unscoped replacement — `src/lib/supabase.ts` already falls back to `'public'` when
   this var is unset, so `dev` needs no explicit value at all.)
3. **Rename or replace the `VERCEL_PROJECT_ID_DEV_QA` GitHub secret.** `pipeline.yml` now reads
   `VERCEL_PROJECT_ID_DEV` (same value, same `apex-badminton-dev` project — it never needed to
   change, just the secret's name did). GitHub repo → **Settings → Secrets and variables →
   Actions**: add `VERCEL_PROJECT_ID_DEV` with that project's `projectId`, then delete the old
   `VERCEL_PROJECT_ID_DEV_QA` secret.
4. **Un-expose the `qa` Postgres schema** (you chose to leave the schema itself in place, just
   stop serving it): `apex-badminton-dev` Supabase project → **Project Settings → API → Data API →
   Exposed schemas** → remove `qa` from the list → Save. The schema and its data stay put — this
   only stops the API from answering requests against it. If you ever want to actually drop it,
   that's a `drop schema qa cascade;` run yourself in the SQL editor — not something to automate.
5. **Delete the `qa` branch on GitHub** once you're happy nothing needs it — `git push origin
   --delete qa` — and remove any branch-protection rule scoped to `qa` under **Settings →
   Branches**, if one was ever added.
6. **Delete your local `apex-badminton-qa` project folder** (the one from the old 3-Vercel-project
   plan, if you ever created it) — nothing deploys from it anymore.

None of these are urgent in the sense of breaking anything — the pipeline no longer pushes to `qa`
at all, so the old alias/deployments just go stale. But the Vercel env var and GitHub secret are
worth doing soon since they're easy to forget and only take a couple minutes each.

## Status right now

| Environment | Where the data lives | Status |
|---|---|---|
| **Prod** | `apex-badminton-prod` project (`xxfbocoktyfbiukxsyer`), `NJ Badminton Org` | ✅ live |
| **Dev** | `apex-badminton-dev` project (`nzimhzzfbxcxjmqstjlx`) | ✅ ready |
| ~~QA~~ | ~~same project as Dev, `qa` Postgres schema~~ | retired — see cleanup steps above |

## Why Dev's Supabase project is shaped the way it is (history)

The original plan was one Supabase project per environment. QA's project creation hit a real
Supabase constraint: **the free-tier 2-project cap is per account, across every org you own or
admin — not per organization.** That's why QA ended up as a second schema inside Dev's project
instead of its own project — a workaround for a plan quota, not a design goal. Now that QA itself
is retired, this history doesn't matter going forward, but it's why you'll still see references to
a `qa` schema in Dev's Supabase project (left in place, just unexposed — see cleanup step 4).

## Day-to-day workflow (promoting a change)

No manual deploys once the pipeline in `CI_CD.md` is set up:

1. **Build the change in your `dev` checkout**, on the `dev` branch. `git push` — the pipeline runs
   security + evals, then deploys to the Dev URL automatically.
2. **Promote to Prod**: in your prod folder: `git fetch origin && git merge origin/dev && git push`
   — same pipeline runs, deploys to the real, public `apexclubj.vercel.app` site automatically.

## What's left

- [ ] Do the manual Vercel/Supabase/GitHub cleanup above (items 1–6)
- [ ] Confirm `main`/prod is on the current code and rendering correctly
- [ ] Follow `CI_CD.md` for the one-time GitHub Actions setup (secrets + branch protection) if not
      already done
- [ ] Test a full dev → prod promotion — just a `git push`, nothing else
