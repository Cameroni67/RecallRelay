# RecallRelay — Phase 4 + 5 + 6 (judge-ready MVP)

RecallRelay is a product passport for ownership and safety records. Phase 2 replaced the Phase 1 mock layer with real Supabase-backed auth, profiles, and data. Phase 3 added a **real Solana ownership layer (Devnet only)**. Phase 4 + 5 complete the MVP: **manufacturer recalls with current-owner notifications, a privacy-safe public verification page with real scannable QR codes, and UX/loading/error hardening**. Phase 6 deploys that MVP to **production on Vercel**, wired to the hosted Supabase project (`gnjpnvtdkuzyniwmvgdq`) and the same Devnet program — full deployment record, environment checklist, and judge script in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

- **Live app** — <https://recallrelay-jamie25.vercel.app> (Devnet / test MVP; public verify: `/verify/HC10-2048`)

- **Auth** — Solana Sign-In with Solana (SIWS) via `@supabase/ssr`. Your wallet address is your account; no email or password.
- **Data** — PostgreSQL schema (profiles, manufacturers + members, product models/units, ownership records, recalls, notifications, activity events) with strong row-level security (RLS).
- **Chain (Phase 3)** — an on-chain program (`solana/recallrelay-program`, program ID `GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP`) tracks manufacturer authority, product registration, and ownership transfer. The chain is the authority of record for anything it knows about; Supabase mirrors what the server observed. The program is deployed to Devnet; the deployment record and live E2E transaction signatures live in `solana/build-info.md`.
- **Recalls (Phase 4)** — recall authority is **off-chain in Supabase** (title, severity, scope, required action, description, status, timeline); the Solana program is unchanged. Publication notifies **current owners only**, exactly once (DB-side dedupe).
- **Verification (Phase 5)** — public `/verify/[serial]` with recall/safety state, real scannable QR codes derived from `NEXT_PUBLIC_SITE_URL`, and a controlled retry state when the cluster is briefly unreachable.
- **Modes** — the app runs in one of three data modes, shown by an environment badge in the owner and manufacturer sidebars (desktop and mobile drawer):

| Badge | Meaning |
| --- | --- |
| Demo data | No `NEXT_PUBLIC_SUPABASE_*` configured — Phase 1 fixtures, no sign-in |
| Local data | Supabase local stack (`npx supabase start`) |
| Hosted data | A hosted Supabase project |

## Production deployment (Phase 6)

The MVP is deployed at <https://recallrelay-jamie25.vercel.app> (Vercel project `recallrelay`, Node 24, `next build`) against the hosted Supabase project and Solana Devnet. Production needs exactly four browser-safe variables and **no server secrets**:
`NEXT_PUBLIC_RECALLRELAY_ENV=hosted`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (canonical origin for QR codes). Deploys are CLI-pushed from `master` (`npx vercel --yes --prod`, then move the stable alias); [`DEPLOYMENT.md`](./DEPLOYMENT.md) has the full environment checklist, Supabase auth configuration notes, verification commands, and the 60–90 second judge script.

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

## Run against hosted Supabase

```bash
cp .env.example .env.local   # then edit to hosted values:
# NEXT_PUBLIC_RECALLRELAY_ENV=hosted
# NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
npm run verify:env           # must report "Hosted data"
npx supabase link --project-ref <project-ref>
npx supabase db push         # migrations are the source of truth
npm run db:test -- --linked  # pgTAP against hosted (suite seeds nothing; run seed once via db query -f supabase/seed.sql if the project is fresh)
npm run verify:auth          # SIWS round trip against hosted
npm run verify:isolation     # session isolation + public privacy against hosted
npm run dev
```

Hosted Auth requires the **Web3 provider** to be enabled once in the Supabase dashboard: **Authentication → Providers → Web3 → Enable** (Solana). The SIWS flow is the same as local: wallet connect → sign message → `grant_type=web3` session → `auth.uid()` → profile. No redirect URLs are required for the popup flow, but adding `http://localhost:3000` under **Authentication → URL Configuration** is recommended.

### Switching environments safely

- `.env.local` is gitignored and always points at ONE project (local or hosted). The environment badge in the owner/manufacturer shells shows which one: `Local data` / `Hosted data` / `Demo data`.
- Sessions, profiles, and wallets are per-project. A session minted against local Supabase is meaningless to the hosted project (different JWT secret and publishable key) and vice versa — the app never assumes they are portable.
- After switching `.env.local` between environments, restart `npm run dev` (Next inlines `NEXT_PUBLIC_*` at build time) and sign in again. Stale identity from the previous environment cannot appear because auth cookies are validated against the new project's keys and rejected.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run verify:env` | Validates `NEXT_PUBLIC_*` env (fails on partial config) |
| `npm run verify:auth` | Auth health + full SIWS round trip: sign-in, `create_profile`, wallet binding, `find_profile_by_wallet`, admin cleanup (`--url`/`--key` flags override env) |
| `npm run verify:isolation` | Two-wallet session isolation + forged-access + anon privacy checks (`--url`/`--key` flags override env) |
| `npm run db:test` | pgTAP suite (`supabase test db`) — 187 tests across 5 files: schema, seed, RLS, RPCs, Phase 3 chain columns, Phase 4 recalls; add `-- --linked` to run against hosted |
| `npm run db:types` | Regenerates `src/lib/supabase/database.types.ts` from the local DB |
| `npm run db:reset` | Re-applies migrations and seed |
| `npm run demo:reset` | Restores the demo fixture: local mode runs `supabase db reset`; **hosted mode never destroys data** (runs the read-only fixture verification instead); demo mode (no DB) reloads compiled fixtures |
| `npm run demo:check` | Read-only demo fixture verification against the configured environment (HeatCore HC10-2048 + recall copy + no owner PII in the public lookup) |
| `npm run supabase:start` / `:stop` / `:status` | Local stack control |
| `npm run lint` / `typecheck` / `test` / `build` | App verification |
| `npm run test:sbf` | LiteSVM program suite (19 tests) — runs the compiled `.so` against `node --test`; re-enters WSL automatically on Windows |
| `npm run e2e:devnet` | Live Devnet end-to-end — headless SIWS identities, seedless local Supabase, real Devnet transactions: Northstar → HeatCore HC10-2048 → Alice → Bob, 13 assertions; records PDAs and tx signatures (run `npm run db:reset` afterwards) |

## Solana ownership layer (Phase 3)

The program lives in `solana/recallrelay-program` (Rust, `cargo build-sbf`). It owns three instructions: `InitializeManufacturer`, `RegisterProduct`, `TransferProduct`, each with strict account ordering and duplicate/malformed checks (a pre-existing account is rejected with its own error code; a corrupted one with `InvalidAccountData`).

**Trust model.** The client never supplies chain state. It may only submit identifiers and a transaction signature; the server re-reads the account from Devnet and records what *it* observed:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chain/prepare` | Builds the unsigned transaction (server chooses PDA + accounts); wallet signs |
| `POST /api/chain/send` | Relays wallet-signed bytes to the cluster and waits for confirmation |
| `POST /api/chain/reconcile` | Transfers only: re-reads the chain and applies `apply_chain_transfer` only when the on-chain transfer count advanced |
| `POST /api/manufacturers/[id]/reconcile-chain` | Re-reads the manufacturer account and records it via `reconcile_manufacturer_chain_state` |
| `POST /api/products/[id]/reconcile-chain` | Re-reads a unit's product account and records it via `reconcile_product_chain_state` (an optional tx signature is verified against the cluster before being stored) |
| `GET /api/chain/state` | Current server-observed chain state for a unit or manufacturer. Signed-in for any read; a **session-free read is allowed for a single unit only** (used by the public verification retry — no owner wallet in the response) |

**PDAs and authority.** The manufacturer PDA is derived from `["manufacturer", sha256(manufacturer uuid)]`; the product PDA from `["product", manufacturer PDA (raw 32 bytes), sha256(unit uuid)]` — the raw PDA bytes, never base58 text. The manufacturer's authority wallet signs `InitializeManufacturer`/`RegisterProduct`; the current owner's wallet signs `TransferProduct`. If the connected wallet does not match the signed-in (SIWS) wallet, the UI refuses with "Wallet mismatch" before anything is prepared.

**Reconciliation RPCs** (`20261009000007_phase3_solana_ownership.sql` + `20261009000008_phase3_chain_hardening.sql`): `reconcile_manufacturer_chain_state`, `reconcile_product_chain_state` (manufacturer owner/admin only), and `apply_chain_transfer` (callable only by the unit's current owner or manufacturer staff; moves `current_owner_profile_id` only after the chain shows a higher transfer count; re-applying is rejected). Reconciliation is idempotent — repeating the same observation re-stamps the columns but writes no duplicate activity events. The chain columns themselves are unreachable to clients: no insert/update grant exists on `manufacturers` or `product_units` at all. `transfer_product_ownership` — the Phase 2 DB-only path — now refuses units with `chain_state in ('pending','synced')`: ownership for chain-backed products can only move on chain.

**Truthful UI.** Every "verified on Solana" claim is driven by server-observed `chain_state`:

| State | Shown as |
| --- | --- |
| `unregistered` | "Not registered on Solana" / "no on-chain record" |
| `pending` | "Awaiting confirmation" (+ **Retry verification**) |
| `synced` | "Verified on Solana" with explorer links to the real PDA/tx |
| `error` | "Verification failed" — never dressed up as a delay |

If a registration transaction succeeds but the database write fails, the UI says **"Transaction confirmed. Syncing product record."** with a **Retry verification** button — it never re-registers (the duplicate check on chain would reject it anyway).

**Wallet.** Transactions are signed by the injected wallet (`window.solana` — Phantom/Solflare) via `src/lib/solana/wallet.ts`; no wallet-adapter dependency. The chain program and the server are Devnet-only (`src/lib/solana/deployment.ts`).

**Building the program.** `cargo build-sbf` and the LiteSVM harness are Linux-only on this machine, so the program is built and tested inside WSL (`bash scripts/build-sbf.sh`; `npm run test:sbf` re-enters WSL automatically when invoked from Windows). Solana is authoritative for ownership of anything it knows about; Supabase materializes application state from server-observed chain reads. Recalls remain off-chain in Phase 3 — the chain tracks ownership, not safety notices.

## Recall & notification layer (Phase 4 + 5)

**Authority split.** Solana stays authoritative for registrations, ownership and transfer count; Supabase holds recalls (title, severity, scope, required action, description, status), notifications, and the safety timeline. The Solana program is **not modified** in Phase 4/5 (same program ID, `test:sbf` 19/19 still green).

**Issuing and resolving** (`20261012000001_phase45_recalls.sql`):

- `issue_recall(model, title, severity, required_action, scope, unit_ids?, description?)` — manufacturer **owner/admin only** (server/DB-side role check; validation never lives in the client). Severity vocabulary is `advisory | important | urgent`; scope must be `all_units`, `serial_range` (both bounds, ordered), or `selected_units` whose units all belong to the caller's manufacturer *and* the chosen model.
- `close_recall(recall_id)` — owner/admin only; `active → closed` notifies current owners once and records a `recall_closed` event; closing twice is an idempotent no-op (`already_closed`); drafts close silently.
- **Current-owner targeting.** Both operations notify only `current_owner_profile_id` of affected units. The pgTAP suite proves the previous owner is **not** notified after a transfer (Alice out, Bob in), and every notification insert carries a `dedupe_key` (`recall-issued:<id>:<owner>`, `recall-closed:<id>:<owner>`, `transfer:<unit>:<count>`) with a partial unique index — repeated processing/reconciliation produces zero duplicates.
- **Visibility.** Active recalls are public/staff-readable; closed recalls become visible to current owners of affected units for history; drafts are staff-only. All evaluated in RLS (security-definer helpers with `set search_path`).

**Owner surfaces.** `/app/recalls` lists active recalls affecting the products you own (severity panel, real issued date, deep link); `/app/recalls/[id]` shows title, severity, required action, description, affected product passports and status; `/app/notifications` shows *your* notifications with mark-read (RLS only ever allows updating your own `read_at`; clients cannot insert notifications at all — only database functions can). The sidebar bell shows a **real unread count**.

**Manufacturer surfaces.** `/manufacturer/recalls` groups Active/Drafts/Resolved with real affected-unit and current-owner counts (RPC-derived, never invented); `/manufacturer/recalls/[id]` adds status, description, the valid public verification link (derived from the first unit serial of the recalled model), and a confirm-then-`close_recall` **Resolve recall** action. The recall form validates scope/severity/description server-side and previews the affected unit count from real unit rows.

**Product Passport & public verification.** The passport banner is driven by real recall data: severity mark (icon + text label — never color alone), banner (`URGENT RECALL` / `IMPORTANT RECALL` / `ADVISORY NOTICE`), title, required action, manufacturer, issued date, and a **View Recall** CTA to the recall detail page. `/verify/[serial]` orders mobile as identity → safety → authenticity → ownership → required action → history → Solana; it shows chain-backed ownership, transfer count and Devnet transparency, and never exposes owner name, email, auth UUID, full wallet, or membership internals.

**QR codes.** Real, scannable SVG QR codes (`qrcode`, canvas-free) encoding `<origin>/verify/<serial>` — origin comes from `NEXT_PUBLIC_SITE_URL` (never hardcoded; falls back to the browser's own origin), contain no private data, and survive transfers because they key on the serial. Shown with a download button on the Product Passport and the manufacturer unit page (`src/lib/site.ts`, `src/lib/qr.ts`).

**Chain-down behavior.** The public page never lets a cluster hiccup downgrade a server-observed record or hide safety information: retries go through the session-free single-unit `GET /api/chain/state`, which can only refine state upward, with copy stating that safety information is unaffected. Route-level `loading.tsx` skeletons cover all main routes; `error.tsx` boundaries (owner, manufacturer, verify) show friendly copy + retry only — no stacks, Postgres codes, or RPC payloads.

### Demo story (10 steps)

Fixtures: **Northstar Outdoor Tech → HeatCore 10K → HC10-2048 → Alice → Bob**, recall **"Battery overheating risk" / Urgent / "Stop using immediately and contact the manufacturer."**

1. `npm run dev` (demo mode — no database needed) and open `/`.
2. Browse `/verify/HC10-2048`: identity → **URGENT RECALL** → required action → "Current ownership recorded" → history → Solana — no owner name anywhere.
3. Scan the passport QR (or open its link) with a phone: it resolves to the same public verification page — origin from `NEXT_PUBLIC_SITE_URL`, no localhost.
4. Sign in (or demo-preview) the owner workspace: **My Products** shows HeatCore 10K as recalled, the other units as safe.
5. Open the passport: the recall banner shows severity + required action + issued date and links to the recall detail; the timeline lists Registered → Transferred → Recall issued.
6. `/app/recalls` shows the same recall scoped to *your* product; `/app/recalls/[id]` shows required action, description and the affected unit.
7. `/app/notifications` shows recall/ownership notifications with unread badge and mark-read (own rows only).
8. Manufacturer workspace → `/manufacturer/recalls`: real affected-unit/current-owner counts; open the recall for status, public link, and confirm-then-resolve.
9. Resolve the recall: current owners get one "recall resolved" notice (deduped), the passport flips to "No active recalls", and the recall stays in history as "Recall resolved".
10. `npm run demo:check` verifies the hosted/local fixture read-only (and that the public lookup leaks no owner PII); `npm run demo:reset` restores the local fixture — hosted data is never reset.

## Verification

```bash
npm run lint
npm run typecheck
npm test          # vitest (always runs in Demo data mode)
npm run build
npm run verify:env
npm run verify:auth        # target = whatever .env.local (or --url/--key) points at
npm run verify:isolation
npm run db:test            # local stack (187 tests)
npm run db:test -- --linked  # hosted project (after link + seed — 187 tests, parity)
npm run test:sbf           # LiteSVM program suite (rebuild first: bash scripts/build-sbf.sh)
npm run demo:check         # read-only demo fixture + public-privacy check
```

## Routes

Public:

- `/` — editorial introduction and product passport preview
- `/verify/[id]` — public product verification (serial or unit id; never exposes owner identity, wallet, or email)
- `/signin` — Solana SIWS sign-in
- `/onboarding`, `/onboarding/manufacturer` — profile and manufacturer workspace creation (redirect to workspaces when already complete)

Owner workspace (`/app/*`, guarded — redirects to `/signin`):

- `/app/products`, `/app/products/[id]`, `/app/products/[id]/transfer`
- `/app/transfers`, `/app/recalls`, `/app/recalls/[id]`, `/app/notifications`, `/app/profile`

Manufacturer workspace (`/manufacturer/*`, guarded — also requires a `manufacturer_members` row):

- `/manufacturer`, `/manufacturer/products`, `/manufacturer/products/[id]`
- `/manufacturer/register`, `/manufacturer/units/[id]`
- `/manufacturer/recalls`, `/manufacturer/recalls/new`, `/manufacturer/recalls/[id]`
- `/manufacturer/profile`

## Data model and security

- `profiles.id = auth.users.id`; the wallet address is derived only from verified `auth.identities` rows (`identity_wallet_address` understands both the seeded fixture shape and real SIWS `custom_claims` / `web3:solana:<address>` shapes) and is locked on first profile insert.
- Manufacturer access uses `manufacturers` + `manufacturer_members` (owner/admin/operator) — there is no global role claim.
- All tables have RLS enabled. Anon can read only public verification surfaces (`manufacturers`, `product_models`, `recalls`, the `v_public_product_verification` view, and lookup functions). Authenticated users update only whitelisted columns (e.g. `profiles(full_name, avatar_url, notification_prefs)`, `notifications(read_at)`); nobody inserts `product_units`, `ownership_records`, `notifications`, or `activity_events` from the client.
- Writes go through SECURITY DEFINER RPCs (`create_profile`, `create_manufacturer`, `create_product_model`, `register_product_unit`, `transfer_product_ownership`, `issue_recall`, `close_recall`) with explicit role checks; everything else runs SECURITY INVOKER under the caller's RLS.
- Recall scope is matched in SQL (`all_units`, `serial_range`, `selected_units`) and mirrored in `src/lib/db/mappers.ts` for owner-facing lists. Recalls carry `description` (≤ 4000 chars), severity `advisory | important | urgent`, and `status draft | active | closed`; notifications carry an optional `dedupe_key` with a partial unique index so repeated recall/transfer processing is idempotent.

Local seed: Alice/Bob/Northstar Ops wallets, Northstar Outdoor Tech with 3 models, 3 units, one active `selected_units` recall affecting only `HC10-2048` ("Battery overheating risk", urgent, "Stop using immediately and contact the manufacturer.").

## Verification of database behavior

`npm run db:test` runs the pgTAP suite in `supabase/tests/database/` (schema + seed assertions, RLS visibility per role, RPC authz and happy paths, Phase 3 chain columns, trusted reconciliation, idempotency, transfer-exactly-once, public-privacy guards, and the Phase 4 recall suite — **187 tests** across 5 files, run against **both local and hosted** for parity). The Phase 4 file (`05_phase4_recalls.test.sql`) includes issue/close authorization, severity and scope validation, current-owner-only notification targeting (previous owner not notified), dedupe/idempotency, and closed-recall visibility. `npm run verify:auth` additionally proves the real GoTrue SIWS path end to end with a throwaway keypair.

## Phase 1 notes

`src/lib/data.ts` remains the typed fixture source and the fallback whenever Supabase is unconfigured (demo mode and unit tests). Product artwork is local SVG in `public/products/`. QR codes are real and scannable (SVG generated by `qrcode`, payload = `<origin>/verify/<serial>`). In demo mode, transfer/registration/recall flows keep their Phase 1 local-preview behavior; when configured they call the RPCs above and persist changes.
