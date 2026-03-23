-- ============================================================
-- BeaconFile Approval Workflow V1 Migration
-- Run via: Supabase Dashboard > SQL Editor > New query
--
-- READ BEFORE RUNNING:
-- 1. Run the full migration first (sections 1-5 below).
-- 2. Go to Table Editor and manually insert a row in 'organisations'
--    for the developer's personal org (name, country, currency).
-- 3. Copy that org's UUID.
-- 4. Insert a row in 'organisation_members':
--      organisation_id = <org_uuid>
--      user_id         = <your_auth_user_uuid>
--      role            = 'admin'
-- 5. THEN come back and run the UPDATE statement at the very bottom
--    to assign the existing 65 receipts to that org.
--    DO NOT run the UPDATE before confirming the org row exists.
-- ============================================================

-- ── 1. New tables ─────────────────────────────────────────────────────────────

create table if not exists public.organisations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  country             text not null,
  currency            text not null default 'CHF',
  accounting_software text,
  created_at          timestamptz default now()
);

create table if not exists public.organisation_members (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('employee', 'manager', 'admin')),
  created_at      timestamptz default now()
);

create index if not exists organisation_members_user_idx
  on public.organisation_members (user_id);

create index if not exists organisation_members_org_idx
  on public.organisation_members (organisation_id);

create index if not exists receipts_org_status_idx
  on public.receipts (organisation_id, status);

-- ── 2. Extend receipts table ──────────────────────────────────────────────────

alter table public.receipts
  add column if not exists organisation_id  uuid references public.organisations(id),
  add column if not exists project_notes    text,
  add column if not exists submitted_at     timestamptz,
  add column if not exists reviewed_by      uuid references auth.users(id),
  add column if not exists reviewed_at      timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists edited_by        uuid references auth.users(id),
  add column if not exists edited_at        timestamptz;

-- receipts.status already exists with default 'draft' — no change needed.

-- ── 3. Enable RLS on new tables ───────────────────────────────────────────────

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

-- ── 4. RLS policies — organisations ──────────────────────────────────────────

-- Members can read their own organisation
create policy "org_members_can_read_org"
  on public.organisations for select
  using (
    exists (
      select 1 from public.organisation_members om
      where om.organisation_id = public.organisations.id
        and om.user_id = auth.uid()
    )
  );

-- ── 5. RLS policies — organisation_members ───────────────────────────────────

-- Users can read all memberships within their own organisation(s)
create policy "org_members_can_read_memberships"
  on public.organisation_members for select
  using (
    organisation_id in (
      select organisation_id from public.organisation_members
      where user_id = auth.uid()
    )
  );

-- ── 6. RLS policies — receipts (updated) ─────────────────────────────────────
--
-- Drop the existing employee-only SELECT and UPDATE policies, then replace.
-- These drop statements cover the most common names created via the Supabase
-- dashboard. If your policy names differ, drop them manually first.

drop policy if exists "Enable read access for users based on user_id" on public.receipts;
drop policy if exists "Users can view their own receipts" on public.receipts;
drop policy if exists "receipts_select_policy" on public.receipts;
drop policy if exists "Enable update for users based on user_id" on public.receipts;
drop policy if exists "Users can update their own receipts" on public.receipts;
drop policy if exists "receipts_update_policy" on public.receipts;

-- SELECT: own receipts OR manager/admin in the same org
create policy "receipts_select"
  on public.receipts for select
  using (
    user_id = auth.uid()
    or (
      organisation_id is not null
      and exists (
        select 1 from public.organisation_members om
        where om.organisation_id = public.receipts.organisation_id
          and om.user_id = auth.uid()
          and om.role in ('manager', 'admin')
      )
    )
  );

-- UPDATE: own receipts OR manager/admin in the same org
-- Column-level restrictions (status, reviewed_by, etc.) are enforced by
-- the mobile client code, not RLS, which is acceptable for V1.
create policy "receipts_update"
  on public.receipts for update
  using (
    user_id = auth.uid()
    or (
      organisation_id is not null
      and exists (
        select 1 from public.organisation_members om
        where om.organisation_id = public.receipts.organisation_id
          and om.user_id = auth.uid()
          and om.role in ('manager', 'admin')
      )
    )
  );

-- ── POST-MIGRATION: assign existing receipts to org ──────────────────────────
--
-- Run ONLY after confirming the org row exists in the organisations table.
-- Replace '<your_org_uuid>' with the actual UUID from the organisations table.
--
-- UPDATE public.receipts
-- SET organisation_id = '<your_org_uuid>'
-- WHERE organisation_id IS NULL;
