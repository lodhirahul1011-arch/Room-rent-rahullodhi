# RoomRent — Phase 6 Frontend Implementation Report

## Scope
Built on the Phase 5.1 Next.js project, retaining the existing portfolio, enrollment and finance state. The **new components are a frontend-only demonstration**. No Express/MongoDB, real push notifications, payment settlement or secure document upload is implemented.

## New routes
- `/owner/maintenance` — complaint list with status updates, owner remarks, timestamps and property/tenant context
- `/tenant/maintenance` — tenant issue submission and history (demo selector)
- `/owner/notifications`, `/tenant/notifications` — in-browser notices, read/unread
- `/owner/documents`, `/tenant/documents` — document *metadata* submission and owner verification/rejection
- `/owner/deposits`, `/tenant/deposits` — deposit recording, settlement, deduction and refund obligations (no actual transfer)
- `/owner/operations-reports` — property occupancy, invoice totals, verified collection, outstanding and unresolved tickets

All new routes and the original Phase 1–5 routes are included in the source archive. Nav links added in the existing role shell.

## Shared domain layer
`features/operations/engine.ts` implements validated, typed transitions for tickets, notices, document metadata, deposit collection and settlement, plus portfolio/finance-based reporting. State persisted in browser localStorage through `features/operations/store.tsx`.

## Important financial distinctions
Deposit amounts are **not rent payments**. Recording a deposit is a demonstration of a declared external/manual collection; no bank verification occurs. Deposit refunds are obligations and do **not** make actual transfers. Invoice collection totals use verified invoice payments only. Reports show invoice-period totals, not audited ledger closing or real cash-flow accounting.

## Test results / known limitations
- 134 TypeScript/TSX files parsed successfully; 0 parse diagnostics.
- 17 direct runtime Node.js smoke assertions passed for operations engine (transpiled via locally installed TypeScript).
- 7 additional Vitest regression tests added (`tests/unit/operations-engine.test.ts`), **not executed** through Vitest.
- Full `npm ci`, full `tsc --noEmit`, ESLint, Next build and Playwright browser E2E were **not verified**; dependencies are unavailable/incomplete in this environment.
- Browser storage is untrusted, not encrypted or authenticated; demo selectors let anyone view all demo tenants. DO NOT use real IDs, proofs or sensitive tenant information.
- Attachments save only `{name, size, type}`; the actual image/video/document is not stored, so users cannot view media content after selection. Never represent these records as uploaded media.
- Notices are created by in-app actions. Scheduled rent reminders, push/SMS/email notifications, subscription workflows and automatic complaint escalation are future backend features.
- Deposit records are separate from the rent ledger, pending a designed accounting API; prior billing workflows remain unchanged.
- Dashboard widgets from older phases are not automatically extended with Phase 6 counters.

## Local verification commands
From the `project` directory run:
```
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```
Then test complaint submission -> owner status -> tenant notice, document metadata -> owner verification, tenancy move-out -> deposit settlement, and property report filters.
