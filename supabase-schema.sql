create table if not exists public.user_navigation (
  user_id uuid primary key references auth.users (id) on delete cascade,
  navigation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_navigation enable row level security;

drop policy if exists "Users can view own navigation" on public.user_navigation;
create policy "Users can view own navigation"
on public.user_navigation
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own navigation" on public.user_navigation;
create policy "Users can insert own navigation"
on public.user_navigation
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own navigation" on public.user_navigation;
create policy "Users can update own navigation"
on public.user_navigation
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
