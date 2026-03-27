-- Projects + members RLS so the Project Hub can load team lists and recognize the lead.
-- Run this in the Supabase SQL Editor after your base schema exists.

alter table public.projects enable row level security;
alter table public.members enable row level security;

-- Read projects if you created them OR you are in members
drop policy if exists "projects_select_for_creator_or_member" on public.projects;
create policy "projects_select_for_creator_or_member"
on public.projects
for select
to authenticated
using (
  creator_id = auth.uid()
  or exists (
    select 1 from public.members m
    where m.project_id = projects.id
      and m.user_id = auth.uid()
  )
);

-- Create projects only as yourself
drop policy if exists "projects_insert_as_creator" on public.projects;
create policy "projects_insert_as_creator"
on public.projects
for insert
to authenticated
with check (creator_id = auth.uid());

-- Read members: project creator sees everyone; members see everyone in the same project
drop policy if exists "members_select_for_creator_or_peers" on public.members;
create policy "members_select_for_creator_or_peers"
on public.members
for select
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = members.project_id
      and p.creator_id = auth.uid()
  )
  or exists (
    select 1 from public.members m
    where m.project_id = members.project_id
      and m.user_id = auth.uid()
  )
);

-- Join / add your own membership row
drop policy if exists "members_insert_own_row" on public.members;
create policy "members_insert_own_row"
on public.members
for insert
to authenticated
with check (user_id = auth.uid());
