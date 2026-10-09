# RecallRelay — Phase 2

RecallRelay is a product passport for ownership and safety records. Phase 2 replaces the Phase 1 mock layer with real Supabase-backed auth, profiles, and data while keeping the Phase 1 design intact.

- **Auth** — Solana Sign-In with Solana (SIWS) via `@supabase/ssr`. Your wallet address is your account; no email or password.
- **Data** — PostgreSQL schema (profiles, manufacturers + members, product models/units, ownership records, recalls, notifications, activity events) with strong row-level security (RLS).
- **Modes** — the app runs in one of three data modes, shown by an environment badge in the owner and manufacturer sidebars (desktop and mobile drawer):

| Badge | Meaning |
| --- | --- |
| Demo data | No `NEXT_PUBLIC_SUPABASE_*` configured — Phase 1 fixtures, no sign-in |
| Local data | Supabase local stack (`npx supabase start`) |
| Hosted data | A hosted Supabase project |

## Run locally (demo mode)

```bash
npm install
npm run dev
```

Without Supabase env vars everything renders from Phase 1 fixtures — useful for design review and for `npm test`.

## Run with local Supabase

```bash
npm install
npx supabase start          # custom ports: API 54421, DB 54422, Studio 54423
cp .env.example .env.local  # points at http://127.0.0.1:54421
npm run verify:env          # validates the three NEXT_PUBLIC_* variables
npm run db:reset            # migrations + seed
npm run dev
```

Sign-in at `/signin` with the Phantom browser wallet. `supabase/config.toml` enables `[auth.web3.solana]`, so the first wallet sign-in creates the user; `/onboarding` then creates the owner profile and `/onboarding/manufacturer` creates a manufacturer workspace.

> This project uses non-default ports (54420–54429) so it can run alongside other local Supabase projects.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run verify:env` | Validates `NEXT_PUBLIC_*` env (fails on partial config) |
| `npm run verify:auth` | Auth health + full SIWS round trip: sign-in, `create_profile`, wallet binding, `find_profile_by_wallet`, admin cleanup |
| `npm run db:test` | pgTAP suite (`supabase test db`) — schema, seed, RLS, RPCs |
| `npm run db:types` | Regenerates `src/lib/supabase/database.types.ts` from the local DB |
| `npm run db:reset` | Re-applies migrations and seed |
| `npm run supabase:start` / `:stop` / `:status` | Local stack control |
| `npm run lint` / `typecheck` / `test` / `build` | App verification |

## Verification

```bash
npm run lint
npm run typecheck
npm test          # vitest (always runs in Demo data mode)
npm run build
npm run verify:env
npm run verify:auth   # requires the local stack running
npm run db:test       # requires the local stack running
```

## Routes

Public:

- `/` — editorial introduction and product passport preview
- `/verify/[id]` — public product verification (serial or unit id; never exposes owner identity, wallet, or email)
- `/signin` — Solana SIWS sign-in
- `/onboarding`, `/onboarding/manufacturer` — profile and manufacturer workspace creation (redirect to workspaces when already complete)

Owner workspace (`/app/*`, guarded — redirects to `/signin`):

- `/app/products`, `/app/products/[id]`, `/app/products/[id]/transfer`
- `/app/transfers`, `/app/recalls`, `/app/profile`

Manufacturer workspace (`/manufacturer/*`, guarded — also requires a `manufacturer_members` row):

- `/manufacturer`, `/manufacturer/products`, `/manufacturer/products/[id]`
- `/manufacturer/register`, `/manufacturer/units/[id]`
- `/manufacturer/recalls`, `/manufacturer/recalls/new`, `/manufacturer/recalls/[id]`
- `/manufacturer/profile`

## Data model and security

- `profiles.id = auth.users.id`; the wallet address is derived only from verified `auth.identities` rows (`identity_wallet_address` understands both the seeded fixture shape and real SIWS `custom_claims` / `web3:solana:<address>` shapes) and is locked on first profile insert.
- Manufacturer access uses `manufacturers` + `manufacturer_members` (owner/admin/operator) — there is no global role claim.
- All tables have RLS enabled. Anon can read only public verification surfaces (`manufacturers`, `product_models`, `recalls`, the `v_public_product_verification` view, and lookup functions). Authenticated users update only whitelisted columns (e.g. `profiles(full_name, avatar_url, notification_prefs)`, `notifications(read_at)`); nobody inserts `product_units`, `ownership_records`, `notifications`, or `activity_events` from the client.
- Writes go through SECURITY DEFINER RPCs (`create_profile`, `create_manufacturer`, `create_product_model`, `register_product_unit`, `transfer_product_ownership`, `issue_recall`) with explicit role checks; everything else runs SECURITY INVOKER under the caller's RLS.
- Recall scope is matched in SQL (`all_units`, `serial_range`, `selected_units`) and mirrored in `src/lib/db/mappers.ts` for owner-facing lists.

Local seed: Alice/Bob/Northstar Ops wallets, Northstar Outdoor Tech with 3 models, 3 units, one active `selected_units` recall affecting only `HC10-2048`.

## Verification of database behavior

`npm run db:test` runs the pgTAP suite in `supabase/tests/database/` (schema + seed assertions, RLS visibility per role, RPC authz and happy paths — 114 tests). `npm run verify:auth` additionally proves the real GoTrue SIWS path end to end with a throwaway keypair.

## Phase 1 notes

`src/lib/data.ts` remains the typed fixture source and the fallback whenever Supabase is unconfigured (demo mode and unit tests). Product artwork is local SVG in `public/products/`. The visible QR pattern is illustrative and is not scannable. In demo mode, transfer/registration/recall flows keep their Phase 1 local-preview behavior; when configured they call the RPCs above and persist changes.
