-- RecallRelay Phase 2 — core schema
-- Identity model:
--   profiles.id == auth.users.id (auth.uid()), wallet derived from verified auth identities.
--   Manufacturer tenancy lives in manufacturers + manufacturer_members (no global role enum).
--   product_units.current_owner_profile_id only changes through SECURITY DEFINER RPCs.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  wallet_address text,
  full_name text not null check (char_length(full_name) between 1 and 80),
  avatar_url text,
  email text,
  notification_prefs jsonb not null default '{"safety": true, "transfers": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_wallet_address_key on public.profiles (lower(wallet_address))
  where wallet_address is not null;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- manufacturers + membership
-- ---------------------------------------------------------------------------
create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  verified boolean not null default false,
  logo_url text,
  website text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger manufacturers_set_updated_at before update on public.manufacturers
  for each row execute function public.set_updated_at();

create table public.manufacturer_members (
  manufacturer_id uuid not null references public.manufacturers (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator')),
  created_at timestamptz not null default now(),
  primary key (manufacturer_id, profile_id)
);

create index manufacturer_members_profile_idx on public.manufacturer_members (profile_id);

-- ---------------------------------------------------------------------------
-- catalog: models + units
-- ---------------------------------------------------------------------------
create table public.product_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete cascade,
  sku text not null check (char_length(sku) between 1 and 32),
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (char_length(category) between 1 and 80),
  image_path text not null default '/products/heatcore.svg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manufacturer_id, sku)
);

create trigger product_models_set_updated_at before update on public.product_models
  for each row execute function public.set_updated_at();

create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.product_models (id) on delete restrict,
  serial_number text not null unique check (char_length(serial_number) between 4 and 48),
  manufactured_at date,
  registered_at timestamptz not null default now(),
  current_owner_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_units_model_idx on public.product_units (model_id);
create index product_units_owner_idx on public.product_units (current_owner_profile_id);

create trigger product_units_set_updated_at before update on public.product_units
  for each row execute function public.set_updated_at();

-- Full ownership history. No client INSERT: written by RPCs and seeds only.
create table public.ownership_records (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.product_units (id) on delete cascade,
  from_profile_id uuid references public.profiles (id) on delete set null,
  to_profile_id uuid references public.profiles (id) on delete set null,
  transferred_at timestamptz not null default now(),
  initiated_by uuid references auth.users (id) on delete set null,
  note text,
  check (from_profile_id is null or to_profile_id is null or from_profile_id <> to_profile_id)
);

create index ownership_records_unit_idx on public.ownership_records (unit_id, transferred_at);
create index ownership_records_from_idx on public.ownership_records (from_profile_id);
create index ownership_records_to_idx on public.ownership_records (to_profile_id);

-- ---------------------------------------------------------------------------
-- recalls
-- ---------------------------------------------------------------------------
create table public.recalls (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete cascade,
  model_id uuid references public.product_models (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  severity text not null default 'urgent' check (severity in ('urgent', 'important', 'info')),
  required_action text not null check (char_length(required_action) between 1 and 300),
  scope_kind text not null default 'all_units'
    check (scope_kind in ('all_units', 'serial_range', 'selected_units')),
  serial_from text,
  serial_to text,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  issued_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope_kind <> 'serial_range' or (serial_from is not null and serial_to is not null)),
  check (scope_kind <> 'selected_units' or model_id is not null)
);

create index recalls_manufacturer_idx on public.recalls (manufacturer_id, status);
create index recalls_model_idx on public.recalls (model_id, status);

create trigger recalls_set_updated_at before update on public.recalls
  for each row execute function public.set_updated_at();

-- Explicit unit scope for scope_kind = 'selected_units'.
create table public.recall_units (
  recall_id uuid not null references public.recalls (id) on delete cascade,
  unit_id uuid not null references public.product_units (id) on delete cascade,
  primary key (recall_id, unit_id)
);

create index recall_units_unit_idx on public.recall_units (unit_id);

-- ---------------------------------------------------------------------------
-- notifications (no client INSERT: RPCs and seeds only)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  recall_id uuid references public.recalls (id) on delete cascade,
  unit_id uuid references public.product_units (id) on delete cascade,
  kind text not null default 'recall' check (kind in ('recall', 'transfer', 'welcome')),
  severity text not null default 'info' check (severity in ('urgent', 'important', 'info')),
  title text not null check (char_length(title) between 1 and 120),
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- activity feed (append-only: no client INSERT/UPDATE/DELETE)
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.product_units (id) on delete cascade,
  manufacturer_id uuid references public.manufacturers (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  kind text not null
    check (kind in ('registered', 'issued', 'transferred', 'recall_issued', 'recall_closed')),
  summary text not null check (char_length(summary) between 1 and 200),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index activity_events_unit_idx on public.activity_events (unit_id, created_at);
create index activity_events_manufacturer_idx on public.activity_events (manufacturer_id, created_at);
