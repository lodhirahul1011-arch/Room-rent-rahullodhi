# RoomRent Phase 7 — Frontend implementation

Built on Phase 6 source. Adds Admin owners/subscriptions/approvals/reports/support, Owner CCTV shortcuts/tablet device registration/sensitive approvals/simulated calls, and tenant simulated call UI.

## Scope and limitations
Browser localStorage stores demo Platform state. Existing phases 1–6 are preserved. Admin actions are not real security controls, subscription values do not charge clients, approval decisions do not automatically modify financial records. CCTV opens user-configured HTTPS external links only; no camera video streams are integrated. Pairing codes are mock labels, not secure credentials. Calls only change mock states and do not use media, WebRTC, signaling, ringing, authentication, or push notifications. Never use sensitive real data in demo.

## QA
Phase 7 platform engine unit tests added. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run dev` in the `project/` directory. These checks must pass before calling the app production-ready.
