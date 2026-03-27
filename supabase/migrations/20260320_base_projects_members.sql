-- Base tables for Vouch System (run first, before other migrations in this folder).
-- Safe to re-run: uses IF NOT EXISTS.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  invite_code text not null unique,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_creator_id on public.projects(creator_id);
create index if not exists idx_projects_invite_code on public.projects(invite_code);

create table if not exists public.members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  primary key (project_id, user_id)
);

create index if not exists idx_members_project_id on public.members(project_id);
create index if not exists idx_members_user_id on public.members(user_id);
