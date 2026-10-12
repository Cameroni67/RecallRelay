-- RecallRelay Phase 3 — chain reconciliation hardening.
-- 007 created the trusted reconciliation pathway; this migration tightens it:
--
--   1. Reconciliation is idempotent: repeating the same observation writes
--      no duplicate activity events (values are re-stamped, events only fire
--      when an observed chain value actually changed).
--   2. apply_chain_transfer is restricted to the unit's current owner or
--      manufacturer staff, and requires the claimed chain owner to equal the
--      recipient wallet, so a random authenticated profile cannot hijack
--      ownership history.
--
-- Direct client writes to the chain columns were already impossible: the
-- Phase 2 grant baseline revoked insert/update on product_units and granted
-- manufacturers only SELECT (003_rls.sql), so clients cannot touch
-- chain_* columns at all. pgTAP proves that explicitly.

-- ---------------------------------------------------------------------------
-- reconcile_manufacturer_chain_state — idempotent activity ledger
-- ---------------------------------------------------------------------------
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
  v_prev public.manufacturers;
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

  select * into v_prev from public.manufacturers where id = p_manufacturer_id;
  if v_prev is null then
    raise exception 'unknown manufacturer';
  end if;

  update public.manufacturers
     set chain_program_id = btrim(p_program_id),
         chain_pda = btrim(p_pda),
         chain_authority = btrim(p_authority),
         chain_state = p_state,
         chain_synced_at = now()
   where id = p_manufacturer_id
  returning * into v_mfr;

  -- Only log when the observed chain values actually changed; repeating the
  -- same reconciliation must not duplicate the ledger.
  if v_prev.chain_program_id is distinct from v_mfr.chain_program_id
     or v_prev.chain_pda is distinct from v_mfr.chain_pda
     or v_prev.chain_authority is distinct from v_mfr.chain_authority
     or v_prev.chain_state is distinct from v_mfr.chain_state then
    insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
    values (null, p_manufacturer_id, v_uid, 'chain_reconciled', 'Manufacturer verified on Solana',
            jsonb_build_object('pda', btrim(p_pda), 'state', p_state, 'tx', p_tx_signature));
  end if;

  return v_mfr;
end;
$$;

-- ---------------------------------------------------------------------------
-- reconcile_product_chain_state — idempotent activity ledger
-- ---------------------------------------------------------------------------
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
  v_prev public.product_units;
  v_unit public.product_units;
  v_model public.product_models;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v_prev from public.product_units where id = p_unit_id;
  if v_prev is null then
    raise exception 'unknown product unit';
  end if;
  select * into v_model from public.product_models where id = v_prev.model_id;
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

  if v_prev.chain_program_id is distinct from v_unit.chain_program_id
     or v_prev.chain_pda is distinct from v_unit.chain_pda
     or v_prev.chain_owner is distinct from v_unit.chain_owner
     or v_prev.chain_transfer_count is distinct from v_unit.chain_transfer_count
     or v_prev.chain_state is distinct from v_unit.chain_state then
    insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
    values (p_unit_id, v_model.manufacturer_id, v_uid, 'chain_reconciled', 'Product verified on Solana',
            jsonb_build_object('pda', btrim(p_pda), 'state', p_state,
                               'owner', btrim(p_owner), 'transfer_count', p_transfer_count,
                               'tx', p_tx_signature));
  end if;

  return v_unit;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_chain_transfer — authorization guard + integrity check
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
  v_role text;
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
  if btrim(p_chain_owner) <> btrim(p_new_owner_wallet) then
    raise exception 'chain owner must match the recipient wallet';
  end if;

  select * into v_unit from public.product_units where id = p_unit_id for update;
  if v_unit is null then
    raise exception 'unknown product unit';
  end if;

  -- Only the current owner (the party to the transfer) or manufacturer staff
  -- may record a chain transfer for this unit.
  select * into v_model from public.product_models where id = v_unit.model_id;
  select public.manufacturer_member_role(v_model.manufacturer_id) into v_role;
  if v_unit.current_owner_profile_id is distinct from v_uid
     and (v_role is null or v_role not in ('owner','admin')) then
    raise exception 'only the current owner or manufacturer staff can reconcile a transfer';
  end if;

  if v_unit.chain_state not in ('pending', 'synced') then
    raise exception 'product is not recorded on Solana';
  end if;
  if v_unit.chain_transfer_count >= p_transfer_count then
    raise exception 'transfer already reconciled';
  end if;

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
