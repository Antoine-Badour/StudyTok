-- Points system incremental schema
-- Safe to run on an existing StudyTok database.

alter table public.profiles add column if not exists total_points integer not null default 0;

create table if not exists public.points_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null,
  reason text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists points_events_user_created_idx
  on public.points_events (user_id, created_at desc);

alter table public.points_events enable row level security;

drop policy if exists "points_events_select_own" on public.points_events;
create policy "points_events_select_own"
on public.points_events
for select
using (auth.uid() = user_id);

drop function if exists public.increment_profile_points(uuid, integer);
create or replace function public.increment_profile_points(p_user_id uuid, p_points integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set total_points = coalesce(total_points, 0) + coalesce(p_points, 0)
  where id = p_user_id;
end;
$$;

grant execute on function public.increment_profile_points(uuid, integer) to service_role;
