create table if not exists public.hierarchy (
  id               uuid primary key default gen_random_uuid(),
  state_name       text not null,
  district_name    text not null,
  block_name       text not null,
  block_lead_email text not null,
  field_worker_name text not null,
  village_name     text not null,
  status           text not null default 'active' check (status in ('active', 'removed')),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (state_name, district_name, block_name, field_worker_name, village_name)
);

alter table public.hierarchy enable row level security;
