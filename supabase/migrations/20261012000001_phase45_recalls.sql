-- RecallRelay Phase 4/5 — recall system completion (recall authority stays
-- OFF-CHAIN; the Solana program is not touched). Supabase remains
-- authoritative for recalls, recall text, severity, scope, notifications and
-- the UI timeline; Solana stays authoritative for manufacturer registration,
-- product registration, current ownership and transfer count.
--
--   1. recalls.description — recall copy now has a body field.
--   2. severity vocabulary: recalls become advisory | important | urgent;
--      notifications keep their existing values plus advisory (existing rows
--      are never rewritten).
--   3. notifications.dedupe_key + partial unique index — repeated recall
--      processing or repeated reconciliation can never double-notify anyone.
--   4. recall_matches_unit — one shared, status-independent scope predicate
--      used by the scope helpers, RLS policies and the public lookup. Counts
--      now include resolved recalls (management UI) while drafts stay
--      staff-only.
--   5. RLS: the current owner of an affected unit keeps read access to a
--      resolved recall (notification deep-links and history keep working);
--      the public only ever sees active recalls.
--   6. lookup_public_product: registered_at + privacy-safe history jsonb
--      (kind + date only — no names, wallets, emails or auth ids).
--   7. issue_recall: description, advisory severity, model required, serial
--      range validation, cross-manufacturer unit rejection, deduped
--      current-owner notifications.
--   8. close_recall: explicit active → closed transition with deduped
--      resolution notifications for CURRENT owners only, plus a
--      recall_closed activity event.
--   9. apply_chain_transfer: the recipient notification carries a dedupe key.
--  10. canonical demo fixture text (hosted/local parity).

-- ---------------------------------------------------------------------------
-- 1. recalls.description
-- ---------------------------------------------------------------------------
alter table public.recalls
  add column if not exists description text
  constraint recalls_description_check
  check (description is null or char_length(description) <= 4000);

-- ---------------------------------------------------------------------------
-- 2. severity vocabulary
-- ---------------------------------------------------------------------------
update public.recalls set severity = 'advisory' where severity = 'info';

alter table public.recalls drop constraint if exists recalls_severity_check;
alter table public.recalls
  add constraint recalls_severity_check
  check (severity in ('advisory', 'important', 'urgent'));

-- notifications keep their legacy values; advisory is added so recall
-- notifications can carry the recall's own severity verbatim.
alter table public.notifications drop constraint if exists notifications_severity_check;
alter table public.notifications
  add constraint notifications_severity_check
  check (severity in ('urgent', 'important', 'info', 'advisory'));

-- ---------------------------------------------------------------------------
-- 3. notification idempotency
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_uidx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- 4. shared scope predicate + status-aware helpers
-- ---------------------------------------------------------------------------
-- Single source of truth for "does this recall scope-cover that unit".
-- SECURITY DEFINER so RLS policies can evaluate it without the caller holding
-- direct reads on recalls/recall_units (anon has no recall_units grant).
create or replace function public.recall_matches_unit(p_recall_id uuid, p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.recalls r
    join public.product_units u on u.id = p_unit_id
    join public.product_models m on m.id = u.model_id
    where r.id = p_recall_id
      and r.manufacturer_id = m.manufacturer_id
      and (
        (r.scope_kind = 'all_units' and r.model_id = u.model_id)
        or (r.scope_kind = 'serial_range'
            and r.model_id = u.model_id
            and u.serial_number between r.serial_from and r.serial_to)
        or (r.scope_kind = 'selected_units'
            and exists (
              select 1 from public.recall_units ru
              where ru.recall_id = r.id and ru.unit_id = u.id
            ))
      )
  );
$$;

-- Does a resolved/active recall currently sit on a profile's own units?
-- Used by RLS so owners can re-read recalls they were notified about after
-- the manufacturer resolves them.
create or replace function public.recall_affects_current_owner(p_recall_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id is not null
    and exists (
      select 1 from public.product_units u
      where u.current_owner_profile_id = p_profile_id
        and public.recall_matches_unit(p_recall_id, u.id)
    );
$$;

create or replace function public.active_recalls_for_unit(p_unit_id uuid)
returns setof public.recalls
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.recalls r
  where r.status = 'active'
    and public.recall_matches_unit(r.id, p_unit_id);
$$;

-- Affected-unit count: active AND resolved (management UI), drafts only for
-- their own staff. Unknown ids report 0 (matches the previous behaviour).
create or replace function public.recall_affected_unit_count(p_recall_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when r.status = 'draft'
           and not coalesce(public.is_manufacturer_staff(r.manufacturer_id), false)
      then 0
      else (
        select count(*)::integer
        from public.product_units u
        where public.recall_matches_unit(p_recall_id, u.id)
      )
    end
    from public.recalls r
    where r.id = p_recall_id
  ), 0);
$$;

-- Distinct current owners of affected units (recall notification targets).
-- SECURITY DEFINER now: close_recall runs it as definer, and the count must
-- keep working for resolved recalls. Drafts stay staff-only.
create or replace function public.recall_affected_owner_ids(p_recall_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct u.current_owner_profile_id
  from public.product_units u
  where u.current_owner_profile_id is not null
    and public.recall_matches_unit(p_recall_id, u.id)
    and exists (
      select 1 from public.recalls r
      where r.id = p_recall_id
        and (r.status <> 'draft'
             or coalesce(public.is_manufacturer_staff(r.manufacturer_id), false))
    );
$$;

-- policy helpers are invoked while evaluating anon-visible RLS policies
grant execute on function public.recall_matches_unit(uuid, uuid) to anon, authenticated;
grant execute on function public.recall_affects_current_owner(uuid, uuid) to anon, authenticated;
grant execute on function public.recall_affected_owner_ids(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS — current owners keep resolved recalls, public sees active only
-- ---------------------------------------------------------------------------
drop policy if exists "recalls_select_active_or_staff" on public.recalls;
create policy "recalls_select_active_or_staff"
  on public.recalls for select
  using (
    status = 'active'
    or public.is_manufacturer_staff(manufacturer_id)
    or (
      status = 'closed'
      and public.recall_affects_current_owner(recalls.id, auth.uid())
    )
  );

drop policy if exists "recall_units_select_visible_recall" on public.recall_units;
create policy "recall_units_select_visible_recall"
  on public.recall_units for select to authenticated
  using (
    exists (
      select 1 from public.recalls r
      where r.id = recall_units.recall_id
        and (
          r.status = 'active'
          or public.is_manufacturer_staff(r.manufacturer_id)
          or (
            r.status = 'closed'
            and public.recall_affects_current_owner(r.id, auth.uid())
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. lookup_public_product — registered_at + privacy-safe public history
--    (kind + date only; no owner names, wallets, emails or auth ids)
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
  chain_synced_at timestamptz,
  registered_at timestamptz,
  history jsonb
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
    u.chain_synced_at,
    u.registered_at,
    coalesce((
      select jsonb_agg(e.entry order by e.at)
      from (
        select jsonb_build_object('kind', 'registered', 'at', u.registered_at) as entry,
               u.registered_at as at
        union all
        select jsonb_build_object('kind', 'transferred', 'at', o.transferred_at),
               o.transferred_at
        from public.ownership_records o
        where o.unit_id = u.id
          and o.from_profile_id is not null
          and o.to_profile_id is not null
        union all
        select jsonb_build_object('kind', 'recall_issued', 'at', r.issued_at),
               r.issued_at
        from public.recalls r
        where r.status in ('active', 'closed')
          and public.recall_matches_unit(r.id, u.id)
      ) e
    ), '[]'::jsonb)
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
-- 7. issue_recall (v2)
-- ---------------------------------------------------------------------------
drop function if exists public.issue_recall(uuid, uuid, text, text, text, text, text, text, uuid[]);
create or replace function public.issue_recall(
  p_manufacturer_id uuid,
  p_model_id uuid,
  p_title text,
  p_severity text,
  p_required_action text,
  p_scope_kind text default 'all_units',
  p_serial_from text default null,
  p_serial_to text default null,
  p_unit_ids uuid[] default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_recall public.recalls;
  v_affected integer := 0;
  v_notified integer := 0;
  v_rowcount integer;
  v_owner uuid;
  v_model public.product_models;
  v_unit_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- recall must belong to the caller's manufacturer, issued by owner/admin
  select public.manufacturer_member_role(p_manufacturer_id) into v_role;
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'only manufacturer owners or admins can issue recalls';
  end if;

  if p_model_id is null then
    raise exception 'product model is required';
  end if;
  select * into v_model from public.product_models where id = p_model_id;
  if v_model is null or v_model.manufacturer_id <> p_manufacturer_id then
    raise exception 'product model does not belong to this manufacturer';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'title must be 1 to 120 characters';
  end if;
  if p_required_action is null or char_length(btrim(p_required_action)) not between 1 and 300 then
    raise exception 'required action must be 1 to 300 characters';
  end if;
  if p_description is not null and char_length(btrim(p_description)) > 4000 then
    raise exception 'description must be at most 4000 characters';
  end if;
  if p_severity not in ('advisory', 'important', 'urgent') then
    raise exception 'invalid severity';
  end if;
  if p_scope_kind not in ('all_units', 'serial_range', 'selected_units') then
    raise exception 'invalid scope';
  end if;
  if p_scope_kind = 'serial_range' then
    if p_serial_from is null or p_serial_to is null
       or btrim(p_serial_from) = '' or btrim(p_serial_to) = '' then
      raise exception 'serial range requires a start and end serial';
    end if;
    if btrim(p_serial_from) > btrim(p_serial_to) then
      raise exception 'serial range is invalid';
    end if;
  end if;
  if p_scope_kind = 'selected_units' and (p_unit_ids is null or coalesce(array_length(p_unit_ids, 1), 0) = 0) then
    raise exception 'selected_units scope requires unit ids';
  end if;

  insert into public.recalls (
    manufacturer_id, model_id, title, severity, required_action, description,
    scope_kind, serial_from, serial_to, status, issued_at, created_by
  ) values (
    p_manufacturer_id,
    p_model_id,
    btrim(p_title),
    p_severity,
    btrim(p_required_action),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_scope_kind,
    case when p_scope_kind = 'serial_range' then btrim(p_serial_from) end,
    case when p_scope_kind = 'serial_range' then btrim(p_serial_to) end,
    'active',
    now(),
    v_uid
  )
  returning * into v_recall;

  if p_scope_kind = 'selected_units' then
    foreach v_unit_id in array p_unit_ids loop
      -- unit must exist and belong to the caller's manufacturer AND model
      if not exists (
        select 1
        from public.product_units u
        join public.product_models m on m.id = u.model_id
        where u.id = v_unit_id
          and m.manufacturer_id = p_manufacturer_id
          and u.model_id = p_model_id
      ) then
        raise exception 'unit % is not eligible for this recall', v_unit_id;
      end if;
      insert into public.recall_units (recall_id, unit_id) values (v_recall.id, v_unit_id);
    end loop;
  end if;

  v_affected := public.recall_affected_unit_count(v_recall.id);

  -- CURRENT owners only: recall_affected_owner_ids resolves the present owner
  -- of each affected unit, so previous owners are never notified as current.
  -- dedupe_key + on conflict do nothing makes reprocessing idempotent.
  for v_owner in
    select owner_id from public.recall_affected_owner_ids(v_recall.id) owner_id
  loop
    insert into public.notifications (profile_id, kind, severity, title, body, recall_id, dedupe_key)
    values (
      v_owner,
      'recall',
      p_severity,
      btrim(p_title),
      'Required action: ' || btrim(p_required_action),
      v_recall.id,
      'recall-issued:' || v_recall.id::text || ':' || v_owner::text
    )
    on conflict do nothing;
    get diagnostics v_rowcount = row_count;
    v_notified := v_notified + v_rowcount;
  end loop;

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (
    null,
    p_manufacturer_id,
    v_uid,
    'recall_issued',
    'Recall issued: ' || btrim(p_title),
    jsonb_build_object(
      'recall_id', v_recall.id,
      'severity', p_severity,
      'scope', p_scope_kind,
      'affected', v_affected
    )
  );

  return jsonb_build_object(
    'id', v_recall.id,
    'status', v_recall.status,
    'affected_units', v_affected,
    'notified_owners', v_notified
  );
end;
$$;
grant execute on function public.issue_recall(uuid, uuid, text, text, text, text, text, text, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. close_recall — explicit status transition, immutable core record
-- ---------------------------------------------------------------------------
create or replace function public.close_recall(p_recall_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_recall public.recalls;
  v_owner uuid;
  v_notified integer := 0;
  v_rowcount integer;
  v_affected integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_recall from public.recalls where id = p_recall_id for update;
  if v_recall is null then
    raise exception 'unknown recall';
  end if;

  -- close_recall must stay inside the recall's own manufacturer
  select public.manufacturer_member_role(v_recall.manufacturer_id) into v_role;
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'only manufacturer owners or admins can manage recalls';
  end if;

  -- idempotent: a repeat call is a no-op and never re-notifies
  if v_recall.status = 'closed' then
    return jsonb_build_object(
      'id', v_recall.id,
      'status', 'closed',
      'affected_units', public.recall_affected_unit_count(v_recall.id),
      'notified_owners', 0,
      'already_closed', true
    );
  end if;

  v_affected := public.recall_affected_unit_count(v_recall.id);

  if v_recall.status = 'active' then
    -- resolution notice goes to CURRENT owners only, deduped per owner
    for v_owner in
      select owner_id from public.recall_affected_owner_ids(v_recall.id) owner_id
    loop
      insert into public.notifications (profile_id, kind, severity, title, body, recall_id, dedupe_key)
      values (
        v_owner,
        'recall',
        v_recall.severity,
        'Recall resolved: ' || v_recall.title,
        'The manufacturer closed this recall. Original required action: ' || v_recall.required_action,
        v_recall.id,
        'recall-closed:' || v_recall.id::text || ':' || v_owner::text
      )
      on conflict do nothing;
      get diagnostics v_rowcount = row_count;
      v_notified := v_notified + v_rowcount;
    end loop;
  end if;

  update public.recalls set status = 'closed' where id = v_recall.id;

  -- a draft was never published: no timeline event, no notifications
  if v_recall.status = 'active' then
    insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
    values (
      null,
      v_recall.manufacturer_id,
      v_uid,
      'recall_closed',
      'Recall resolved: ' || v_recall.title,
      jsonb_build_object(
        'recall_id', v_recall.id,
        'severity', v_recall.severity,
        'scope', v_recall.scope_kind,
        'affected', v_affected
      )
    );
  end if;

  return jsonb_build_object(
    'id', v_recall.id,
    'status', 'closed',
    'affected_units', v_affected,
    'notified_owners', v_notified
  );
end;
$$;
grant execute on function public.close_recall(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. apply_chain_transfer — deduped recipient notification
--    (repeated reconciliation can never duplicate a transfer notice)
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

  insert into public.notifications (profile_id, kind, severity, title, body, unit_id, dedupe_key)
  values (
    v_recipient.id,
    'transfer',
    'info',
    'You now own ' || v_model.name,
    'Ownership of ' || v_unit.serial_number || ' was transferred to you.',
    v_unit.id,
    'transfer:' || v_unit.id::text || ':' || p_transfer_count::text
  )
  on conflict do nothing;

  return v_unit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. canonical demo fixture text (applied to already-seeded databases so
--     local resets and the hosted project tell the same demo story)
-- ---------------------------------------------------------------------------
update public.recalls
   set required_action = 'Stop using immediately and contact the manufacturer.',
       description = coalesce(
         description,
         'Battery cells in affected units can overheat during fast charging. Northstar is replacing affected units free of charge.'
       )
 where id = '77777777-7777-7777-7777-777777777701';

update public.notifications
   set body = 'Required action: Stop using immediately and contact the manufacturer.'
 where id = '99999999-9999-9999-9999-999999999901';
