-- Users table: stores role assignments for each user
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null check (role in ('admin', 'district_lead', 'block_lead', 'state_lead')),
  -- Geography link: only one of these will be set depending on role
  state_name text,
  district_name text,
  block_name text,
  created_at timestamptz default now()
);

-- Placeholder test accounts (MVP only — wiped before real auth ships)
insert into public.users (email, role) values
  ('test-admin@placeholder.local', 'admin'),
  ('test-district-lead@placeholder.local', 'district_lead'),
  ('test-block-lead@placeholder.local', 'block_lead'),
  ('test-state-lead@placeholder.local', 'state_lead')
on conflict (email) do nothing;
