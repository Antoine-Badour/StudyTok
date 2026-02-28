-- Incremental migration: premium + semi-premium features only
-- Safe to run on an existing StudyTok database.

-- 1) Add subscription tier to profiles
alter table public.profiles add column if not exists subscription_tier text;
update public.profiles
set subscription_tier = 'free'
where subscription_tier is null or subscription_tier = '';

alter table public.profiles alter column subscription_tier set default 'free';
alter table public.profiles alter column subscription_tier set not null;
alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free','semi_premium','premium'));

-- 2) Create semi premium applications table
create table if not exists public.semi_premium_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

-- 3) Enable RLS and policies for applications
alter table public.semi_premium_applications enable row level security;

drop policy if exists "semi_premium_select_own" on public.semi_premium_applications;
create policy "semi_premium_select_own"
on public.semi_premium_applications for select
using (auth.uid() = user_id);

drop policy if exists "semi_premium_insert_own" on public.semi_premium_applications;
create policy "semi_premium_insert_own"
on public.semi_premium_applications for insert
with check (auth.uid() = user_id);

drop policy if exists "semi_premium_update_own" on public.semi_premium_applications;
create policy "semi_premium_update_own"
on public.semi_premium_applications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4) Prevent users from self-changing subscription tier through client-side profile updates
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and subscription_tier = (
    select p.subscription_tier
    from public.profiles p
    where p.id = auth.uid()
  )
);
