-- RecallRelay Phase 2 — row level security, grants, revokes
-- Principle: every table has RLS; multi-table writes happen only through
-- SECURITY DEFINER RPCs; product_units ownership columns are never client-writable.

-- ---------------------------------------------------------------------------
-- start from an explicit grant baseline (defaults are wide-open)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
revoke execute on all functions in schema public from public;

-- ---------------------------------------------------------------------------
-- enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.manufacturers enable row level security;
alter table public.manufacturer_members enable row level security;
alter table public.product_models enable row level security;
alter table public.product_units enable row level security;
alter table public.ownership_records enable row level security;
alter table public.recalls enable row level security;
alter table public.recall_units enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_self_or_comembers"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.manufacturer_members me
      join public.manufacturer_members them on them.manufacturer_id = me.manufacturer_id
      where me.profile_id = auth.uid() and them.profile_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- no insert / delete policies: profiles are created by create_profile (RPC).

-- ---------------------------------------------------------------------------
-- manufacturers (brand names are public; writes go through RPCs)
-- ---------------------------------------------------------------------------
create policy "manufacturers_select_public"
  on public.manufacturers for select
  using (true);

-- ---------------------------------------------------------------------------
-- manufacturer_members
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helper avoids recursive policy evaluation on this table.
create policy "members_select_own_or_membership"
  on public.manufacturer_members for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_manufacturer_member(manufacturer_members.manufacturer_id)
  );

-- no insert/update/delete policies: membership changes go through RPCs.

-- ---------------------------------------------------------------------------
-- product_models
-- ---------------------------------------------------------------------------
create policy "models_select_public"
  on public.product_models for select
  using (true);

create policy "models_insert_staff"
  on public.product_models for insert to authenticated
  with check (public.is_manufacturer_staff(manufacturer_id));

-- ---------------------------------------------------------------------------
-- product_units
-- ---------------------------------------------------------------------------
create policy "units_select_authenticated"
  on public.product_units for select to authenticated
  using (true);

-- Ownership (current_owner_profile_id) may only change through
-- transfer_product_ownership (SECURITY DEFINER). Defense in depth on top of
-- the missing insert/update/delete policies:
revoke insert, update, delete on public.product_units from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ownership_records (RPC + seed only)
-- ---------------------------------------------------------------------------
create policy "ownership_select_parties_and_staff"
  on public.ownership_records for select to authenticated
  using (
    from_profile_id = auth.uid()
    or to_profile_id = auth.uid()
    or exists (
      select 1 from public.product_units u
      where u.id = ownership_records.unit_id
        and u.current_owner_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.product_units u
      join public.product_models m on m.id = u.model_id
      where u.id = ownership_records.unit_id
        and public.is_manufacturer_member(m.manufacturer_id)
    )
  );

-- ---------------------------------------------------------------------------
-- recalls
-- ---------------------------------------------------------------------------
-- Everyone sees active recalls; staff also see their own drafts/closed ones.
create policy "recalls_select_active_or_staff"
  on public.recalls for select
  using (
    status = 'active'
    or public.is_manufacturer_staff(manufacturer_id)
  );

-- ---------------------------------------------------------------------------
-- recall_units
-- ---------------------------------------------------------------------------
create policy "recall_units_select_visible_recall"
  on public.recall_units for select to authenticated
  using (
    exists (
      select 1 from public.recalls r
      where r.id = recall_units.recall_id
        and (r.status = 'active' or public.is_manufacturer_staff(r.manufacturer_id))
    )
  );

-- ---------------------------------------------------------------------------
-- notifications (read your own; only read_at is client-updatable)
-- ---------------------------------------------------------------------------
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- activity_events (append-only; reads follow unit visibility)
-- ---------------------------------------------------------------------------
create policy "activity_select_visible_unit"
  on public.activity_events for select to authenticated
  using (
    actor_profile_id = auth.uid()
    or (manufacturer_id is not null and public.is_manufacturer_member(manufacturer_id))
    or (
      unit_id is not null
      and exists (
        select 1
        from public.product_units u
        join public.product_models m on m.id = u.model_id
        where u.id = activity_events.unit_id
          and (
            u.current_owner_profile_id = auth.uid()
            or public.is_manufacturer_member(m.manufacturer_id)
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- table grants (row filtering happens in the policies above)
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, notification_prefs) on public.profiles to authenticated;

grant select on public.manufacturers to anon, authenticated;

grant select on public.manufacturer_members to authenticated;

grant select on public.product_models to anon, authenticated;
grant insert on public.product_models to authenticated;

grant select on public.product_units to authenticated;

grant select on public.ownership_records to authenticated;

grant select on public.recalls to anon, authenticated;

grant select on public.recall_units to authenticated;

grant select on public.notifications to authenticated;

grant select on public.activity_events to authenticated;

-- ---------------------------------------------------------------------------
-- function grants
-- ---------------------------------------------------------------------------
-- authenticated: everything in the public schema
grant execute on all functions in schema public to authenticated;

-- anon: public verification + public counts only
grant execute on function public.mask_wallet(text) to anon;
grant execute on function public.lookup_public_product(text) to anon;
grant execute on function public.recall_affected_unit_count(uuid) to anon;
grant execute on function public.active_recalls_for_unit(uuid) to anon;
