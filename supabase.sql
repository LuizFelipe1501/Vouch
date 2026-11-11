-- Run once in the SQL editor of the Vouch Supabase project.
create table if not exists public.vouch_users (
  phone text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.vouch_waitlist (
  phone text primary key,
  name text,
  protects text,
  source text,
  created_at timestamptz not null default now()
);
alter table public.vouch_users enable row level security;
alter table public.vouch_waitlist enable row level security;
-- No policies on purpose: only the server (service role key) reads and writes.

-- Anonymous scam reports (no user phone or name): the shared scam-intelligence base.
create table if not exists public.vouch_reports (
  id uuid primary key,
  created_at timestamptz not null default now(),
  country text,
  lang text,
  source text,
  verdict text,
  scam_type text,
  indicators jsonb,
  excerpt text
);
alter table public.vouch_reports enable row level security;
