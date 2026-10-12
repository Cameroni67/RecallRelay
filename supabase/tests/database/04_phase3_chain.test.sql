-- RecallRelay Phase 3 — Solana ownership layer (pgTAP)
-- Covers chain-state columns, the two trusted reconciliation RPCs, and the
-- rule that chain-backed units can no longer transfer through the DB-only
-- path. Pattern matches 03_rpcs.test.sql: switch role only around the RPC
-- call, run assertions as postgres so RLS row filtering never masks results.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- Hosted test sessions connect as the CLI login role; establish the
-- postgres baseline the assertions assume (owner, RLS-suppressed baseline).
set role postgres;

select plan(34);

-- ---------------------------------------------------------------------------
-- 1-4: chain-state columns exist and default safely
-- ---------------------------------------------------------------------------
select is(
  (select chain_state from public.manufacturers where id = '44444444-4444-4444-4444-444444444444'),
  'unregistered', 'manufacturer chain_state defaults to unregistered');

select is(
  (select chain_state from public.product_units where id = '66666666-6666-6666-6666-666666666602'),
  'unregistered', 'product chain_state defaults to unregistered');

select is(
  (select chain_transfer_count from public.product_units where id = '66666666-6666-6666-6666-666666666602'),
  0, 'product chain_transfer_count defaults to 0');

select throws_ok(
  $$ update public.product_units
        set chain_state = 'bogus'
      where id = '66666666-6666-6666-6666-666666666603' $$,
  '23514', null, 'invalid chain_state is rejected by the check constraint');

-- ---------------------------------------------------------------------------
-- 5-9: reconcile_product_chain_state
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  $$ select public.reconcile_product_chain_state(
       '66666666-6666-6666-6666-666666666602',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP',
       'PdA111111111111111111111111111111111111111',
       '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
       0, 'synced', '5verKQ9bSCdAbQSkDvYPbaPLVwXGpXKrVLBnBRaGpM8VzX3qBxn6tHYJ3pCmZtQwqUvE9mTtTqYy1nJxKjR9Jp4') $$,
  'manufacturer staff can reconcile a synced product');

select throws_ok(
  $$ select public.reconcile_product_chain_state(
       '66666666-6666-6666-6666-666666666602',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP', 'PdA2', 'someowner', -1, 'synced') $$,
  null, 'transfer count cannot be negative', 'negative transfer count is rejected');

select throws_ok(
  $$ select public.reconcile_product_chain_state(
       '66666666-6666-6666-6666-666666666602',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP', 'PdA2', 'someowner', 0, 'bogus') $$,
  null, 'invalid chain state', 'invalid state value is rejected');

select throws_ok(
  $$ select public.reconcile_product_chain_state(
       '00000000-0000-0000-0000-000000000000',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP', 'PdA2', 'someowner', 0, 'synced') $$,
  null, 'unknown product unit', 'unknown unit is rejected');
set role postgres;

select is(
  (select chain_state from public.product_units where id = '66666666-6666-6666-6666-666666666602'),
  'synced', 'reconcile wrote chain_state = synced');

-- ---------------------------------------------------------------------------
-- 10-11: reconcile_manufacturer_chain_state
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  $$ select public.reconcile_manufacturer_chain_state(
       '44444444-4444-4444-4444-444444444444',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP',
       'MfrPda111111111111111111111111111111111111',
       'Authority11111111111111111111111111111111',
       'synced') $$,
  'manufacturer owner can reconcile manufacturer chain state');

select throws_ok(
  $$ select public.reconcile_manufacturer_chain_state(
       '00000000-0000-0000-0000-000000000000',
       'prog', 'pda', 'auth', 'synced') $$,
  null, 'only manufacturer owners or admins can reconcile manufacturer chain state',
  'unknown manufacturer has no member role so reconcile is refused');
set role postgres;

select is(
  (select chain_state from public.manufacturers where id = '44444444-4444-4444-4444-444444444444'),
  'synced', 'manufacturer reconciliation wrote chain_state = synced');

select is(
  (select count(*)::int from public.activity_events
    where manufacturer_id = '44444444-4444-4444-4444-444444444444'
      and kind = 'chain_reconciled'),
  2, 'reconciliation logged activity events for manufacturer and product');

-- ---------------------------------------------------------------------------
-- 12-14: chain-backed units can no longer use the DB-only transfer path
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select throws_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666602', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') $$,
  null, 'product is recorded on Solana; transfer on chain and reconcile the transaction',
  'chain-backed unit refuses the DB-only transfer');
set role postgres;

select is(
  (select current_owner_profile_id from public.product_units
    where id = '66666666-6666-6666-6666-666666666602'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'chain-backed unit owner is unchanged after the refused transfer');

-- A unit with no chain account still runs the Phase 2 validation path.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select throws_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666601', 'NoSuchWalletAddress') $$,
  null, 'no RecallRelay profile for that wallet',
  'unregistered unit still runs the Phase 2 validation first');
set role postgres;

-- ---------------------------------------------------------------------------
-- 15-18: authorization and the reconciliation ledger
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select public.reconcile_product_chain_state(
       '66666666-6666-6666-6666-666666666602', 'prog', 'pda', 'owner', 0, 'synced') $$,
  null, 'not authenticated', 'anonymous product reconcile is rejected');

select throws_ok(
  $$ select public.reconcile_manufacturer_chain_state(
       '44444444-4444-4444-4444-444444444444', 'prog', 'pda', 'auth', 'synced') $$,
  null, 'not authenticated', 'anonymous manufacturer reconcile is rejected');

select throws_ok(
  $$ select public.transfer_product_ownership(
       '66666666-6666-6666-6666-666666666601', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') $$,
  '42501', null, 'anonymous transfer is denied by revoked execute');
set role postgres;

select is(
  (select count(*)::int from public.activity_events where kind = 'chain_reconciled'),
  2, 'reconciliation ledger holds exactly the events written this test');

-- ---------------------------------------------------------------------------
-- 21-23: trusted chain columns are unreachable for clients; reconciliation
--        is restricted to manufacturer staff
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select throws_ok(
  $$ update public.product_units
        set chain_state = 'synced', chain_owner = 'Forged'
      where id = '66666666-6666-6666-6666-666666666602' $$,
  '42501', null, 'direct client mutation of product chain columns is denied');

select throws_ok(
  $$ update public.manufacturers
        set chain_state = 'synced', chain_authority = 'Forged'
      where id = '44444444-4444-4444-4444-444444444444' $$,
  '42501', null, 'direct client mutation of manufacturer chain columns is denied');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select throws_ok(
  $$ select public.reconcile_product_chain_state(
       '66666666-6666-6666-6666-666666666602',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP', 'PdA1', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 0, 'synced') $$,
  null, 'only manufacturer owners or admins can reconcile product chain state',
  'non-member reconciliation is blocked');
set role postgres;

-- ---------------------------------------------------------------------------
-- 24-26: repeated reconciliation is idempotent (no duplicate ledger events)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  $$ select public.reconcile_product_chain_state(
       '66666666-6666-6666-6666-666666666602',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP',
       'PdA111111111111111111111111111111111111111',
       '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
       0, 'synced', '5verKQ9bSCdAbQSkDvYPbaPLVwXGpXKrVLBnBRaGpM8VzX3qBxn6tHYJ3pCmZtQwqUvE9mTtTqYy1nJxKjR9Jp4') $$,
  'repeated product reconciliation succeeds');

select lives_ok(
  $$ select public.reconcile_manufacturer_chain_state(
       '44444444-4444-4444-4444-444444444444',
       'GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP',
       'MfrPda111111111111111111111111111111111111',
       'Authority11111111111111111111111111111111',
       'synced') $$,
  'repeated manufacturer reconciliation succeeds');
set role postgres;

select is(
  (select count(*)::int from public.activity_events where kind = 'chain_reconciled'),
  2, 'repeated reconciliation writes no duplicate activity events');

-- ---------------------------------------------------------------------------
-- 27-33: apply_chain_transfer records the transfer exactly once
-- ---------------------------------------------------------------------------
set local role authenticated;
-- A random authenticated profile (not the owner, not staff) cannot hijack it.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select throws_ok(
  $$ select public.apply_chain_transfer(
       '66666666-6666-6666-6666-666666666602',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
       1, '5verKQ9bSCdAbQSkDvYPbaPLVwXGpXKrVLBnBRaGpM8VzX3qBxn6tHYJ3pCmZtQwqUvE9mTtTqYy1nJxKjR9Jp5') $$,
  null, 'only the current owner or manufacturer staff can reconcile a transfer',
  'unauthorized transfer reconciliation is blocked');

-- The current owner (Alice) records the observed chain transfer.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  $$ select public.apply_chain_transfer(
       '66666666-6666-6666-6666-666666666602',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
       1, '5verKQ9bSCdAbQSkDvYPbaPLVwXGpXKrVLBnBRaGpM8VzX3qBxn6tHYJ3pCmZtQwqUvE9mTtTqYy1nJxKjR9Jp5') $$,
  'current owner reconciles the observed chain transfer');

-- Even an authorized caller cannot apply the same transfer count twice.
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select throws_ok(
  $$ select public.apply_chain_transfer(
       '66666666-6666-6666-6666-666666666602',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
       '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
       1, '5verKQ9bSCdAbQSkDvYPbaPLVwXGpXKrVLBnBRaGpM8VzX3qBxn6tHYJ3pCmZtQwqUvE9mTtTqYy1nJxKjR9Jp5') $$,
  null, 'transfer already reconciled', 'repeated transfer reconciliation is rejected');
set role postgres;

select is(
  (select current_owner_profile_id from public.product_units
    where id = '66666666-6666-6666-6666-666666666602'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'chain transfer moves the unit to the recipient');

select is(
  (select count(*)::int from public.ownership_records
    where unit_id = '66666666-6666-6666-6666-666666666602'),
  2, 'transfer produces exactly one new ownership record (1 seed + 1 chain)');

select is(
  (select count(*)::int from public.notifications
    where profile_id = '22222222-2222-2222-2222-222222222222'
      and unit_id = '66666666-6666-6666-6666-666666666602'
      and kind = 'transfer'),
  1, 'recipient notification is written exactly once');

select is(
  (select count(*)::int from public.activity_events
    where unit_id = '66666666-6666-6666-6666-666666666602'
      and kind = 'transferred'),
  1, 'transfer activity event is written exactly once');

-- ---------------------------------------------------------------------------
-- 34: public verification exposes no owner identity
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'lookup_public_product'
      and coalesce(p.proargnames::text[], '{}')
          && array['current_owner_profile_id','owner_profile_id','full_name','email']),
  0, 'public verification output contains no owner identity columns');

select * from finish();

rollback;
