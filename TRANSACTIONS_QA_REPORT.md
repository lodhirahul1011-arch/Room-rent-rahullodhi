# Transactions QA Report

## Checks performed

- Frontend TypeScript check: `npm run typecheck` — passed after the owner/admin screens were added.
- Backend route syntax check: `node --check backend/src/modules/finance/routes.js` and `node --check backend/src/app.js` — passed.
- Browser and API integration tests: not run. No transaction tests were added in this change.

## Coverage status

Implemented: owner organization scoping, admin read-only role gate, server-side filters and pagination, payment status separation, fallback inclusion for historical ledger-only verified credits, allocation-based collection totals, integer paise output, CSV filter handling, Asia/Kolkata day boundaries, monthly and daily views.

Not verified or not implemented: database-backed permission integration cases, live browser flows, proof/PDF receipt access, full payment refunds/reversals, transaction audit timeline, deposit rows in the table, and mixed-category item-level allocation reconciliation. See `TRANSACTIONS_IMPLEMENTATION.md` for limits.

## Data integrity note

The project stores payment allocations against invoices rather than invoice line items. Per-category collected values are proportionally attributed across original invoice items with paise integer arithmetic. Invoice-level allocation totals remain the source for overall verified collection; category splits cannot be represented as exact item-level cash application until the accounting model records that allocation explicitly.
