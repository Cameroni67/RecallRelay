-- RecallRelay Phase 2 — local development seed
-- Creates SIWS-style auth users (web3 identities), profiles, a manufacturer
-- workspace, catalog, units, and one active recall.
--
-- Coverage notes (see the Phase 2 test matrix):
--   * HC10-2048  -> current owner Bob  -> inside the recall scope (selected units)
--   * HC10-2051  -> current owner Alice -> outside the recall scope
--   * TCM-8831   -> current owner Bob  -> outside the recall scope
--   * Alice must never receive a recall notification from this seed.

-- ---------------------------------------------------------------------------
-- auth users + web3 identities
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, last_sign_in_at, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', null, '',
   now(), now(), '{"provider":"web3","providers":[]}',
   '{"address":"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM","chain":"solana"}',
   now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', null, '',
   now(), now(), '{"provider":"web3","providers":[]}',
   '{"address":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","chain":"solana"}',
   now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', null, '',
   now(), now(), '{"provider":"web3","providers":[]}',
   '{"address":"3aqJ3Z8kQvT9wRm2YpLs6HnC4dFg7Bxu1EjK5vNqRtSy","chain":"solana"}',
   now(), now(), false, false)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
values
  ('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', '11111111-1111-1111-1111-111111111111',
   '{"iss":"did:sol:9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM","address":"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM","chain":"solana"}',
   'web3', now(), now(), now()),
  ('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', '22222222-2222-2222-2222-222222222222',
   '{"iss":"did:sol:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","address":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","chain":"solana"}',
   'web3', now(), now(), now()),
  ('3aqJ3Z8kQvT9wRm2YpLs6HnC4dFg7Bxu1EjK5vNqRtSy', '33333333-3333-3333-3333-333333333333',
   '{"iss":"did:sol:3aqJ3Z8kQvT9wRm2YpLs6HnC4dFg7Bxu1EjK5vNqRtSy","address":"3aqJ3Z8kQvT9wRm2YpLs6HnC4dFg7Bxu1EjK5vNqRtSy","chain":"solana"}',
   'web3', now(), now(), now())
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- profiles (wallet bound by trigger from the identities above)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Alice Morgan', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'Bob Chen', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'Northstar Ops', now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- manufacturer workspace
-- ---------------------------------------------------------------------------
insert into public.manufacturers (id, slug, name, verified, created_by, created_at, updated_at)
values ('44444444-4444-4444-4444-444444444444', 'northstar-outdoor-tech',
        'Northstar Outdoor Tech', true, '33333333-3333-3333-3333-333333333333', now(), now())
on conflict (id) do nothing;

insert into public.manufacturer_members (manufacturer_id, profile_id, role)
values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'owner')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- catalog
-- ---------------------------------------------------------------------------
insert into public.product_models (id, manufacturer_id, sku, name, category, image_path, created_at, updated_at)
values
  ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444444',
   'HC10', 'HeatCore 10K', 'Portable battery pack', '/products/heatcore.svg', now(), now()),
  ('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444444',
   'TCM', 'TrailCharge Mini', 'Portable charger', '/products/fieldcharge.svg', now(), now()),
  ('55555555-5555-5555-5555-555555555503', '44444444-4444-4444-4444-444444444444',
   'NRC', 'Northstar RideCore', 'E-bike battery', '/products/voltcell.svg', now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------
insert into public.product_units (id, model_id, serial_number, manufactured_at,
                                  registered_at, current_owner_profile_id, created_at, updated_at)
values
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555501',
   'HC10-2048', date '2026-09-12', timestamptz '2026-10-01 09:00:00+00',
   '22222222-2222-2222-2222-222222222222', now(), now()),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555501',
   'HC10-2051', date '2026-09-14', timestamptz '2026-09-20 09:00:00+00',
   '11111111-1111-1111-1111-111111111111', now(), now()),
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555502',
   'TCM-8831', date '2026-08-02', timestamptz '2026-08-22 09:00:00+00',
   '22222222-2222-2222-2222-222222222222', now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ownership history
-- ---------------------------------------------------------------------------
insert into public.ownership_records (id, unit_id, from_profile_id, to_profile_id,
                                      transferred_at, initiated_by, note)
values
  ('88888888-8888-8888-8888-888888888801', '66666666-6666-6666-6666-666666666601',
   null, '11111111-1111-1111-1111-111111111111',
   timestamptz '2026-10-02 10:00:00+00', '33333333-3333-3333-3333-333333333333', 'First owner'),
  ('88888888-8888-8888-8888-888888888802', '66666666-6666-6666-6666-666666666601',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   timestamptz '2026-10-08 15:30:00+00', '22222222-2222-2222-2222-222222222222', null),
  ('88888888-8888-8888-8888-888888888803', '66666666-6666-6666-6666-666666666602',
   null, '11111111-1111-1111-1111-111111111111',
   timestamptz '2026-09-20 10:00:00+00', '33333333-3333-3333-3333-333333333333', 'First owner'),
  ('88888888-8888-8888-8888-888888888804', '66666666-6666-6666-6666-666666666603',
   null, '22222222-2222-2222-2222-222222222222',
   timestamptz '2026-08-22 10:00:00+00', '33333333-3333-3333-3333-333333333333', 'First owner')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- one active recall: selected units scope, HC10-2048 only
-- ---------------------------------------------------------------------------
insert into public.recalls (id, manufacturer_id, model_id, title, severity,
                            required_action, scope_kind, status, issued_at,
                            created_by, created_at, updated_at)
values ('77777777-7777-7777-7777-777777777701',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555501',
        'Battery overheating risk', 'urgent', 'Stop using immediately.',
        'selected_units', 'active', timestamptz '2026-10-09 08:00:00+00',
        '33333333-3333-3333-3333-333333333333', now(), now())
on conflict (id) do nothing;

insert into public.recall_units (recall_id, unit_id)
values ('77777777-7777-7777-7777-777777777701', '66666666-6666-6666-6666-666666666601')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- notifications
--   Bob: recall notice (owns affected HC10-2048) + transfer notice
--   Alice: welcome only — she owns no affected unit and must get no recall notice
-- ---------------------------------------------------------------------------
insert into public.notifications (id, profile_id, recall_id, unit_id, kind, severity,
                                  title, body, read_at, created_at)
values
  ('99999999-9999-9999-9999-999999999901', '22222222-2222-2222-2222-222222222222',
   '77777777-7777-7777-7777-777777777701', '66666666-6666-6666-6666-666666666601',
   'recall', 'urgent', 'Battery overheating risk',
   'Required action: Stop using immediately.', null, timestamptz '2026-10-09 08:00:00+00'),
  ('99999999-9999-9999-9999-999999999902', '22222222-2222-2222-2222-222222222222',
   null, '66666666-6666-6666-6666-666666666601',
   'transfer', 'info', 'You now own HeatCore 10K',
   'Ownership of HC10-2048 was transferred to you.', null, timestamptz '2026-10-08 15:30:00+00'),
  ('99999999-9999-9999-9999-999999999903', '11111111-1111-1111-1111-111111111111',
   null, null, 'welcome', 'info', 'Welcome to RecallRelay',
   'Your product passports and safety notices will appear here.', null, now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- activity feed
-- ---------------------------------------------------------------------------
insert into public.activity_events (id, unit_id, manufacturer_id, actor_profile_id,
                                    kind, summary, detail, created_at)
values
  ('aaaaaaa1-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666601',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'registered', 'Registered by Northstar Outdoor Tech',
   '{"serial":"HC10-2048","sku":"HC10"}'::jsonb, timestamptz '2026-10-01 09:00:00+00'),
  ('aaaaaaa1-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666601',
   '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
   'transferred', 'Ownership transferred',
   '{"from":"Alice Morgan","to":"Bob Chen","serial":"HC10-2048"}'::jsonb,
   timestamptz '2026-10-08 15:30:00+00'),
  ('aaaaaaa1-0000-0000-0000-000000000003', null,
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'recall_issued', 'Recall issued: Battery overheating risk',
   '{"severity":"urgent","scope":"selected_units","affected":1}'::jsonb,
   timestamptz '2026-10-09 08:00:00+00'),
  ('aaaaaaa1-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666602',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'registered', 'Registered by Northstar Outdoor Tech',
   '{"serial":"HC10-2051","sku":"HC10"}'::jsonb, timestamptz '2026-09-20 09:00:00+00'),
  ('aaaaaaa1-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666603',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'registered', 'Registered by Northstar Outdoor Tech',
   '{"serial":"TCM-8831","sku":"TCM"}'::jsonb, timestamptz '2026-08-22 09:00:00+00')
on conflict (id) do nothing;
