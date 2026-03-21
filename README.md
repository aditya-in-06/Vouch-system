# Vouch System

A project accountability system that replaces subjective peer reviews with a verifiable audit trail of proof-of-work artifacts.

## Features

- Email/password authentication using Supabase Auth
- Project creation and invite-code based joining
- Project Hub with:
  - project name
  - team member list
  - lead-only invite code visibility
- Task Management:
  - lead creates and assigns tasks
  - assignee marks task as completed
- Vouch System:
  - only completed tasks can be vouched
  - assignee cannot vouch own task
  - each task requires 2 unique vouches to become verified
- Analytics Dashboard:
  - vouches received
  - vouches given
  - completed/on-time tasks
  - reliability score per member

## Tech Stack

- Next.js (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run SQL migration in Supabase SQL Editor:

- `supabase/migrations/20260321_vouch_tasks_and_policies.sql`

4. Start dev server:

```bash
npm run dev
```

## Demo Flow

1. Sign up/login as Project Lead.
2. Create a project and share invite code.
3. Team members join using invite code.
4. Lead creates and assigns tasks.
5. Assignee marks task completed.
6. Two other members vouch for that task.
7. Task becomes verified and analytics updates reliability scores.

## Reliability Score

Current formula:

- 50%: on-time completion rate
- 30%: vouches received ratio
- 20%: vouches given participation