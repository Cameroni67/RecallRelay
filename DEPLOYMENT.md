# RecallRelay — Production Deployment (Phase 6)

This file is the submission-facing record of the live deployment. It contains
**names and URLs only — never secret values**.

## Live environment

| Item | Value |
| --- | --- |
| Production URL (stable alias) | <https://recallrelay-jamie25.vercel.app> |
| Public verify URL (canonical demo) | <https://recallrelay-jamie25.vercel.app/verify/HC10-2048> |
| Platform | Vercel — team `jamie25`, project `recallrelay`, Node 24.x, `next build` |
| Source | <https://github.com/Cameroni67/RecallRelay> (`master`) |
| Supabase project | `gnjpnvtdkuzyniwmvgdq` (hosted, full plan of migrations + RLS) |
| Solana | **Devnet** — program `GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP` (executable, BPFLoaderUpgradeable), RPC `https://api.devnet.solana.com` |

Each production deploy also gets a per-deployment URL
(`recallrelay-<hash>-jamie25.vercel.app`) and the auto domain
(`recallrelay-snowy.vercel.app`); judges should always be given the **stable
alias** above. This is a **Devnet / test MVP**: no real funds, no real
warranties, test wallets only.

## Architecture (production)

- **Web** — Next.js 15 (App Router) on Vercel. The browser talks to Supabase
  directly with the publishable key; session auth is SIWS (Sign-In With Solana)
  via the Web3 provider, popup flow, no redirects.
- **Data** — Postgres with Row Level Security + `SECURITY DEFINER` RPCs. All
  writes go through validated RPCs (`issue_recall`, `transfer_ownership`,
  `apply_chain_*`, …). There is **no service-role key anywhere** in the app or
  CI — nothing privileged ever reaches the browser.
- **Chain** — the deployed program is authoritative for product registration,
  on-chain owner, and transfer count; Supabase is authoritative for recall
  state and product data. The server-side route `GET /api/chain/state` reads
  Devnet and never lets a chain outage downgrade verified state or hide safety
  information.

## Production environment variables (names only)

All four are `NEXT_PUBLIC_*` and browser-safe by design. The app requires
**no server-side secrets**.

| Name | Points at |
| --- | --- |
| `NEXT_PUBLIC_RECALLRELAY_ENV` | `hosted` (environment badge) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gnjpnvtdkuzyniwmvgdq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the project's publishable (anon) key |
| `NEXT_PUBLIC_SITE_URL` | `https://recallrelay-jamie25.vercel.app` — canonical origin; QR codes encode `<this>/verify/<serial>` (falls back to the browser origin, never localhost) |

Set in Vercel → Project → Settings → Environment Variables (Production).
`.env*` files are gitignored and `.vercelignore` keeps them, `.vercel/`, and
all local build artifacts (including the Solana program keypair) off the
platform.

## Supabase auth configuration (dashboard reference)

Sign-in is `signInWithWeb3` (Solana), but GoTrue still validates the **`uri`
claim inside the signed SIWS message** against your URL allow-list (checked in
`supabase/auth` `internal/api/web3.go` via `IsRedirectURLValid`). A message is
rejected with *"Signed Solana message is using URI which is not allowed on this
server"* unless its URI matches the **Site URL or one of the Redirect URLs** —
and for non-localhost URIs the message's Domain must equal the URI host.
supabase-js signs `window.location.origin` in the browser, so **every origin
the app is served from must be allow-listed**. Required configuration under
**Authentication → URL Configuration**:

- **Site URL**: `https://recallrelay-jamie25.vercel.app`
- **Redirect URLs** (all three, exact):
  - `https://recallrelay-jamie25.vercel.app`
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`

The localhost entries keep `npm run dev` and the `verify:auth` /
`verify:isolation` scripts working (they sign `http://localhost:3000/signin`);
the production entries let the deployed app complete SIWS. Removing a URL from
this list breaks sign-in for that origin immediately — treat the list as
append-only for the two environments above.

**Authentication → Providers → Web3** (Solana) must stay **enabled** (it is).

## Vercel settings that matter

- **Deployment Protection must stay OFF for production** — this project was
  created with team-SSO protection, which302-redirects every visitor to
  `vercel.com/sso-api`. It was disabled for this project (Settings →
  Deployment Protection → Vercel Authentication → disabled) so the judge URL is
  public. If a future deploy suddenly requires Vercel login, check that page.
- **Git integration (optional)**: the Vercel account could not be granted
  access to the GitHub repo at link time, so deploys are pushed from the CLI.
  To enable push-to-deploy: Vercel → Project → Settings → Git → connect
  `Cameroni67/RecallRelay`.

## Deploying a new version

```powershell
npx vercel --yes --prod                                   # deploy current master
npx vercel alias set <deployment-url> recallrelay-jamie25.vercel.app   # move stable alias
```

If `NEXT_PUBLIC_*` values change, update them with
`npx vercel env rm <NAME> production --yes` +
`npx vercel env add <NAME> production` **before** deploying (they are inlined
at build time).

## Verifying the canonical product (HC10-2048)

Read-only checks — none of them modify hosted data:

1. Open <https://recallrelay-jamie25.vercel.app/verify/HC10-2048>: HeatCore 10K
   by Northstar Outdoor Tech, **Urgent** recall banner ("Battery overheating
   risk") with the required action, and **no owner identity** anywhere in the
   page (no names, emails, or wallet addresses).
2. `npm run demo:check` — verifies the fixture (copy, severity, required
   action) and asserts the public lookup exposes no owner PII.
3. Database facts (optional, read-only): the unit exists with Bob as current
   owner and Alice as first owner; the recall is `active`/`urgent`; Bob has
   exactly one recall notification; Alice has none.
4. Chain: the program account is executable on Devnet, and
   `GET /api/chain/state?unitId=66666666-6666-6666-6666-666666666601` returns
   live Devnet slot data. The seeded unit is honestly **pre-registration**
   (identical state locally and hosted) — the chain layer itself is proven by
   `npm run e2e:devnet` (13/13 live Devnet assertions) and `npm run test:sbf`
   (19/19 program tests).

## Exact test commands (all green for this submission)

```powershell
npm run lint                # eslint — 0 problems
npx tsc --noEmit            # TypeScript — clean
npm test                    # Vitest — 41/41 (14 files)
npm run build               # next build — clean
npm run test:sbf            # LiteSVM program suite — 19/19 (re-enters WSL on Windows)
npm run verify:env          # env validation — "Hosted data"
npm run verify:auth         # SIWS round trip against hosted
npm run verify:isolation    # session isolation + public privacy against hosted
npm run demo:check          # read-only demo fixture verification
npm run db:test             # pgTAP — 187 tests (local stack)
npm run db:test -- --linked # pgTAP — 187 tests (hosted project)
```

**Ordering note for hosted runs.** `verify:auth` and `verify:isolation` create
throwaway SIWS users; without a service-role key their admin cleanup returns
401 on hosted, which leaves throwaway profiles and breaks the pgTAP invariant
`seed has 3 profiles`. Run hosted pgTAP **before** the verify scripts, or
remove the harness residue first (names are harness-only; the delete cascades
to their profiles and notifications):

```sql
delete from auth.users
where id in (
  select id from public.profiles
  where full_name in ('Verify Bot', 'Isolation Bot A', 'Isolation Bot B')
);
```

(`npx supabase db query --linked "<sql>"` — read the rows first if unsure; the
three demo profiles are Alice Morgan, Bob Chen, Northstar Ops.)

## Judge / demo checklist (60–90 seconds)

1. **Landing** — <https://recallrelay-jamie25.vercel.app>: blockchain product
   passports, recall alerts that follow the product, Solana-backed, no login
   needed to verify.
2. **Public verification (the money shot)** — open
   <https://recallrelay-jamie25.vercel.app/verify/HC10-2048> (or scan the QR
   from the Product Passport): identity → safety (**URGENT** banner, required
   action text) → authenticity (chain/Devnet state) → ownership (history
   without names) → Solana transparency. Zero PII by design.
3. **Owner app** (Phantom, Devnet) — sign in as the demo owner: Product
   Passport with recall banner + QR, recalls timeline, notifications (Bob's
   urgent recall notice).
4. **Manufacturer app** — Northstar Ops: recalls list → detail → "Mark
   resolved" (confirm → `close_recall`; history preserved; notification
   dedupe proven by the 39-test pgTAP recall suite).
5. **Chain reference** — Solana explorer:
   <https://explorer.solana.com/address/GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP?cluster=devnet>

One-liner pitch: *“Ownership is chain-backed on Solana Devnet; recall state is
off-chain-authoritative and instantly, privately verifiable by QR — Alice was
never notified, Bob was, and the public page shows the danger without showing
who.”*
