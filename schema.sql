-- Run once in the new Supabase project (SQL editor). The table is closed to direct access;
-- the app reads and writes only through two functions that need the secret key.
create table if not exists public.video_progress (
  key text primary key check (length(key) >= 24),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.video_progress enable row level security;  -- no policies: no direct access

create or replace function public.get_progress(k text) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce((select data from video_progress where key = k), '{}'::jsonb);
$$;

create or replace function public.save_progress(k text, d jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(k) < 24 then raise exception 'key too short'; end if;
  insert into video_progress(key, data, updated_at) values (k, d, now())
  on conflict (key) do update set data = excluded.data, updated_at = now();
end $$;

revoke all on function public.get_progress(text), public.save_progress(text, jsonb) from public;
grant execute on function public.get_progress(text), public.save_progress(text, jsonb) to anon;
