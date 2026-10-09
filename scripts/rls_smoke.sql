-- Manual RLS smoke checks (each scenario in its own transaction; expected
-- failures wrapped in savepoints so the transaction stays usable).

\echo '=== ANON ==='
begin;
set local role anon;
do $$ begin
  perform count(*) from public.product_units;
  raise notice 'anon select product_units SUCCEEDED (BAD)';
exception when others then
  raise notice 'anon select product_units blocked: %', sqlerrm;
end $$;
do $$ begin
  perform count(*) from public.profiles;
  raise notice 'anon select profiles SUCCEEDED (BAD)';
exception when others then
  raise notice 'anon select profiles blocked: %', sqlerrm;
end $$;
do $$ begin
  perform count(*) from public.notifications;
  raise notice 'anon select notifications SUCCEEDED (BAD)';
exception when others then
  raise notice 'anon select notifications blocked: %', sqlerrm;
end $$;
select count(*) as anon_recalls from public.recalls;
select count(*) as anon_public_view from public.v_public_product_verification;
select public.lookup_public_product('HC10-2048') is not null as anon_lookup_ok;
do $$ begin
  perform public.create_profile('Hacker');
  raise notice 'anon create_profile SUCCEEDED (BAD)';
exception when others then
  raise notice 'anon create_profile blocked: %', sqlerrm;
end $$;
rollback;

\echo '=== BOB (authenticated) ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select count(*) as bob_units from public.product_units;
select count(*) as bob_notifications from public.notifications;
select count(*) as bob_profiles_visible from public.profiles;
select count(*) as bob_ownership from public.ownership_records;
select count(*) as bob_activity from public.activity_events;
select count(*) as bob_recalls from public.recalls;
select count(*) as bob_recall_owners from public.recall_affected_owner_ids('77777777-7777-7777-7777-777777777701');
do $$ begin
  update public.product_units set current_owner_profile_id = '11111111-1111-1111-1111-111111111111';
  raise notice 'bob direct ownership update SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob direct ownership update blocked: %', sqlerrm;
end $$;
do $$ begin
  update public.profiles set email = 'evil@example.com' where id = auth.uid();
  raise notice 'bob email update SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob email update blocked: %', sqlerrm;
end $$;
do $$ begin
  update public.profiles set full_name = 'Bob C.' where id = auth.uid();
  raise notice 'bob name update allowed (expected)';
exception when others then
  raise notice 'bob name update blocked: %', sqlerrm;
end $$;
do $$ begin
  insert into public.notifications (profile_id, title) values (auth.uid(), 'forged');
  raise notice 'bob notification insert SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob notification insert blocked: %', sqlerrm;
end $$;
do $$ begin
  update public.notifications set title = 'hacked' where profile_id = auth.uid();
  raise notice 'bob notification title update SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob notification title update blocked: %', sqlerrm;
end $$;
do $$ begin
  update public.notifications set read_at = now() where profile_id = auth.uid();
  raise notice 'bob notification read_at update allowed (expected)';
exception when others then
  raise notice 'bob notification read_at update blocked: %', sqlerrm;
end $$;
select public.find_profile_by_wallet('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') as bob_lookup;
do $$ begin
  perform public.create_profile('Bob Chen');
  raise notice 'create_profile duplicate SUCCEEDED (BAD)';
exception when others then
  raise notice 'create_profile duplicate blocked: %', sqlerrm;
end $$;
rollback;

\echo '=== ALICE (authenticated) ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select count(*) as alice_notifications from public.notifications;
select count(*) as alice_recall_notifications from public.notifications where kind = 'recall';
select count(*) as alice_units from public.product_units;
select count(*) as alice_activity from public.activity_events;
rollback;

\echo '=== OPS (manufacturer owner) ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select public.manufacturer_member_role('44444444-4444-4444-4444-444444444444') as ops_role;
select count(*) as ops_models from public.product_models;
select count(*) as ops_memberships from public.manufacturer_members;
do $$ begin
  perform public.create_product_model('44444444-4444-4444-4444-444444444444', 'TR4', 'TrailRadio 4', 'Outdoor electronics');
  raise notice 'ops create_product_model allowed (expected)';
exception when others then
  raise notice 'ops create_product_model blocked: %', sqlerrm;
end $$;
rollback;

\echo '=== BOB tries staff-only RPCs ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
do $$ begin
  perform public.register_product_unit('55555555-5555-5555-5555-555555555501', 'HC10-9999');
  raise notice 'bob register_product_unit SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob register_product_unit blocked: %', sqlerrm;
end $$;
do $$ begin
  perform public.issue_recall('44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555501', 'Sneaky recall', 'urgent', 'Do not use',
    'all_units', null, null, null);
  raise notice 'bob issue_recall SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob issue_recall blocked: %', sqlerrm;
end $$;
do $$ begin
  perform public.transfer_product_ownership('66666666-6666-6666-6666-666666666602',
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  raise notice 'bob transfer non-owned unit SUCCEEDED (BAD)';
exception when others then
  raise notice 'bob transfer non-owned unit blocked: %', sqlerrm;
end $$;
rollback;

\echo '=== BOB transfer (valid, rolled back) ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select public.transfer_product_ownership(
  '66666666-6666-6666-6666-666666666601',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'smoke test'
) is not null as transfer_ok;
select current_owner_profile_id from public.product_units where id = '66666666-6666-6666-6666-666666666601';
rollback;
