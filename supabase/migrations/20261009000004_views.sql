-- RecallRelay Phase 2 — views
-- v_public_product_verification: owner privacy safe (no owner/wallet/email columns).
-- v_shared_profiles: authenticated-only minimal profile card for teammate/recipient UI.

create or replace view public.v_public_product_verification as
select
  u.id as unit_id,
  u.serial_number,
  m.sku as model_sku,
  m.name as model_name,
  m.category,
  m.image_path,
  man.name as manufacturer_name,
  man.verified as manufacturer_verified,
  (rc.id is not null) as is_recalled,
  rc.id as recall_id,
  rc.title as recall_title,
  rc.severity as recall_severity,
  rc.required_action as recall_required_action,
  rc.issued_at as recall_issued_at
from public.product_units u
join public.product_models m on m.id = u.model_id
join public.manufacturers man on man.id = m.manufacturer_id
left join lateral (
  select r.id, r.title, r.severity, r.required_action, r.issued_at
  from public.active_recalls_for_unit(u.id) r
  order by r.issued_at desc nulls last
  limit 1
) rc on true;

create or replace view public.v_shared_profiles as
select
  p.id,
  p.full_name,
  p.avatar_url,
  public.mask_wallet(p.wallet_address) as wallet_masked
from public.profiles p;

grant select on public.v_public_product_verification to anon, authenticated;
grant select on public.v_shared_profiles to authenticated;
