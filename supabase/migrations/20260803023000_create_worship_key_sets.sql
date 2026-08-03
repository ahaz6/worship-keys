create table public.worship_key_sets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worship_key_sets enable row level security;

grant select, insert, update, delete on table public.worship_key_sets to authenticated;

create policy "Users can read their own Worship Keys set"
  on public.worship_key_sets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own Worship Keys set"
  on public.worship_key_sets for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own Worship Keys set"
  on public.worship_key_sets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own Worship Keys set"
  on public.worship_key_sets for delete to authenticated
  using ((select auth.uid()) = user_id);

create index worship_key_sets_updated_at_idx on public.worship_key_sets (updated_at desc);

