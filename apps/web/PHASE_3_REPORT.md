# RoomRent Phase 3 — Property / Floors / Rooms / Tenants

## Implemented
- `/owner/properties`: search, add and edit property; portfolio occupancy summary; reset demo records.
- `/owner/properties/[id]`: floor creation, room creation/editing, maintenance toggle, assign an unassigned tenant, mark move-out, occupancy status and tenancy linkage.
- `/owner/tenants`: searchable tenant directory; add and edit tenant; active room and historical tenancy count.
- Typed domain entities kept separate: `Property`, `Floor`, `Room`, `Tenant`, `Tenancy`.
- Seeded demonstration portfolio: 4 properties, 62 rooms, 55 active tenancies (7 vacant).
- Browser-local persistence via localStorage; reset button in property directory.
- Pure business rules and unit tests covering double booking, vacancy and move-out history.

## Architectural limits
- This is a *frontend demo*. Browser localStorage is not shared, secure, transactional, or an actual API. Role authorization is not enforced server-side.
- Phase 2 Owner Dashboard still uses its original independent demo summary; Phase 3 portfolio updates do **not** recalculate Phase 2 analytics. Connecting both to a unified live API/data source is future work.
- Tenant identity documents, verification, enrollments/approvals, secure uploads, billing, prorating and real rent-stop jobs are not implemented in this phase.
- No destructive delete actions are provided: referenced properties/floors/rooms/tenants must retain historical links.
- Source repos Parcelis/OpenKOS/Smart Housing were treated as reference; no third-party repository code copied.

## Test / setup
Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run dev`.
