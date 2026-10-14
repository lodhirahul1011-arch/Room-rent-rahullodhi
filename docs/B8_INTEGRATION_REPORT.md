# RoomRent B8 — Frontend/Backend Integration Report

## Scope and implementation inventory

Integration performed from RoomRent Phase 8 frontend and B7 backend (which retains B2–B5 services). Original mock stores remain for demonstrations and use `NEXT_PUBLIC_ROOMRENT_API_MODE=mock`. The new `services/live/api.ts` uses auth-aware fetch, access token refresh, typed API wrappers and authenticated file downloads. `features/live/live-workspace.tsx` supplies the live operational pages, and `features/live/live-auth.tsx` supplies login/register, session status and route gating.

| Workflow | Live-mode status | HTTP backend |
|---|---|---|
| Owner registration/login and tenant registration/login | Connected | `/api/auth/*` |
| Owner property management / floors / rooms | Connected | `/api/properties`, `/api/floors`, `/api/rooms` |
| Tenant profiles & active/historical tenancies | Connected | `/api/tenants`, `/api/tenancies`, `/api/tenant/*` |
| Tenant self-enrollment / owner's approve/reject | Connected | `/api/catalog/*`, `/api/enrollments/*` |
| Move-out / occupancy | Connected | `/api/tenancies/:id/move-out` |
| Monthly invoices, penalties, PDF revisions | Connected | `/api/invoices/*` |
| Manual payment submission & owner verification | Connected (proof **metadata** only) | `/api/payments/*` |
| Tenant/owner ledger & reconciliation | Connected | `/api/tenant/ledger`, `/api/tenants/:id/ledger`, `/api/reports/reconciliation` |
| Maintenance complaints/status | Connected | `/api/maintenance/*` |
| Tenant document upload/review/private download | Connected after tenancy approval | `/api/files/*`, `/api/documents/*` |
| Deposit, notification workflows | Connected (external cash/UPI is not automatically verified) | `/api/deposits/*`, `/api/notifications/*` |
| Admin/owner subscriptions, admin support, sensitive-change approval | **Unavailable in B7 backend**; no fake live success | B6 missing |
| Owner/Tenant/tablet WebRTC | Signaling backend exists; **not live integrated or tested** | B7 only |

Invoice-print route now detects live mode and renders server-based version/PDF history instead of showing the browser-local original.

## Security boundary

The server is authoritative. Frontend role guarding is only a UX convenience and must not be treated as access control. API routes check membership and tenant scope; the public enrollment catalogue is restricted to properties flagged as accepting enrollments, and available room numbers omit occupied rooms. The tenant's login needs refreshing after owner's approval to access the new organization.

## Run results from this environment

- `node scripts/b8-static-qa.cjs`: PASS (source/route checks and TypeScript syntax parsing, no typecheck).
- `npm --prefix apps/api test`: PASS for 69 pure unit tests; one B7 and one B8 runtime integration test skipped without MongoDB.
- `npm install`: timed out because package registry access is unavailable.
- `npm run typecheck`: cannot pass with missing Next.js/React type packages; diagnostics mainly report unresolved modules/types.
- Next.js production build, ESLint, Vitest, Playwright, authenticated HTTP+Mongo and replica-set transaction tests: **not verified here**.
- ZIP integrity: checked at packaging.

**Do not interpret passing source syntax/unit checks as proof of real browser, MongoDB or production security correctness.**

## Required B8 follow-through

1. Run clean `npm ci`, `typecheck`, `lint`, unit tests and `next build` in a network-enabled environment.
2. Run the B8 HTTP/Mongo test against a disposable local MongoDB replica set, then add unauthorized/cross-owner checks for every resource.
3. Perform two-browser tests of registration, owner catalogue, enrollment, approval, tenant relogin, invoices, payment verification and ledger consistency.
4. Add concurrency stress tests for duplicate invoice generation and double payment verification (non-calling concurrency is still needed).
5. Replace browser sessionStorage refresh-token handling before public production deployment.
6. Complete B6 Admin/subscription/approval APIs and corresponding live frontend integration; verify background worker startup, retry and idempotency.
7. Configure private storage, backed-up MongoDB, monitoring, production secrets, HTTPS, rate limits and disaster recovery.

## Deferred intentionally

Real camera/microphone streams, TURN connectivity, reconnect/media quality, and concurrent calling are intentionally excluded at the user's request. These items should not block testing of property and financial modules.
