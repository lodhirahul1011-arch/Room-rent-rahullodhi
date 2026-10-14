# RoomRent Phase 4 — Implementation and QA handoff

## Delivered (frontend-only)
- `/tenant/enrollment`: profile and address inputs; property -> vacant room selector; intended move-in date; *metadata-only* identity proof and photograph selector with 2 MB limit; validation; mock submission.
- `/tenant/enrollment/status`: local-only application lookup by phone (NOT a secure account-based view).
- `/owner/enrollments`: pending/approved/rejected queue; review submitted details and document metadata; approve with tenancy creation or reject with reason.
- `/owner/tenancies`: active and ended tenancy list with dated move-out and historic records.
- Added sidebar routes for tenant onboarding and owner approvals/history.
- Pure functions in `features/enrollment/logic.ts`: validation, submission, approval/rejection, file metadata; tests in `tests/unit/enrollment.test.ts`.
- Phase 3 property/room/tenant code preserved, along with owner-managed manual room assignment.

## State and safety model
- The existing Phase 3 `PortfolioProvider` persists into `localStorage` key `roomrent-phase3-portfolio-v1`; stored portfolios lacking `enrollments` are normalized on load.
- No actual upload; no binary documents stored. **Do not use real identity documents**, as this is a mock UI.
- No real role/session enforcement, server authorization, notifications or encrypted storage; UI is a demo only.
- Approval validates vacancy at decision time, avoids duplicate decisions, and creates new tenant and active tenancy with referential IDs.
- Rejection retains applicant status and reason without activating tenancy.
- Move-out ends a record and retains history. Actual future rent stoppage and pro-rating belong to subsequent billing phase.
- Existing owner direct room assignment remains an intentional **manual onboarding exception**; secure backend should enforce correct approval policy per origin.

## Complete user testing journey
1. Visit `/tenant/enrollment`, choose available property/room, input applicant details, select small *non-sensitive dummy* files, submit.
2. Navigate `/owner/enrollments` (same browser profile and origin); view pending request.
3. Reject with a reason OR approve; approval creates tenant and room occupancy.
4. Visit `/owner/tenancies`, verify newly active row, set move-out date, move out, confirm row under Ended.
5. Visit `/owner/properties/[id]` and confirm room becomes vacant; old tenancy remains in history.
6. Negative cases: missing files, duplicate pending phone, occupied room at approval, repeated approval, move-out before move-in.

## Known limitations and deferred work
- No owner-property-scoped permissions (future Express middleware + MongoDB).
- Document upload is metadata simulation only; real secure file storage required.
- Enrollment status uses phone matching without authentication; **never deploy as a real identity lookup**.
- Shared localStorage data is single browser/origin only, not a server multi-user system.
- Existing dashboard analytics are separate mock data and may not match edited portfolio.
- No waitlists, co-tenants, cancellations, amendment/re-approval, document expiry, real notifications or payment/billing hooks yet.
- New unit tests authored; dependency installation not available in this environment, thus build/typecheck/tests are **not confirmed passing**.

## Run locally
`npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run dev`

Recommended next: Phase 4.1 QA and data integration after tests pass, then Phase 5 invoices, payment proofs and ledger.
