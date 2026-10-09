-- RecallRelay Phase 2 — RPC authorization and behavior (pgTAP)
-- Pattern: switch role only around the RPC call itself, run assertions as
-- postgres so RLS row filtering never masks the result being checked.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- Hosted test sessions connect as the CLI login role; establish the
-- postgres baseline the assertions assume (owner, RLS-suppressed baseline).
set role postgres;

select plan(37);

-- fixture: a fourth SIWS user with no profile yet (rolled back at the end)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        is_sso_user, is_anonymous)
values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444440007',
        'authenticated', 'authenticated', null, '',
        '{"provider":"web3","providers":[]}',
        '{"address":"DdxdFreshtESTWalletAddress1112223334445556667","chain":"solana"}',
        now(), now(), false, false);

insert into auth.identities (provider_id, user_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
values ('DdxdFreshtESTWalletAddress1112223334445556667', '44444444-4444-4444-4444-444444440007',
        '{"address":"DdxdFreshtESTWalletAddress1112223334445556667","chain":"solana"}',
        'web3', now(), now(), now());

-- ---------------------------------------------------------------------------
-- create_profile (fixture user)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444440007"}', true);
select lives_ok($$ select public.create_profile('Test User') $$,
  'a fresh SIWS user can create a profile');
select throws_ok($$ select public.create_profile('Again') $$,
  null, 'profile already exists', 'duplicate create_profile is rejected');
set role postgres;

select is(
  (select full_name from public.profiles where id = '44444444-4444-4444-4444-444444440007'),
  'Test User', 'profile row was created');
select is(
  (select wallet_address from public.profiles where id = '44444444-4444-4444-4444-444444440007'),
  'DdxdFreshtESTWalletAddress1112223334445556667',
  'profile wallet was bound from the web3 identity');
select is(
  (select count(*)::int from public.notifications
   where profile_id = '44444444-4444-4444-4444-444444440007' and kind = 'welcome'),
  1, 'profile creation sends a welcome notification');

-- ---------------------------------------------------------------------------
-- create_manufacturer (bob)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select lives_ok($$ select public.create_manufacturer('Bobs Gadgets', 'bobs-gadgets') $$,
  'a profile can create a manufacturer workspace');
select throws_ok($$ select public.create_manufacturer('Dup Co', 'bobs-gadgets') $$,
  null, 'slug already in use', 'duplicate slug is rejected');
select throws_ok($$ select public.create_manufacturer('Bad Slug', 'Not A Slug') $$,
  null, 'slug must be lowercase kebab-case', 'invalid slug is rejected');
set role postgres;

select is(
  (select count(*)::int from public.manufacturers where slug = 'bobs-gadgets'),
  1, 'manufacturer row exists');
select is(
  (select mm.role from public.manufacturer_members mm
   join public.manufacturers m on m.id = mm.manufacturer_id
   where m.slug = 'bobs-gadgets' and mm.profile_id = '22222222-2222-2222-2222-222222222222'),
  'owner', 'creator becomes the workspace owner');

-- ---------------------------------------------------------------------------
-- create_product_model (RLS invoker, ops)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  $$ select public.create_product_model('44444444-4444-4444-4444-444444444444',
                                        'TRX', 'TrailRadio X', 'Outdoor electronics') $$,
  'staff can create a product model');
set role postgres;

select is(
  (select count(*)::int from public.product_models where sku = 'TRX'),
  1, 'created model row exists');

-- ---------------------------------------------------------------------------
-- register_product_unit
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select throws_ok(
  $$ select public.register_product_unit('55555555-5555-5555-5555-555555555501', 'HC10-X001') $$,
  null, 'only manufacturer owners or admins can register units',
  'non-staff cannot register units');
set role postgres;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  $$ select public.register_product_unit(
       '55555555-5555-5555-5555-555555555502', 'TCM-TEST1',
       '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', date '2026-10-01') $$,
  'staff can register a unit with an initial owner wallet');
select throws_ok(
  $$ select public.register_product_unit('55555555-5555-5555-5555-555555555502', 'TCM-TEST1') $$,
  null, 'serial already registered', 'duplicate serial is rejected');
select throws_ok(
  $$ select public.register_product_unit('55555555-5555-5555-5555-555555555502', 'TCM-X002',
       'NoSuchWalletAddress') $$,
  null, 'no RecallRelay profile for that wallet', 'unknown owner wallet is rejected');
set role postgres;

select is(
  (select count(*)::int from public.product_units where serial_number = 'TCM-TEST1'),
  1, 'registered unit row exists');
select is(
  (select count(*)::int from public.ownership_records o
   join public.product_units u on u.id = o.unit_id
   where u.serial_number = 'TCM-TEST1' and o.to_profile_id is not null and o.note = 'First owner'),
  1, 'registration records the first ownership handoff');
select is(
  (select count(*)::int from public.activity_events e
   join public.product_units u on u.id = e.unit_id
   where u.serial_number = 'TCM-TEST1' and e.kind = 'registered'),
  1, 'registration appends an activity event');

-- ---------------------------------------------------------------------------
-- transfer_product_ownership (bob owns HC10-2048)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select throws_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666602', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU') $$,
  null, 'only the current owner can transfer this product',
  'non-owner cannot transfer a unit');
select throws_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666601', 'NoSuchWalletAddress') $$,
  null, 'no RecallRelay profile for that wallet', 'unknown recipient wallet is rejected');
select throws_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666601',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU') $$,
  null, 'cannot transfer to yourself', 'self transfer is rejected');
select lives_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666601',
       '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'smoke transfer') $$,
  'current owner can transfer');
set role postgres;

select is(
  (select current_owner_profile_id from public.product_units
   where id = '66666666-6666-6666-6666-666666666601'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'unit ownership moved to alice');
select is(
  (select count(*)::int from public.ownership_records
   where unit_id = '66666666-6666-6666-6666-666666666601'),
  3, 'transfer appended an ownership record');
select is(
  (select count(*)::int from public.notifications
   where profile_id = '11111111-1111-1111-1111-111111111111' and kind = 'transfer'
     and unit_id = '66666666-6666-6666-6666-666666666601'),
  1, 'recipient received a transfer notification');

-- ---------------------------------------------------------------------------
-- issue_recall
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Sneaky', 'urgent', 'Stop', 'all_units') $$,
  null, 'only manufacturer owners or admins can issue recalls',
  'non-staff cannot issue recalls');
set role postgres;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (public.issue_recall('44444444-4444-4444-4444-444444444444',
     '55555555-5555-5555-5555-555555555501', 'Second battery notice', 'urgent',
     'Stop using immediately', 'all_units') ->> 'affected_units')::int,
  2, 'all_units recall affects both HC10 units');
select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Scope test', 'urgent', 'Stop',
       'selected_units', null, null, array['66666666-6666-6666-6666-666666666603']::uuid[]) $$,
  null, 'unit 66666666-6666-6666-6666-666666666603 is not eligible for this recall',
  'selected_units rejects units outside the model');
select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Bad severity', 'catastrophic', 'Stop', 'all_units') $$,
  null, 'invalid severity', 'invalid severity is rejected');
set role postgres;

select is(
  (select count(*)::int from public.notifications
   where kind = 'recall' and recall_id is not null
     and profile_id = '11111111-1111-1111-1111-111111111111'),
  1, 'alice (owner of an affected HC10 unit) is notified by the new recall');

-- ---------------------------------------------------------------------------
-- lookups + diagnostics
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select is(
  (select full_name from public.find_profile_by_wallet('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')),
  'Alice Morgan', 'find_profile_by_wallet resolves a recipient');
select is(
  (select is_self from public.find_profile_by_wallet('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')),
  true, 'find_profile_by_wallet flags the caller wallet');
select is(
  (select (public.recallrelay_auth_diagnostic() ->> 'has_profile')::boolean),
  true, 'auth diagnostic reports an existing profile');
select is(
  public.recallrelay_auth_diagnostic() ->> 'wallet',
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  'auth diagnostic reports the bound wallet');
select is(
  (select (public.recallrelay_health() ->> 'ok')::boolean),
  true, 'health rpc responds');
set role postgres;

select ok(
  not has_function_privilege('anon', 'public.find_profile_by_wallet(text)', 'execute'),
  'anon cannot look up profiles by wallet');

select * from finish();

rollback;
