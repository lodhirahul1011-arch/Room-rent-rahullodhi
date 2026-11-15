# Transactions and Rent Collection

## Delivered

- Added owner and admin transaction pages at `/owner/transactions` and `/admin/transactions`, with sidebar links.
- Added read-only transaction reporting endpoints to the existing finance router. The existing `Payment`, `PaymentAllocation`, `Invoice`, `DepositTransaction`, `Tenant`, `Property`, and `Room` records remain the data source.
- Owner and manager requests are scoped by the authenticated organization. Admin requests can read platform records. Existing payment verification and mutation endpoints remain owner/manager-only.
- Added server-side search and filters, pagination, newest/oldest/amount sorting, CSV export, summary cards, monthly billing history, daily history in Asia/Kolkata, and a transaction details drawer.
- Historical verified credit entries in the ledger are also shown when their original `Payment` record is missing; matching Payment documents are deduplicated.
- Amounts remain integer paise in API responses. Pending and rejected proofs do not contribute to verified collection. Collection is derived from allocation records.

## Current limits

- The existing model allocates a payment to an invoice, not to individual invoice items. Category totals therefore split each invoice allocation proportionally across its invoice item amounts using integer paise; this is a reporting estimate when an invoice has mixed categories.
- Existing finance models do not contain a general refund/reversal workflow or audit trail for payment transactions. Deposit refunds are included in the refund summary; general payment refunds are not invented here.
- Deposit receipts contribute to the deposit summary but are not yet included as rows in the transaction list.
- Monthly history exposes billed, verified, and outstanding totals. It does not yet expose every requested category per month or deep-link each month into its filtered transaction list.
- Daily history summarizes payment records; report exports are CSV only. PDF statements, Excel exports, report-specific statements, payment-proof file downloads, and transaction audit timelines are not added.
- Backend list processing caps the candidate set at 20,000 records per request before pagination. Large installations should move this reporting path to indexed aggregation pipelines.

## Security

The endpoints require the existing bearer-token middleware. The reporting role guard admits only owner, manager, and admin roles. Non-admin queries always include the authenticated organization ID on financial and related-record reads. Admin access is read-only. No admin mutation route was added.
