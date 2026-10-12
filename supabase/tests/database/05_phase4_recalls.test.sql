-- RecallRelay Phase 4/5 — recall system, current-owner targeting, resolution,
-- notification idempotency and public privacy (pgTAP)
--
-- Results of RPC calls are parked in transaction-local GUCs (rr.*) so the
-- assertions can run under whichever role proves the behaviour (anon,
-- authenticated identities, postgres) without temp-table privilege traps.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
set role postgres;

select plan(39);

-- ---------------------------------------------------------------------------
-- setup: a rival manufacturer with its own model + unit (cross-manufacturer
-- targets). Everything rolls back with the file.
-- ---------------------------------------------------------------------------
insert into public.manufacturers (id, slug, name)
values ('44444444-4444-4444-4444-444444444442', 'rival-gear', 'Rival Gear');

insert into public.product_models (id, manufacturer_id, sku, name, category)
values ('55555555-5555-5555-5555-555555555512',
        '44444444-4444-4444-4444-444444444442',
        'RG1', 'RivalGen 1', 'Portable power');

-- Alice also owns a rival unit, so "alice gets no notice for recall X" can
-- only be about scope/previous-owner targeting, never about her owning
-- nothing at all.
insert into public.product_units (id, model_id, serial_number, current_owner_profile_id)
values ('66666666-6666-6666-6666-666666666612',
        '55555555-5555-5555-5555-555555555512',
        'RG1-0001', '11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- authorized creation, description, current-owner notification targeting
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);

select set_config('rr.x', public.issue_recall(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555501',
  'Charging port inspection', 'advisory', 'Inspect the port before use',
  'selected_units', null, null, array['66666666-6666-6666-6666-666666666601']::uuid[],
  'A small batch may have loose charging ports.')::text, true);

select is(
  (current_setting('rr.x')::jsonb ->> 'affected_units')::int,
  1,
  'authorized staff issues an advisory recall (selected_units scope)');

select is(
  (select description from public.recalls
   where id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  'A small batch may have loose charging ports.',
  'recall description is stored');

set role postgres;

select is(
  (select count(*)::int from public.notifications
   where profile_id = '22222222-2222-2222-2222-222222222222'
     and kind = 'recall'
     and recall_id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  1,
  'current owner (bob, owns affected HC10-2048) is notified');

select is(
  (select count(*)::int from public.notifications
   where profile_id = '11111111-1111-1111-1111-111111111111'
     and kind = 'recall'),
  0,
  'previous owner alice gets ZERO recall notifications (never notified as a current owner)');

-- scopes ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);

select set_config('rr.y', public.issue_recall(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555501',
  'Firmware heat limits', 'important', 'Update firmware at next charge',
  'all_units')::text, true);

select is(
  (current_setting('rr.y')::jsonb ->> 'affected_units')::int,
  2,
  'all_units scope affects both registered HC10 units');

select set_config('rr.w', public.issue_recall(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555501',
  'Label correction', 'advisory', 'Check the rating label',
  'serial_range', 'HC10-2040', 'HC10-2050')::text, true);

select is(
  (current_setting('rr.w')::jsonb ->> 'affected_units')::int,
  1,
  'serial_range scope affects exactly the in-range unit');

-- validation ------------------------------------------------------------------
select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Bad severity', 'high', 'Stop', 'all_units') $$,
  null, 'invalid severity',
  'legacy severity vocabulary (high) is rejected');

select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       null, 'No model', 'urgent', 'Stop', 'all_units') $$,
  null, 'product model is required',
  'recall without a product model is rejected');

select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Reversed range', 'urgent', 'Stop',
       'serial_range', 'HC10-2100', 'HC10-2000') $$,
  null, 'serial range is invalid',
  'reversed serial range is rejected');

select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555512', 'Foreign model', 'urgent', 'Stop', 'all_units') $$,
  null, 'product model does not belong to this manufacturer',
  'cross-manufacturer model is rejected');

select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Foreign unit', 'urgent', 'Stop',
       'selected_units', null, null, array['66666666-6666-6666-6666-666666666612']::uuid[]) $$,
  null, 'unit 66666666-6666-6666-6666-666666666612 is not eligible for this recall',
  'cross-manufacturer unit is rejected');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select throws_ok(
  $$ select public.issue_recall('44444444-4444-4444-4444-444444444444',
       '55555555-5555-5555-5555-555555555501', 'Sneaky', 'urgent', 'Stop', 'all_units') $$,
  null, 'only manufacturer owners or admins can issue recalls',
  'unauthorized (non-staff) recall creation is blocked');

set role postgres;

-- ---------------------------------------------------------------------------
-- cross-manufacturer scope guard: even a tampered recall_units row cannot
-- pull a rival's unit into a recall's scope
-- ---------------------------------------------------------------------------
insert into public.recalls (id, manufacturer_id, model_id, title, severity,
                            required_action, scope_kind, status, issued_at, created_by)
values ('77777777-7777-7777-7777-777777777707',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555501',
        'Tampered scope', 'urgent', 'Stop', 'selected_units', 'active', now(),
        '33333333-3333-3333-3333-333333333333');
insert into public.recall_units (recall_id, unit_id)
values ('77777777-7777-7777-7777-777777777707', '66666666-6666-6666-6666-666666666612');

select is(
  (select count(*)::int
     from public.active_recalls_for_unit('66666666-6666-6666-6666-666666666612')
    where id = '77777777-7777-7777-7777-777777777707'),
  0,
  'cross-manufacturer scope cannot reach a rival unit');

-- ---------------------------------------------------------------------------
-- draft recall stays private, active recall is public
-- ---------------------------------------------------------------------------
insert into public.recalls (id, manufacturer_id, model_id, title, severity,
                            required_action, scope_kind, status, issued_at, created_by)
values ('77777777-7777-7777-7777-777777777711',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555502',
        'Draft charging note', 'advisory', 'Hold publication', 'all_units', 'draft',
        null, '33333333-3333-3333-3333-333333333333');

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select is_recalled from public.lookup_public_product('TCM-8831')),
  false,
  'draft recall is not public (lookup shows no recall)');

select is(
  public.recall_affected_unit_count('77777777-7777-7777-7777-777777777711'),
  0,
  'draft recall reports 0 affected units to the public');

select is(
  (select count(*)::int from public.recalls
   where id = '77777777-7777-7777-7777-777777777711'),
  0,
  'anon cannot see the draft recall row');

select is(
  (select count(*)::int from public.recalls
   where id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  1,
  'anon sees the active recall');

select is(
  (select is_recalled from public.lookup_public_product('HC10-2048')),
  true,
  'active recall is public on the product lookup');

set role postgres;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);

select is(
  public.recall_affected_unit_count('77777777-7777-7777-7777-777777777711'),
  1,
  'staff sees the draft recall affected-unit count');

-- ---------------------------------------------------------------------------
-- resolution: explicit status transition, current-owner resolution notices,
-- idempotent re-processing, resolved visibility
-- ---------------------------------------------------------------------------
select set_config('rr.close_y',
  public.close_recall((current_setting('rr.y')::jsonb ->> 'id')::uuid)::text, true);

select is(current_setting('rr.close_y')::jsonb ->> 'status', 'closed',
  'authorized staff resolves a recall');

select is((current_setting('rr.close_y')::jsonb ->> 'notified_owners')::int, 2,
  'resolution notifies exactly the two current owners (bob + alice)');

select set_config('rr.close_y2',
  public.close_recall((current_setting('rr.y')::jsonb ->> 'id')::uuid)::text, true);

select is((current_setting('rr.close_y2')::jsonb ->> 'already_closed')::boolean, true,
  'closing an already-closed recall is a no-op');

select is((current_setting('rr.close_y2')::jsonb ->> 'notified_owners')::int, 0,
  'repeat close notifies nobody (idempotent)');

select set_config('rr.close_x',
  public.close_recall((current_setting('rr.x')::jsonb ->> 'id')::uuid)::text, true);

select is(current_setting('rr.close_x')::jsonb ->> 'status', 'closed',
  'second recall resolved');

set role postgres;

select is(
  (select count(*)::int from public.notifications
   where profile_id = '22222222-2222-2222-2222-222222222222'
     and kind = 'recall'
     and recall_id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  2,
  'bob has exactly issue + resolution notices for X (no duplicates)');

select is(
  (select count(*)::int from public.notifications
   where profile_id = '11111111-1111-1111-1111-111111111111'
     and kind = 'recall'
     and recall_id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  0,
  'previous owner alice is not notified on issue OR resolution of X');

select is(
  (select count(*)::int from public.notifications
   where profile_id = '11111111-1111-1111-1111-111111111111'
     and kind = 'recall'
     and recall_id = (current_setting('rr.y')::jsonb ->> 'id')::uuid),
  2,
  'current owner alice gets issue + resolution notices for Y (her HC10-2051)');

select is(
  (select count(*)::int
     from public.active_recalls_for_unit('66666666-6666-6666-6666-666666666602')
    where id = (current_setting('rr.y')::jsonb ->> 'id')::uuid),
  0,
  'resolved recall no longer affects units');

select is(
  (select is_recalled from public.lookup_public_product('HC10-2051')),
  false,
  'resolved recall disappears from the public safety status');

select is(
  public.recall_affected_unit_count((current_setting('rr.y')::jsonb ->> 'id')::uuid),
  2,
  'resolved recall still reports its affected-unit count');

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::int from public.recalls
   where id in ((current_setting('rr.x')::jsonb ->> 'id')::uuid,
                (current_setting('rr.y')::jsonb ->> 'id')::uuid)),
  0,
  'anon cannot see resolved recalls');

set role postgres;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

select is(
  (select count(*)::int from public.recalls
   where id = (current_setting('rr.y')::jsonb ->> 'id')::uuid),
  1,
  'current owner (alice) can re-read a resolved recall that affects her unit');

select is(
  (select count(*)::int from public.recalls
   where id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  0,
  'previous owner (alice) cannot read a resolved recall for a unit she no longer owns');

select throws_ok(
  $$ select public.close_recall('77777777-7777-7777-7777-777777777701') $$,
  null, 'only manufacturer owners or admins can manage recalls',
  'non-staff cannot resolve recalls');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

select is(
  (select count(*)::int from public.recalls
   where id = (current_setting('rr.x')::jsonb ->> 'id')::uuid),
  1,
  'current owner (bob) can re-read a resolved recall for his unit');

set role postgres;

-- ---------------------------------------------------------------------------
-- public history privacy
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from public.lookup_public_product('HC10-2048') l,
          jsonb_array_elements(l.history) e
    where not (e - 'kind' - 'at' = '{}'::jsonb)),
  0,
  'public history entries expose only kind and date');

select is(
  (select coalesce(jsonb_agg(distinct e ->> 'kind'), '[]'::jsonb)
     from public.lookup_public_product('HC10-2048') l,
          jsonb_array_elements(l.history) e),
  '["recall_issued", "registered", "transferred"]'::jsonb,
  'public history contains registered, transferred and recall issued events');

select is(
  (select count(*)::int
     from public.lookup_public_product('HC10-2048') l
    where l.history::text ~* 'alice|bob|chen|morgan|@|9WzD|7xKX|wallet|profile'),
  0,
  'public history contains no owner names, wallets, emails or profile ids');

-- ---------------------------------------------------------------------------
-- notification idempotency is enforced at the database level
-- ---------------------------------------------------------------------------
insert into public.notifications (profile_id, kind, severity, title, body, dedupe_key)
values ('22222222-2222-2222-2222-222222222222', 'transfer', 'info',
        'Dup probe', 'Dup probe', 'dup-probe-key');

select throws_ok(
  $$ insert into public.notifications (profile_id, kind, severity, title, body, dedupe_key)
     values ('22222222-2222-2222-2222-222222222222', 'transfer', 'info',
             'Dup probe', 'Dup probe', 'dup-probe-key') $$,
  '23505',
  'duplicate key value violates unique constraint "notifications_dedupe_key_uidx"',
  'duplicate dedupe_key is rejected by the unique index');

select * from finish();

rollback;
