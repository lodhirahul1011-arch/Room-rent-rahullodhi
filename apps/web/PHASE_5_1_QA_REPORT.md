# RoomRent Phase 5.1 — Frontend Finance Stabilization and QA

## Scope
This is an incremental update to RoomRent Phase 5. No backend or MongoDB implementation was added. Existing pages, role-specific flows, property/tenancy mock store and frontend architecture are retained.

## Source-level changes
- Added `validatePenaltyRule` for grace days, permitted penalty modes, positive paise/basis-point amounts and percentage upper bound.
- Invoice penalty evaluation now rejects invalid calendar dates rather than silently calculating from malformed dates.
- Payment reference duplicate checks are case-insensitive within an invoice.
- Submitted mock proof metadata is checked for positive safe-integer file size, maximum 5MB and approved MIME types.
- Electricity readings and derived charges reject unsafe integers/overflow.
- Financial adjustments and payment submissions reject unsafe integer paise values.
- Owner penalty-settings form validates through the same engine function used in business logic.
- Added 7 regression tests to the existing finance Vitest suite, covering invalid settings, exact 15-day penalty boundaries, bad dates, case-insensitive payment references, empty proof, double verification, and rejected-payment reconciliation.

## Verification actually performed
- Direct Node VM smoke test using TypeScript transpilation: PASS, 11 assertions. The script checked invoice idempotency, penalty day boundaries, invalid dates/rules, duplicate payment references, verified-only credit, repeated verification and reconciliation invariant.
- Full TypeScript check (`tsc --noEmit`): BLOCKED. The npm dependency installation timed out and the partial install lacks numerous `@types` packages (for example aria-query/d3 types).
- Full Vitest, ESLint, Next production build, browser/Playwright E2E: NOT VERIFIED in this environment. Do not assume they pass.
- A smoke-check pass does not imply end-to-end correctness or production suitability.

## Remaining finance gaps before production
- Frontend finance persists in localStorage, without real authorization or concurrency control.
- No real file uploads or document storage; mock proof is metadata only.
- Penalties are owner-triggered, not run by a scheduler.
- No physical PDF version archive, formal receipts, bank reconciliation, deposit refunds or cross-invoice allocations.
- Current invoice calculations take the present room rent from portfolio; historical rent snapshot at tenancy activation should be formalized before backend.
- Dashboard and reconciliation group income by invoice rather than actual cash-receipt date.
- Add real API integration, MongoDB transactions, audit trails, owner/tenant authorization, unique indexes and idempotency controls in backend phase.

## Required local validation before Phase 6
Run from `project/`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Inspect owner invoices, payments, ledger, reports, tenant invoices, payments and ledger in the browser; test invoice generation, penalty, partial payment, rejection, re-submission and move-out with the seeded portfolio. Do not use real personal documents.
