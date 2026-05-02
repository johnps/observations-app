create table if not exists public.observations (
  id               uuid primary key,
  text             text not null,
  field_worker_name text not null,
  village_name     text not null,
  block_lead_email text not null,
  gps_lat          double precision,
  gps_lng          double precision,
  gps_captured     boolean not null default false,
  tags             text[] not null default '{}',
  submitted_at     timestamptz not null,
  created_at       timestamptz default now()
);

alter table public.observations enable row level security;
