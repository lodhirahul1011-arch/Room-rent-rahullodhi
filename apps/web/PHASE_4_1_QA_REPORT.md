# RoomRent Phase 4.1 — Owner dashboard / portfolio integration

## Implemented
- Owner Dashboard property cards, totals, occupancy, tenant counts and scheduled **base rent** now derive from `PortfolioProvider`, the same localStorage-backed Phase 3–4 store used by Properties, Tenants, Tenancies and Enrollment.
- Portfolio operational selectors are pure and typed in `features/owner-dashboard/portfolio-analytics.ts`.
- Pending enrollment count and recent enrollment decisions are derived from portfolio enrollment records; generic unimplemented payment queues are no longer passed off as live actions.
- Room vacancy, maintenance and occupancy are differentiated. Ending a tenancy reduces active occupancy and projected room rent; historical tenancies remain stored.
- Financial collection, outstanding and overdue amounts are intentionally displayed as **Not tracked** until Phase 5 invoice and payment data exist. Six-month rent chart remains **historical illustrative sample**, not ledger reporting.
- Property links use actual portfolio property IDs. Quick links to room management and enrollment queue now open implemented routes.
- Unit tests added for derivation, move-out, empty state, pending-only enrollments.

## Verification
- ZIP integrity: verified during packaging.
- TypeScript syntax parse (modified files): passed.
- Full typecheck: **blocked** by incomplete node_modules/type declarations in execution environment.
- Lint / Vitest / Next.js production build / Playwright: **not verified** due to unavailable installed dependencies. Do not assume they pass.

## Limitations and next QA
- Persistence is local to the browser; no server synchronization, actual role security, documents or real payments.
- Dashboard historical trend remains a clearly labeled fixed sample. It is not derived from the portfolio and should be replaced by actual financial records in Phase 5.
- Route-specific PortfolioProviders read the same localStorage key on mount. Cross-tab live synchronization is not implemented.
- Owner dashboard's pending payment, maintenance and approval cards will be reintroduced only when source-backed records exist.
- Run `npm ci && npm run typecheck && npm run lint && npm test && npm run build` in a network-enabled development machine.
