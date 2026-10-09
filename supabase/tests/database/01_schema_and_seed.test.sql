-- RecallRelay Phase 2 — schema, RLS wiring, and seed assertions (pgTAP)
begin;

create extension if not exists pgtap with schema extensions;

-- pgTAP lives in `extensions`; make resolution explicit so the suite also
-- passes against hosted projects whose test connection search_path differs.
set local search_path = public, extensions;

-- Hosted test sessions connect as the CLI login role; establish the
-- postgres baseline the assertions assume (owner, RLS-suppressed baseline).
set role postgres;

select plan(39);

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'manufacturers', 'manufacturers table exists');
select has_table('public', 'manufacturer_members', 'manufacturer_members table exists');
select has_table('public', 'product_models', 'product_models table exists');
select has_table('public', 'product_units', 'product_units table exists');
select has_table('public', 'ownership_records', 'ownership_records table exists');
select has_table('public', 'recalls', 'recalls table exists');
select has_table('public', 'recall_units', 'recall_units table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'activity_events', 'activity_events table exists');

-- ---------------------------------------------------------------------------
-- RLS enabled everywhere
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables
   where schemaname = 'public'
     and tablename in ('profiles','manufacturers','manufacturer_members','product_models',
                       'product_units','ownership_records','recalls','recall_units',
                       'notifications','activity_events')
     and rowsecurity),
  10,
  'all ten tables have RLS enabled'
);

-- ---------------------------------------------------------------------------
-- views do not leak owner identity
-- ---------------------------------------------------------------------------
select has_view('public', 'v_public_product_verification', 'public verification view exists');
select has_view('public', 'v_shared_profiles', 'shared profiles view exists');

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'v_public_product_verification'
     and column_name in ('current_owner_profile_id','wallet_address','email','full_name','owner')),
  0,
  'public view exposes no owner/wallet/email columns'
);

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'v_shared_profiles'),
  4,
  'shared profiles view has exactly 4 columns'
);

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'v_shared_profiles'
     and column_name in ('email','wallet_address','notification_prefs')),
  0,
  'shared profiles view exposes no email/wallet/preferences'
);

-- ---------------------------------------------------------------------------
-- seed data
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles), 3, 'seed has 3 profiles');
select is((select count(*)::int from public.manufacturers), 1, 'seed has 1 manufacturer');
select is(
  (select count(*)::int from public.manufacturer_members where role = 'owner'),
  1, 'seed has exactly 1 manufacturer owner'
);
select is((select count(*)::int from public.product_models), 3, 'seed has 3 models');
select is((select count(*)::int from public.product_units), 3, 'seed has 3 units');
select is(
  (select count(*)::int from public.recalls where status = 'active'),
  1, 'seed has 1 active recall'
);

-- wallets bound from auth identities, original base58 casing preserved
select is(
  (select wallet_address from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'alice wallet bound from her web3 identity with original casing'
);

select is(
  public.mask_wallet('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'),
  '9WzD…AWWM',
  'mask_wallet keeps 4+4 characters'
);

-- ---------------------------------------------------------------------------
-- recall scope + notification targeting
-- ---------------------------------------------------------------------------
select is(
  public.recall_affected_unit_count('77777777-7777-7777-7777-777777777701'),
  1,
  'seeded recall affects exactly 1 unit (selected_units scope)'
);

select is(
  (select count(*)::int from public.recall_affected_owner_ids('77777777-7777-7777-7777-777777777701')),
  1,
  'seeded recall targets exactly 1 owner'
);

select is(
  (select count(*)::int from public.notifications
   where kind = 'recall' and profile_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'bob (owner of affected unit) has the recall notification'
);

-- critical: alice owns HC10-2051 which is out of scope
select is(
  (select count(*)::int from public.notifications
   where kind = 'recall' and profile_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'alice (out-of-scope owner) has ZERO recall notifications'
);

select is(
  (select count(*)::int
   from public.product_units u
   where exists (select 1 from public.active_recalls_for_unit(u.id) r
                 where r.id = '77777777-7777-7777-7777-777777777701')
     and u.serial_number = 'HC10-2051'),
  0,
  'HC10-2051 is not in the recall scope'
);

-- ---------------------------------------------------------------------------
-- public lookup (serial + uuid), and draft recalls stay hidden
-- ---------------------------------------------------------------------------
select is(
  (select is_recalled from public.lookup_public_product('HC10-2048')),
  true,
  'lookup by serial finds the recalled unit'
);

select is(
  (select is_recalled from public.lookup_public_product('66666666-6666-6666-6666-666666666601')),
  true,
  'lookup by unit uuid works'
);

select is(
  (select count(*)::int from public.lookup_public_product('NOPE-0000')),
  0,
  'lookup for unknown identifier returns no rows'
);

insert into public.recalls (id, manufacturer_id, model_id, title, severity,
                            required_action, scope_kind, status, issued_at, created_by)
values ('77777777-7777-7777-7777-777777777709',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555502',
        'Draft notice', 'info', 'Ignore for now', 'all_units', 'draft', null, null);

select is(
  (select is_recalled from public.lookup_public_product('TCM-8831')),
  false,
  'draft recall is hidden from public lookup'
);

select is(
  (select count(*)::int from public.recalls),
  2,
  'staff can see the draft recall while it exists'
);

-- anon sees only active recalls
set local role anon;
create temporary table t_anon_recalls as
  select count(*)::int as n from public.recalls;
set role postgres;

select is(
  (select n from t_anon_recalls),
  1,
  'anon sees only the active recall (draft filtered by RLS)'
);

-- ---------------------------------------------------------------------------
-- wallet identity shape compatibility (seeded vs real Solana SIWS)
-- ---------------------------------------------------------------------------
select is(
  public.identity_wallet_address('{"address":"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"}'::jsonb, null),
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'top-level address shape (seed fixtures)'
);

select is(
  public.identity_wallet_address('{"custom_claims":{"address":"6viLnTjmzqYDW4RBkNHctmyN5Xpp4hc6ZvSkz2JX4FMg"}}'::jsonb, null),
  '6viLnTjmzqYDW4RBkNHctmyN5Xpp4hc6ZvSkz2JX4FMg',
  'custom_claims address shape (real SIWS)'
);

select is(
  public.identity_wallet_address('{"sub":"web3:solana:EJxT3tQkfAuSnRm2xgUapi7UqSUyAHPe7BF6NgW3YoMG"}'::jsonb, 'web3:solana:EJxT3tQkfAuSnRm2xgUapi7UqSUyAHPe7BF6NgW3YoMG'),
  'EJxT3tQkfAuSnRm2xgUapi7UqSUyAHPe7BF6NgW3YoMG',
  'provider_id web3:solana form (real SIWS)'
);

select is(
  public.identity_wallet_address(null::jsonb, null),
  null,
  'null identity data resolves to null wallet'
);

select * from finish();

rollback;
