# RecallRelay — Phase 1

RecallRelay is a product passport for ownership and safety records. This phase is a responsive frontend preview built with Next.js App Router, TypeScript, Tailwind CSS v4, and Lucide icons. All records and workflows are local mock data; no backend, identity, wallet, or chain integrations are included.

## Run locally

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Routes

- `/` — editorial introduction and product passport preview
- `/verify/[id]` — public product verification
- `/app/products` — owner product library
- `/app/products/[id]` — product passport
- `/app/products/[id]/transfer` — local ownership handoff preview
- `/app/transfers`, `/app/recalls`, `/app/profile` — owner record views
- `/manufacturer` — manufacturer overview
- `/manufacturer/products`, `/manufacturer/products/[id]` — model catalog and details
- `/manufacturer/register` — unit registration preview
- `/manufacturer/units/[id]` — registered unit detail
- `/manufacturer/recalls`, `/manufacturer/recalls/new`, `/manufacturer/recalls/[id]` — recall views and local issue flow
- `/manufacturer/profile` — manufacturer workspace profile

## Mock record

`src/lib/data.ts` is the typed source for product, owner, safety, timeline, and navigation examples. Product artwork is local SVG in `public/products/`. Transfer, registration, and recall interactions use component-local state only and do not persist after leaving the view. The visible QR pattern is illustrative and is not scannable.
