# RoomRent Phase 5 — Frontend Mock Finance Implementation

## Base and scope
Continues Phase 4.1 unchanged except for additional pages, finance engine/store, navigation, and live Owner Dashboard financial figures. Frontend only: React + Next.js + browser localStorage; no Express, MongoDB, payment gateway, real auth, or secure file upload.

## Modules delivered
- Owner `/owner/invoices`: Generate monthly invoices from portfolio tenancies; one snapshot per tenancy per month; due day 1–28; room rent in integer paise.
- Manual electricity, maintenance, and other charges; original invoice line-item snapshot remains immutable, amendments are separate entries.
- Electricity meter reading delta (previous/current × INR per unit), one meter charge per invoice.
- Configurable 15-day (default) overdue grace; fixed, daily, or percentage penalty; applying twice does not double charge. Percentage is entered as percent and stored in basis points.
- UPI/bank/cash external payment records, filename/type/size-only proof metadata, owner verification/rejection and rejected resubmission via new reference.
- Partial payments and pending payment reservations. Only verified payments credit the account.
- `/owner/payments`: owner verification UI.
- `/owner/ledger`: tenant-wise append-style debit/credit/running balance, signed adjustments and one-time reversal entries.
- `/owner/reports`: month and property invoice-period reconciliation.
- `/tenant/invoices`, `/tenant/payments`, `/tenant/ledger`: demo tenant views. No user authentication/authorization yet.
- `/owner/invoices/print/[id]`, `/tenant/invoices/print/[id]`: printable invoice snapshot and revisions via browser Print / Save PDF.
- Owner Dashboard rent collected/pending/overdue/collection rate derives from the same finance store. Historical six-month chart remains clearly labelled sample.

## Financial assumptions needing confirmation
- Monthly billing: no automatic mid-month pro-rating. Tenancy active for any day in the month receives one full rent invoice; post-move-out months skipped.
- Penalty: after `graceDays` FULL days after due date, one penalty entry can be applied; percentage operates on remaining invoice balance at application.
- No automatic penalty background scheduler (owner manually applies in mock UI).
- Invoice amendments are separate records; original rent item is preserved. This is a printable view, not a versioned signed PDF document.
- Payments cannot exceed current verified outstanding after accounting for already submitted pending proofs.
- Adjustments do not reduce dues below zero in this model. Deposit management, overpayments, credit balances, formal refunds, and multi-invoice allocation need backend design.
- Current report groups payments by invoice month, NOT by cash receipt date; monthly cash-flow reconciliation by transaction date is future work.

## Security and production warning
Do not use real PII/ID/payment proof. Files are never uploaded or stored; only name/type/size are saved for demo. localStorage is editable and not secure or shared across devices. Mock tenant selector is NOT access control. No authorized financial write protection, transactions, immutable server audit, background jobs, or real invoice signing exist yet.

## QA
- TypeScript parser diagnostics across project source: zero parse errors.
- Direct JavaScript-transpiled finance engine smoke test: invoice creation and idempotency, meter amount, verified-only credit, penalty idempotency, ledger reconciliation passed.
- Nine Vitest test cases added at `tests/unit/finance-engine.test.ts`, not executed here.
- Full `tsc --noEmit` run blocked by absent Next.js/React types in the available dependency install. ESLint, Vitest and Next production build not verified.

## Run locally
`npm install && npm run typecheck && npm run lint && npm test && npm run build && npm run dev`

## Future integration
Persist invoices, payments, proofs, ledger and settings in secured Node.js + MongoDB APIs with authenticated owner/tenant roles, MongoDB transactions, unique `(tenancyId,month)` invoice index, idempotency keys, protected object storage, and authoritative financial audit logs.
