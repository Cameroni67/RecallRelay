-- RecallRelay Phase 2 — helper functions and triggers
-- All helpers are explicit about search_path and avoid leaking auth schema internals.

-- ---------------------------------------------------------------------------
-- wallet helpers
-- ---------------------------------------------------------------------------
create or replace function public.mask_wallet(p_address text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_address is null or length(p_address) <= 10 then null
    else left(p_address, 4) || '…' || right(p_address, 4)
  end;
$$;

-- Resolves the wallet address from an auth identity regardless of shape:
-- seeded fixtures store `address` at the top level, while real Solana SIWS
-- identities nest it under `custom_claims` and encode it in provider_id/sub
-- as `web3:solana:<address>`.
create or replace function public.identity_wallet_address(
  p_identity_data jsonb,
  p_provider_id text default null
)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(
    p_identity_data ->> 'address',
    p_identity_data -> 'custom_claims' ->> 'address',
    case
      when p_provider_id like 'web3:%' then split_part(p_provider_id, ':', 3)
      else null
    end
  );
$$;

-- Derived from the caller's own auth identities. Never taken from client input.
create or replace function public.auth_wallet_address(p_user_id uuid default null)
returns text
language sql
stable
security definer
set search_path = public, extensions, auth
as $$
  select public.identity_wallet_address(i.identity_data, i.provider_id)
  from auth.identities i
  where i.user_id = coalesce(p_user_id, auth.uid())
    and public.identity_wallet_address(i.identity_data, i.provider_id) is not null
  order by coalesce(i.last_sign_in_at, i.created_at) desc nulls last
  limit 1;
$$;

-- Bind (and lock) the wallet when a profile row is created.
create or replace function public.profiles_bind_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_wallet text;
begin
  select public.auth_wallet_address(new.id) into v_wallet;
  if v_wallet is not null then
    if exists (
      select 1 from public.profiles p
      where lower(p.wallet_address) = lower(v_wallet) and p.id <> new.id
    ) then
      raise exception 'wallet already linked to another profile using %', public.mask_wallet(v_wallet);
    end if;
    new.wallet_address := v_wallet;
  end if;
  return new;
end;
$$;

create trigger profiles_bind_wallet_before_insert
  before insert on public.profiles
  for each row execute function public.profiles_bind_wallet();

-- Keep the profile wallet in sync when an identity arrives/changes after sign-in.
create or replace function public.identities_sync_profile_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_wallet text := public.identity_wallet_address(new.identity_data, new.provider_id);
begin
  if v_wallet is null then
    return null;
  end if;
  if exists (
    select 1 from public.profiles p
    where lower(p.wallet_address) = lower(v_wallet) and p.id <> new.user_id
  ) then
    raise exception 'wallet already linked to another profile using %', public.mask_wallet(v_wallet);
  end if;
  update public.profiles
     set wallet_address = v_wallet
   where id = new.user_id and wallet_address is distinct from v_wallet;
  return null;
end;
$$;

create trigger identities_sync_profile_wallet_after_insert
  after insert or update of identity_data on auth.identities
  for each row execute function public.identities_sync_profile_wallet();

-- ---------------------------------------------------------------------------
-- membership helpers (SECURITY DEFINER to avoid recursive RLS evaluation)
-- ---------------------------------------------------------------------------
create or replace function public.is_manufacturer_member(p_manufacturer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.manufacturer_members mm
    where mm.manufacturer_id = p_manufacturer_id
      and mm.profile_id = auth.uid()
  );
$$;

create or replace function public.manufacturer_member_role(p_manufacturer_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select mm.role from public.manufacturer_members mm
  where mm.manufacturer_id = p_manufacturer_id
    and mm.profile_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_manufacturer_staff(p_manufacturer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.manufacturer_member_role(p_manufacturer_id) in ('owner', 'admin');
$$;

-- ---------------------------------------------------------------------------
-- recall scope resolution
-- ---------------------------------------------------------------------------
create or replace function public.active_recalls_for_unit(p_unit_id uuid)
returns setof public.recalls
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.recalls r
  join public.product_units u on u.id = p_unit_id
  where r.status = 'active'
    and (
      (r.scope_kind = 'all_units' and r.model_id = u.model_id)
      or (
        r.scope_kind = 'serial_range'
        and r.model_id = u.model_id
        and u.serial_number between r.serial_from and r.serial_to
      )
      or (
        r.scope_kind = 'selected_units'
        and exists (
          select 1 from public.recall_units ru
          where ru.recall_id = r.id and ru.unit_id = u.id
        )
      )
    );
$$;

-- Number of units a recall currently affects.
create or replace function public.recall_affected_unit_count(p_recall_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.product_units u
  where exists (
    select 1 from public.active_recalls_for_unit(u.id) r where r.id = p_recall_id
  );
$$;

-- Distinct current owners of affected units (recall notification targets).
create or replace function public.recall_affected_owner_ids(p_recall_id uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select distinct u.current_owner_profile_id
  from public.product_units u
  where u.current_owner_profile_id is not null
    and exists (
      select 1 from public.active_recalls_for_unit(u.id) r where r.id = p_recall_id
    );
$$;

-- ---------------------------------------------------------------------------
-- public verification lookup (single source for /verify)
-- accepts a unit uuid or a serial number; draft recalls are never exposed
-- ---------------------------------------------------------------------------
create or replace function public.lookup_public_product(p_identifier text)
returns table (
  unit_id uuid,
  serial_number text,
  model_id uuid,
  model_sku text,
  model_name text,
  category text,
  image_path text,
  manufacturer_id uuid,
  manufacturer_name text,
  manufacturer_verified boolean,
  is_recalled boolean,
  recall_id uuid,
  recall_title text,
  recall_severity text,
  recall_required_action text,
  recall_issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.serial_number,
    m.id,
    m.sku,
    m.name,
    m.category,
    m.image_path,
    man.id,
    man.name,
    man.verified,
    (rc.id is not null),
    rc.id,
    rc.title,
    rc.severity,
    rc.required_action,
    rc.issued_at
  from public.product_units u
  join public.product_models m on m.id = u.model_id
  join public.manufacturers man on man.id = m.manufacturer_id
  left join lateral (
    select r.id, r.title, r.severity, r.required_action, r.issued_at
    from public.active_recalls_for_unit(u.id) r
    order by r.issued_at desc nulls last
    limit 1
  ) rc on true
  where (p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and u.id::text = lower(p_identifier))
     or u.serial_number = upper(p_identifier)
  limit 1;
$$;
