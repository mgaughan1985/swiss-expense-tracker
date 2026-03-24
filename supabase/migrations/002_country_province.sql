-- ============================================================
-- Country / Province Profile Migration (V2)
-- Run via: Supabase Dashboard > SQL Editor > New query
--
-- Creates a public.profiles table linked to auth.users.
-- New users get a row auto-created via trigger.
-- Existing users: run the INSERT at the bottom after the table exists.
-- ============================================================

-- ── 1. Create profiles table ──────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  country      text not null default 'Switzerland',
  province     text,                -- Canada only (2-letter province code, e.g. 'ON')
  canton       text,                -- Switzerland only (e.g. 'Vaud')
  municipality text,               -- Switzerland only (e.g. 'Grandvaux')
  tier         text not null default 'free'
               check (tier in ('free', 'solo', 'team')),
  updated_at   timestamptz default now()
);

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_select"
  on public.profiles for select
  using (id = auth.uid());

-- Users can create their own profile row
create policy "profiles_insert"
  on public.profiles for insert
  with check (id = auth.uid());

-- Users can update their own profile
create policy "profiles_update"
  on public.profiles for update
  using (id = auth.uid());

-- ── 3. Auto-create profile on signup ─────────────────────────────────────────
--
-- Reads country, province, canton, municipality from raw_user_meta_data
-- (the options.data object passed to supabase.auth.signUp).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, country, province, canton, municipality)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'country', 'Switzerland'),
    new.raw_user_meta_data->>'province',
    new.raw_user_meta_data->>'canton',
    new.raw_user_meta_data->>'municipality'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── POST-MIGRATION: create profile rows for existing users ────────────────────
--
-- Run after confirming the table and trigger exist.
-- Existing users default to Switzerland / free tier.
-- Adjust individual rows manually afterward if needed.
--
-- INSERT INTO public.profiles (id, country, tier)
-- SELECT id, 'Switzerland', 'free'
-- FROM auth.users
-- WHERE id NOT IN (SELECT id FROM public.profiles)
-- ON CONFLICT (id) DO NOTHING;
