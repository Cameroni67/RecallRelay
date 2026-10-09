-- RecallRelay Phase 2 — RPCs
-- Multi-table writes are SECURITY DEFINER with explicit authorization checks.
-- Single-table writes rely on RLS (see 20261009000003_rls.sql).

-- ---------------------------------------------------------------------------
-- onboarding
-- ---------------------------------------------------------------------------
create or replace function public.create_profile(
  p_full_name text,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 80 then
    raise exception 'full name must be 1 to 80 characters';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  insert into public.profiles (id, full_name, avatar_url, email)
  values (v_uid, btrim(p_full_name), p_avatar_url,
          (select u.email from auth.users u where u.id = v_uid))
  returning * into v_profile;

  insert into public.notifications (profile_id, kind, severity, title, body)
  values (v_uid, 'welcome', 'info', 'Welcome to RecallRelay',
          'Your product passports and safety notices will appear here.');

  return v_profile;
end;
$$;

create or replace function public.create_manufacturer(
  p_name text,
  p_slug text
)
returns public.manufacturers
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_manufacturer public.manufacturers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'create your profile first';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'manufacturer name must be 1 to 80 characters';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug must be lowercase kebab-case';
  end if;
  if exists (select 1 from public.manufacturers where slug = p_slug) then
    raise exception 'slug already in use';
  end if;

  insert into public.manufacturers (name, slug, created_by)
  values (btrim(p_name), p_slug, v_uid)
  returning * into v_manufacturer;

  insert into public.manufacturer_members (manufacturer_id, profile_id, role)
  values (v_manufacturer.id, v_uid, 'owner');

  return v_manufacturer;
end;
$$;

-- single-table create: SECURITY INVOKER, RLS insert policy enforces staff role
create or replace function public.create_product_model(
  p_manufacturer_id uuid,
  p_sku text,
  p_name text,
  p_category text,
  p_image_path text default '/products/heatcore.svg'
)
returns public.product_models
language plpgsql
set search_path = public, extensions, auth
as $$
declare
  v_model public.product_models;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.product_models (manufacturer_id, sku, name, category, image_path)
  values (p_manufacturer_id, upper(btrim(p_sku)), btrim(p_name), btrim(p_category), p_image_path)
  returning * into v_model;
  return v_model;
end;
$$;

-- ---------------------------------------------------------------------------
-- registration / transfer / recall (multi-table)
-- ---------------------------------------------------------------------------
create or replace function public.register_product_unit(
  p_model_id uuid,
  p_serial_number text,
  p_initial_owner_wallet text default null,
  p_manufactured_at date default null
)
returns public.product_units
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_model public.product_models;
  v_role text;
  v_unit public.product_units;
  v_owner public.profiles;
  v_serial text := upper(btrim(p_serial_number));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_model from public.product_models where id = p_model_id;
  if v_model is null then
    raise exception 'unknown product model';
  end if;

  select public.manufacturer_member_role(v_model.manufacturer_id) into v_role;
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'only manufacturer owners or admins can register units';
  end if;

  if v_serial is null or char_length(v_serial) not between 4 and 48 then
    raise exception 'serial number must be 4 to 48 characters';
  end if;
  if exists (select 1 from public.product_units where serial_number = v_serial) then
    raise exception 'serial already registered';
  end if;

  if p_initial_owner_wallet is not null then
    select * into v_owner from public.profiles
    where lower(wallet_address) = lower(btrim(p_initial_owner_wallet));
    if v_owner is null then
      raise exception 'no RecallRelay profile for that wallet';
    end if;
  end if;

  insert into public.product_units (model_id, serial_number, manufactured_at, current_owner_profile_id)
  values (v_model.id, v_serial, p_manufactured_at, v_owner.id)
  returning * into v_unit;

  if v_owner.id is not null then
    insert into public.ownership_records (unit_id, from_profile_id, to_profile_id, initiated_by, note)
    values (v_unit.id, null, v_owner.id, v_uid, 'First owner');
  end if;

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (
    v_unit.id,
    v_model.manufacturer_id,
    v_uid,
    'registered',
    'Registered by ' || (select name from public.manufacturers where id = v_model.manufacturer_id),
    jsonb_build_object('serial', v_serial, 'sku', v_model.sku)
  );

  return v_unit;
end;
$$;

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

create or replace function public.issue_recall(
  p_manufacturer_id uuid,
  p_model_id uuid,
  p_title text,
  p_severity text,
  p_required_action text,
  p_scope_kind text default 'all_units',
  p_serial_from text default null,
  p_serial_to text default null,
  p_unit_ids uuid[] default null
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
  v_owner uuid;
  v_model public.product_models;
  v_unit_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select public.manufacturer_member_role(p_manufacturer_id) into v_role;
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'only manufacturer owners or admins can issue recalls';
  end if;

  if p_model_id is not null then
    select * into v_model from public.product_models where id = p_model_id;
    if v_model is null or v_model.manufacturer_id <> p_manufacturer_id then
      raise exception 'product model does not belong to this manufacturer';
    end if;
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'title must be 1 to 120 characters';
  end if;
  if p_required_action is null or char_length(btrim(p_required_action)) not between 1 and 300 then
    raise exception 'required action must be 1 to 300 characters';
  end if;
  if p_severity not in ('urgent', 'important', 'info') then
    raise exception 'invalid severity';
  end if;
  if p_scope_kind not in ('all_units', 'serial_range', 'selected_units') then
    raise exception 'invalid scope';
  end if;
  if p_scope_kind = 'selected_units' and (p_unit_ids is null or coalesce(array_length(p_unit_ids, 1), 0) = 0) then
    raise exception 'selected_units scope requires unit ids';
  end if;

  insert into public.recalls (
    manufacturer_id, model_id, title, severity, required_action,
    scope_kind, serial_from, serial_to, status, issued_at, created_by
  ) values (
    p_manufacturer_id,
    p_model_id,
    btrim(p_title),
    p_severity,
    btrim(p_required_action),
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
      if not exists (
        select 1 from public.product_units u
        where u.id = v_unit_id
          and (p_model_id is null or u.model_id = p_model_id)
      ) then
        raise exception 'unit % is not eligible for this recall', v_unit_id;
      end if;
      insert into public.recall_units (recall_id, unit_id) values (v_recall.id, v_unit_id);
    end loop;
  end if;

  v_affected := public.recall_affected_unit_count(v_recall.id);

  for v_owner in
    select recall_affected_owner_ids from public.recall_affected_owner_ids(v_recall.id)
  loop
    insert into public.notifications (profile_id, kind, severity, title, body, recall_id)
    values (
      v_owner,
      'recall',
      p_severity,
      btrim(p_title),
      'Required action: ' || btrim(p_required_action),
      v_recall.id
    );
    v_notified := v_notified + 1;
  end loop;

  insert into public.activity_events (unit_id, manufacturer_id, actor_profile_id, kind, summary, detail)
  values (
    null,
    p_manufacturer_id,
    v_uid,
    'recall_issued',
    'Recall issued: ' || btrim(p_title),
    jsonb_build_object('severity', p_severity, 'scope', p_scope_kind, 'affected', v_affected)
  );

  return jsonb_build_object(
    'id', v_recall.id,
    'status', v_recall.status,
    'affected_units', v_affected,
    'notified_owners', v_notified
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- lookups / diagnostics
-- ---------------------------------------------------------------------------
create or replace function public.find_profile_by_wallet(p_wallet text)
returns table (id uuid, full_name text, wallet_masked text, is_self boolean)
language sql
stable
security definer
set search_path = public, extensions, auth
as $$
  select p.id,
         p.full_name,
         public.mask_wallet(p.wallet_address),
         (p.id = auth.uid())
  from public.profiles p
  where lower(p.wallet_address) = lower(btrim(p_wallet))
    and auth.uid() is not null;
$$;

create or replace function public.recallrelay_health()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, auth
as $$
  select jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'manufacturers', (select count(*) from public.manufacturers),
    'models', (select count(*) from public.product_models),
    'units', (select count(*) from public.product_units),
    'active_recalls', (select count(*) from public.recalls where status = 'active'),
    'notifications', (select count(*) from public.notifications),
    'ok', true
  );
$$;

create or replace function public.recallrelay_auth_diagnostic()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, auth
as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'wallet', public.auth_wallet_address(auth.uid()),
    'has_profile', exists (select 1 from public.profiles where id = auth.uid()),
    'memberships', coalesce(
      (select jsonb_agg(jsonb_build_object('manufacturer_id', mm.manufacturer_id, 'role', mm.role))
       from public.manufacturer_members mm where mm.profile_id = auth.uid()),
      '[]'::jsonb
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- grants for functions created after the RLS migration + future-proof defaults
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from anon, public;

grant execute on function public.mask_wallet(text) to anon;
grant execute on function public.lookup_public_product(text) to anon;
grant execute on function public.recall_affected_unit_count(uuid) to anon;
grant execute on function public.active_recalls_for_unit(uuid) to anon;
-- policy helpers are invoked while evaluating anon-visible RLS policies;
-- they only report membership of auth.uid() (null for anon)
grant execute on function public.is_manufacturer_member(uuid) to anon;
grant execute on function public.manufacturer_member_role(uuid) to anon;
grant execute on function public.is_manufacturer_staff(uuid) to anon;
grant execute on all functions in schema public to authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, public;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon, authenticated;
