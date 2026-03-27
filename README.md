# Vouch System

A project accountability system that replaces subjective peer reviews with a verifiable audit trail of proof-of-work artifacts.

## Features (Levels 1–4)

| Level | What it does |
| ----- | ------------ |
| **1** | Project Hub: name, team list, invite code (lead only) |
| **2** | Tasks: lead creates/assigns; assignee marks complete |
| **3** | Vouches: two other members must vouch a completed task |
| **4** | Analytics: reliability score from on-time work + vouches |

## Tech Stack

- Next.js (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS)

---

## Complete setup (do this once, in order)

### 1. Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project (or open an existing one).
2. Wait until the database is **Ready**.

### 2. API keys for the app

1. In Supabase: **Project Settings → API**.
2. Copy **Project URL** and **anon public** key (the long JWT starting with `eyJ...`, or your dashboard’s publishable key if that is what Supabase shows for your project).
3. In your project folder, copy the example env file and fill it in:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Save the file. Restart `npm run dev` after any change to `.env.local`.

### 3. Auth works on localhost

1. Supabase: **Authentication → URL Configuration**.
2. Under **Site URL**, you can set `http://localhost:3000` for local dev.
3. Add **Redirect URLs**: `http://localhost:3000/**` (and `http://127.0.0.1:3000/**` if you use that).

If you skip this, sign-in redirects can fail.

### 4. Install and run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Database: run SQL migrations (required — do not skip)

In Supabase: **SQL Editor → New query**. Run each file **in this exact order**, in full, one after another:

1. `supabase/migrations/20260320_base_projects_members.sql` — creates `projects` and `members`
2. `supabase/migrations/20260321_vouch_tasks_and_policies.sql` — creates `tasks`, repairs older `tasks` tables with the missing `due_date` column, creates `task_vouches`, and adds RLS for them
3. `supabase/migrations/20260322_projects_members_rls.sql` — RLS so team lists load and the **lead** is recognized

If any step errors, read the message (often “already exists” is OK for `IF NOT EXISTS`). Fix any **duplicate policy** issues by dropping old policies on `projects` / `members` in the Supabase dashboard if you experimented earlier.

If you already created your schema from an older version of this app, pull the latest repo changes and re-run step 2. It is written to safely add the missing `tasks.due_date` column and create `task_vouches` if they are not there yet.

### 6. Email confirmation (optional)

If **Email** sign-in is enabled and **Confirm email** is on, new users must click the link in email before the app can load data. For local testing you can turn off “Confirm email” under **Authentication → Providers → Email** (or use the confirmation link).

---

## End-to-end demo (all levels)

1. **Account A (lead)** — Sign up / log in → **Dashboard** → create a project → you land on `/project/[id]` with **Role: Lead** and **Invite Code**.
2. **Account B** — Sign up / log in → **Join** with the invite code → appears in **Team Members**.
3. **Level 2** — As **Lead**, create a task (title, description, due date, assign to B). As **B**, open the same project → **Mark Complete**.
4. **Level 3** — As **A** and another member **C**, use **Vouch** on B’s completed task (two vouches total; task assignee cannot vouch).
5. **Level 4** — Check **Analytics & Reliability** on the project page after tasks and vouches exist.

---

## Reliability score (Level 4)

- 50% on-time completion rate  
- 30% vouches received (toward the 2-per-task cap)  
- 20% vouches given participation  

---

## CI/CD (GitHub → Vercel)

- Workflow: `.github/workflows/vercel-deploy.yml` builds, pulls Vercel env, and deploys. Main branch deploys to production; PRs deploy to preview.
- Add repo secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (find org/project IDs in Vercel → Settings). Vercel env vars should be configured in the Vercel dashboard.
- First-time link: create the Vercel project from this GitHub repo (or set the IDs manually) so `vercel pull` can fetch env config.

---

## Troubleshooting

| Problem | What to check |
| -------- | ------------- |
| “Invalid supabase URL” / env errors | `.env.local` has real URL and anon key; no quotes; restart dev server. |
| Team Members (0) or Role: Member | Run migration `20260322_projects_members_rls.sql`. Refresh the page. |
| Lead cannot create tasks | You must be the **creator** of the project (`creator_id = your user`). Create a new project while logged in as the lead account. |
| Schema warning says `tasks.due_date` is missing or `task_vouches` was not found | Pull the latest repo changes, then re-run `supabase/migrations/20260321_vouch_tasks_and_policies.sql` in Supabase SQL Editor. |
| RLS / permission errors | All three migrations ran in order; see Supabase **Logs** for SQL errors. |
