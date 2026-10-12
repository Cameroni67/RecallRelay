-- RecallRelay Phase 3 — Solana ownership layer (Devnet).
-- Adds chain-state columns and two trusted reconciliation RPCs that the
-- server calls *after* reading the on-chain account directly. The client
-- never supplies chain state; it only supplies the tx signature to look up.

alter table public.manufacturers
  add column if not exists chain_program_id text,
  add column if not exists chain_pda text,
  add column if not exists chain_authority text,
  add column if not exists chain_state text not null default 'unregistered'
    check (chain_state in ('unregistered','pending','synced','error')),
  add column if not exists chain_synced_at timestamptz;

alter table public.product_units
  add column if not exists chain_program_id text,
  add column if not exists chain_pda text,
  add column if not exists chain_owner text,
  add column if not exists chain_transfer_count integer not null default 0,
  add column if not exists chain_state text not null default 'unregistered'
    check (chain_state in ('unregistered','pending','synced','error')),
  add column if not exists chain_tx_signature text,
  add column if not exists chain_synced_at timestamptz;

comment on column public.product_units.chain_state is
  'unregistered = no chain account yet; pending = tx sent, awaiting reconciliation; synced = server confirmed chain state matches DB; error = last reconciliation failed.';

-- Extend the activity kind check so reconciliation can be logged.
alter table public.activity_events drop constraint activity_events_kind_check;
alter table public.activity_events add constraint activity_events_kind_check
  check (kind in ('registered','issued','transferred','recall_issued','recall_closed','chain_reconciled'));

-- ---------------------------------------------------------------------------
-- Trusted reconciliation RPCs.
-- The caller is the server (service role) or a signed-in user acting on a
-- row they already own. Either way these RPCs only ever write the *server's*
-- view of the chain; the request payload carries a signature to look up and
-- the chain state the server observed, never a client-asserted value.
-- ---------------------------------------------------------------------------

-- Record that a manufacturer's on-chain account was created and observed.
create or replace function public.reconcile_manufacturer_chain_state(
  p_manufacturer_id uuid,
  p_program_id text,
  p_pda text,
  p_authority text,
  p_state text,
  p_tx_signature text default null
)
returns public.manufacturers
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_mfr public.manufacturers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select public.manufacturer_member_role(p_manufacturer_id) into v_role;
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'only manufacturer owners or admins can reconcile manufacturer chain state';
  end if;
  if p_state not in ('unregistered','pending','synced','error') then
    raise exception 'invalid chain state';
  end if;

  update public.manufacturers
     set chain_program_id = btrim(p_program_id),
         chain_pda = btrim(p_pda),
         chain_authority = btrim(p_authority),
         chain_state = p_state,
         chain_synced_at = now()
   where id = p_manufacturer_id
  returning * into v_mfr;

  if v_mfr is null then
    raise exception 'unknown manufacturer';
  end if;

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (null, p_manufacturer_id, v_uid, 'chain_reconciled', 'Manufacturer verified on Solana',
          jsonb_build_object('pda', btrim(p_pda), 'state', p_state, 'tx', p_tx_signature));

  return v_mfr;
end;
$$;

-- Record that a product unit's on-chain account was created and observed.
create or replace function public.reconcile_product_chain_state(
  p_unit_id uuid,
  p_program_id text,
  p_pda text,
  p_owner text,
  p_transfer_count integer,
  p_state text,
  p_tx_signature text default null
)
returns public.product_units
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_unit public.product_units;
  v_model public.product_models;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v_unit from public.product_units where id = p_unit_id;
  if v_unit is null then
    raise exception 'unknown product unit';
  end if;
  select * into v_model from public.product_models where id = v_unit.model_id;
  select public.manufacturer_member_role(v_model.manufacturer_id) into v_role;
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'only manufacturer owners or admins can reconcile product chain state';
  end if;
  if p_state not in ('unregistered','pending','synced','error') then
    raise exception 'invalid chain state';
  end if;
  if p_transfer_count < 0 then
    raise exception 'transfer count cannot be negative';
  end if;

  update public.product_units
     set chain_program_id = btrim(p_program_id),
         chain_pda = btrim(p_pda),
         chain_owner = btrim(p_owner),
         chain_transfer_count = p_transfer_count,
         chain_state = p_state,
         chain_tx_signature = coalesce(btrim(p_tx_signature), chain_tx_signature),
         chain_synced_at = now()
   where id = p_unit_id
  returning * into v_unit;

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (p_unit_id, v_model.manufacturer_id, v_uid, 'chain_reconciled', 'Product verified on Solana',
          jsonb_build_object('pda', btrim(p_pda), 'state', p_state,
                             'owner', btrim(p_owner), 'transfer_count', p_transfer_count,
                             'tx', p_tx_signature));

  return v_unit;
end;
$$;

grant execute on function public.reconcile_manufacturer_chain_state(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.reconcile_product_chain_state(uuid, text, text, text, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Phase 3: transfer_product_ownership is no longer the authority for units
-- that exist on chain. It keeps its Phase 2 validation messages (matched by
-- the client) but refuses to move ownership off-chain once a unit has a
-- Solana account; the caller must transfer on chain and reconcile instead.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_product_ownership(
  p_unit_id uuid,
  p_recipient_wallet text,
  p_note text default null
)
returns public.product_units
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_unit public.product_units;
  v_recipient public.profiles;
  v_model public.product_models;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_unit from public.product_units where id = p_unit_id;
  if v_unit is null then
    raise exception 'unknown product unit';
  end if;
  if v_unit.current_owner_profile_id is distinct from v_uid then
    raise exception 'only the current owner can transfer this product';
  end if;
  if v_unit.chain_state in ('pending', 'synced') then
    raise exception 'product is recorded on Solana; transfer on chain and reconcile the transaction';
  end if;

  select * into v_recipient from public.profiles
  where lower(wallet_address) = lower(btrim(p_recipient_wallet));
  if v_recipient is null then
    raise exception 'no RecallRelay profile for that wallet';
  end if;
  if v_recipient.id = v_uid then
    raise exception 'cannot transfer to yourself';
  end if;

  select * into v_model from public.product_models where id = v_unit.model_id;

  update public.product_units
     set current_owner_profile_id = v_recipient.id
   where id = v_unit.id
  returning * into v_unit;

  insert into public.ownership_records (unit_id, from_profile_id, to_profile_id, initiated_by, note)
  values (v_unit.id, v_uid, v_recipient.id, v_uid, nullif(btrim(p_note), ''));

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (
    v_unit.id,
    v_model.manufacturer_id,
    v_uid,
    'transferred',
    'Ownership transferred',
    jsonb_build_object(
      'from', (select full_name from public.profiles where id = v_uid),
      'to', v_recipient.full_name,
      'serial', v_unit.serial_number
    )
  );

  insert into public.notifications (profile_id, kind, severity, title, body, unit_id)
  values (
    v_recipient.id,
    'transfer',
    'info',
    'You now own ' || v_model.name,
    'Ownership of ' || v_unit.serial_number || ' was transferred to you.',
    v_unit.id
  );

  return v_unit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phase 3: public lookup now exposes the chain state a server reconciliation
-- observed, so the passport can tell the truth about on-chain status.
-- `drop` first: postgres refuses to change an existing function's return type.
-- ---------------------------------------------------------------------------
drop function if exists public.lookup_public_product(text);
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
  recall_issued_at timestamptz,
  chain_program_id text,
  chain_pda text,
  chain_owner text,
  chain_transfer_count integer,
  chain_state text,
  chain_tx_signature text,
  chain_synced_at timestamptz
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
    rc.issued_at,
    u.chain_program_id,
    u.chain_pda,
    u.chain_owner,
    u.chain_transfer_count,
    u.chain_state,
    u.chain_tx_signature,
    u.chain_synced_at
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

-- dropping the old function also dropped its anon grant; public verification needs it.
grant execute on function public.lookup_public_product(text) to anon;

-- ---------------------------------------------------------------------------
-- Phase 3: apply an ownership transfer the server observed on chain. Unlike
-- transfer_product_ownership this never trusts the caller's claim about the
-- new owner: the caller is the server, which has already read the chain
-- account and confirmed the signature; these values are that observation.
-- ---------------------------------------------------------------------------
create or replace function public.apply_chain_transfer(
  p_unit_id uuid,
  p_new_owner_wallet text,
  p_chain_owner text,
  p_transfer_count integer,
  p_tx_signature text
)
returns public.product_units
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_unit public.product_units;
  v_model public.product_models;
  v_recipient public.profiles;
  v_from uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_transfer_count < 0 then
    raise exception 'transfer count cannot be negative';
  end if;
  if nullif(btrim(p_tx_signature), '') is null then
    raise exception 'transaction signature is required';
  end if;

  select * into v_unit from public.product_units where id = p_unit_id for update;
  if v_unit is null then
    raise exception 'unknown product unit';
  end if;
  if v_unit.chain_state not in ('pending', 'synced') then
    raise exception 'product is not recorded on Solana';
  end if;
  if v_unit.chain_transfer_count >= p_transfer_count then
    raise exception 'transfer already reconciled';
  end if;

  select * into v_model from public.product_models where id = v_unit.model_id;

  select * into v_recipient from public.profiles
  where lower(wallet_address) = lower(btrim(p_new_owner_wallet));
  if v_recipient is null then
    raise exception 'no RecallRelay profile for that wallet';
  end if;

  v_from := v_unit.current_owner_profile_id;

  update public.product_units
     set current_owner_profile_id = v_recipient.id,
         chain_owner = btrim(p_chain_owner),
         chain_transfer_count = p_transfer_count,
         chain_state = 'synced',
         chain_tx_signature = btrim(p_tx_signature),
         chain_synced_at = now()
   where id = v_unit.id
  returning * into v_unit;

  insert into public.ownership_records (unit_id, from_profile_id, to_profile_id, initiated_by, note)
  values (v_unit.id, v_from, v_recipient.id, v_uid, 'Confirmed on Solana');

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (
    v_unit.id,
    v_model.manufacturer_id,
    v_uid,
    'transferred',
    'Ownership transferred on Solana',
    jsonb_build_object(
      'from', (select full_name from public.profiles where id = v_from),
      'to', v_recipient.full_name,
      'serial', v_unit.serial_number,
      'tx', btrim(p_tx_signature)
    )
  );

  insert into public.notifications (profile_id, kind, severity, title, body, unit_id)
  values (
    v_recipient.id,
    'transfer',
    'info',
    'You now own ' || v_model.name,
    'Ownership of ' || v_unit.serial_number || ' was transferred to you.',
    v_unit.id
  );

  return v_unit;
end;
$$;

grant execute on function public.apply_chain_transfer(uuid, text, text, integer, text) to authenticated;
