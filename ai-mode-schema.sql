-- AI Mode incremental schema (safe to run after existing StudyTok schema)

create table if not exists public.ai_feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  used_at timestamptz not null default now()
);

create index if not exists ai_feature_usage_user_feature_used_at_idx
  on public.ai_feature_usage (user_id, feature_key, used_at desc);

alter table public.ai_feature_usage enable row level security;

drop policy if exists "ai_feature_usage_select_own" on public.ai_feature_usage;
create policy "ai_feature_usage_select_own"
on public.ai_feature_usage
for select
using (auth.uid() = user_id);

drop policy if exists "ai_feature_usage_insert_own" on public.ai_feature_usage;
create policy "ai_feature_usage_insert_own"
on public.ai_feature_usage
for insert
with check (auth.uid() = user_id);
