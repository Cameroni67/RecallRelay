-- RecallRelay Phase 2 — row level security assertions (pgTAP)
begin;

select plan(38);

-- ---------------------------------------------------------------------------
-- anon: table-level grants
-- ---------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.product_units', 'select'),
  'anon cannot select product_units');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon cannot select profiles');
select ok(not has_table_privilege('anon', 'public.notifications', 'select'),
  'anon cannot select notifications');
select ok(not has_table_privilege('anon', 'public.ownership_records', 'select'),
  'anon cannot select ownership_records');
select ok(has_table_privilege('anon', 'public.recalls', 'select'),
  'anon can select recalls (policy filters rows)');
select ok(not has_function_privilege('anon', 'public.create_profile(text, text)', 'execute'),
  'anon cannot execute create_profile');
select ok(not has_function_privilege('anon', 'public.transfer_product_ownership(uuid, text, text)', 'execute'),
  'anon cannot execute transfer_product_ownership');

-- anon row visibility: active recall only
set local role anon;
create temporary table t_a1 as
  select count(*)::int as n from public.recalls;
create temporary table t_a2 as
  select count(*)::int as n from public.v_public_product_verification;
reset role;
select is((select n from t_a1), 1, 'anon sees only the active recall');
select is((select n from t_a2), 3, 'anon can read the public verification view');

-- ---------------------------------------------------------------------------
-- bob (authenticated, no manufacturer membership)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

select is((select count(*)::int from public.product_units), 3, 'bob sees all 3 units');
select is((select count(*)::int from public.notifications), 2, 'bob sees his 2 notifications');
select is((select count(*)::int from public.profiles), 1, 'bob sees only his own profile');
select is((select count(*)::int from public.ownership_records), 3, 'bob sees his 3 ownership records');
select is((select count(*)::int from public.activity_events), 3, 'bob sees activity for his units');
select is((select count(*)::int from public.recalls), 1, 'bob sees the active recall');
select is(
  (select count(*)::int
   from public.notifications
   where profile_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'bob cannot see alice notifications'
);

select ok(not has_table_privilege('authenticated', 'public.product_units', 'update'),
  'authenticated has no UPDATE on product_units (ownership via RPC only)');
select ok(not has_table_privilege('authenticated', 'public.product_units', 'insert'),
  'authenticated has no INSERT on product_units');
select ok(not has_table_privilege('authenticated', 'public.product_units', 'delete'),
  'authenticated has no DELETE on product_units');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'insert'),
  'authenticated has no INSERT on notifications');
select ok(not has_table_privilege('authenticated', 'public.ownership_records', 'insert'),
  'authenticated has no INSERT on ownership_records');
select ok(not has_table_privilege('authenticated', 'public.activity_events', 'insert'),
  'authenticated has no INSERT on activity_events');

select ok(has_column_privilege('authenticated', 'public.profiles', 'full_name', 'update'),
  'profile full_name is updatable by its owner');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'profile email is not client-updatable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'wallet_address', 'update'),
  'profile wallet is not client-updatable');
select ok(has_column_privilege('authenticated', 'public.notifications', 'read_at', 'update'),
  'notification read_at is updatable');
select ok(not has_column_privilege('authenticated', 'public.notifications', 'title', 'update'),
  'notification title is not updatable');

select ok(not public.is_manufacturer_member('44444444-4444-4444-4444-444444444444'),
  'bob is not a northstar member');
select is(public.manufacturer_member_role('44444444-4444-4444-4444-444444444444'), null,
  'bob has no manufacturer role');

reset role;

-- ---------------------------------------------------------------------------
-- alice (authenticated, out-of-scope owner)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select is((select count(*)::int from public.notifications), 1, 'alice sees her welcome notification');
select is(
  (select count(*)::int from public.notifications where kind = 'recall'),
  0, 'alice sees no recall notifications'
);
select is((select count(*)::int from public.activity_events), 1, 'alice sees activity for her unit only');
reset role;

-- ---------------------------------------------------------------------------
-- ops (manufacturer owner)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(public.manufacturer_member_role('44444444-4444-4444-4444-444444444444'), 'owner',
  'ops has the owner role');
select ok(public.is_manufacturer_staff('44444444-4444-4444-4444-444444444444'),
  'ops counts as manufacturer staff');
select is((select count(*)::int from public.manufacturer_members), 1,
  'ops sees his membership row');

-- RLS insert policy allows staff model creation
select lives_ok(
  $$ insert into public.product_models (manufacturer_id, sku, name, category)
     values ('44444444-4444-4444-4444-444444444444', 'ZZ1', 'Zonk One', 'Test fixtures') $$,
  'ops can insert a product model under RLS'
);
reset role;

-- ---------------------------------------------------------------------------
-- bob tries staff-only writes
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select throws_ok(
  $$ insert into public.product_models (manufacturer_id, sku, name, category)
     values ('44444444-4444-4444-4444-444444444444', 'ZZ2', 'Zonk Two', 'Test fixtures') $$,
  '42501', null, 'non-member model insert is rejected by RLS'
);
select throws_ok(
  $$ update public.product_units
        set current_owner_profile_id = '11111111-1111-1111-1111-111111111111'
        where id = '66666666-6666-6666-6666-666666666602' $$,
  '42501', null, 'direct ownership update is rejected (no table privilege)'
);
reset role;

select * from finish();

rollback;
