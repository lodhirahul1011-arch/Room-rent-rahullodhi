# Transactions API Contracts

All routes use the existing finance router and require `Authorization: Bearer <access-token>`.

## `GET /api/transactions`

Returns `{ data, page, limit, total, totalPages }`. Rows include transaction ID, submitted time, owner/organization ID, property and room, tenant name and phone, invoice number, billing month, category, payment method/reference, gross and allocated integer paise, status, and proof metadata. Verified credits present in the historical ledger without a matching Payment document are included with method `ledger`.

Query parameters: `page`, `limit` (1–100), `sort` (`date`, `date-asc`, `amount`), `ownerId` (admin only), `propertyId`, `floorId`, `roomId`, `tenantId`, `transactionId`, `month` (`YYYY-MM`), `category`, `method`, `status`, `startDate`, `endDate` (`YYYY-MM-DD`, Asia/Kolkata day boundaries), and `search`.

## `GET /api/transactions/summary`

Returns `{ data }` with integer paise fields `verifiedPaise`, `rentPaise`, `electricityPaise`, `maintenancePaise`, `otherPaise`, `depositPaise`, `pendingPaise`, `billedPaise`, `outstandingPaise`, and `refundPaise`, plus `count`.

## `GET /api/transactions/monthly`

Returns `{ data: [{ month, billedPaise, verifiedPaise, outstandingPaise }] }`, based on invoice billing month.

## `GET /api/transactions/daily`

Returns `{ data: [{ date, count, rentPaise, otherPaise, refundPaise, netPaise }] }`, with dates grouped in Asia/Kolkata.

## `GET /api/transactions/export.csv`

Returns CSV for the filtered transaction set. It uses the same authenticated organization scope and server-side filters as the list endpoint.

Errors follow the existing `{ error: { code, message } }` API envelope. Mutations are intentionally not exposed by these reporting routes.
