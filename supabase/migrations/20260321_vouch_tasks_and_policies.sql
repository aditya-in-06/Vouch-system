-- Tasks and vouching schema for Vouch System
-- Safe to run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);

create table if not exists public.task_vouches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  voucher_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, voucher_user_id)
);

create index if not exists idx_task_vouches_project_id on public.task_vouches(project_id);
create index if not exists idx_task_vouches_task_id on public.task_vouches(task_id);
create index if not exists idx_task_vouches_voucher_user_id on public.task_vouches(voucher_user_id);

alter table public.tasks enable row level security;
alter table public.task_vouches enable row level security;

drop policy if exists "members can read tasks in their project" on public.tasks;
create policy "members can read tasks in their project"
on public.tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.project_id = tasks.project_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "leads can insert tasks in own projects" on public.tasks;
create policy "leads can insert tasks in own projects"
on public.tasks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = tasks.project_id
      and p.creator_id = auth.uid()
  )
);

drop policy if exists "assignee can mark task completed" on public.tasks;
create policy "assignee can mark task completed"
on public.tasks
for update
to authenticated
using (
  assigned_to = auth.uid()
  and exists (
    select 1
    from public.members m
    where m.project_id = tasks.project_id
      and m.user_id = auth.uid()
  )
)
with check (
  assigned_to = auth.uid()
  and status in ('pending', 'completed')
);

drop policy if exists "members can read vouches in their project" on public.task_vouches;
create policy "members can read vouches in their project"
on public.task_vouches
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.project_id = task_vouches.project_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can insert valid vouches" on public.task_vouches;
create policy "members can insert valid vouches"
on public.task_vouches
for insert
to authenticated
with check (
  voucher_user_id = auth.uid()
  and exists (
    select 1
    from public.members m
    where m.project_id = task_vouches.project_id
      and m.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tasks t
    where t.id = task_vouches.task_id
      and t.project_id = task_vouches.project_id
      and t.status = 'completed'
      and t.assigned_to is distinct from auth.uid()
  )
  and (
    select count(*)
    from public.task_vouches tv
    where tv.task_id = task_vouches.task_id
  ) < 2
);
