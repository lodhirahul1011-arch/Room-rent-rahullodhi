# B8 Security & Deployment Acceptance Checklist

## Before any public launch

- [ ] MongoDB user has least-privilege DB role; network access restricted to API/worker.
- [ ] Replica set enabled and test transactions verified.
- [ ] Rotate secrets; no hardcoded admin/default credentials; password reset and account verification implemented.
- [ ] Refresh tokens moved out of JS-accessible sessionStorage to secure HttpOnly/SameSite cookies with CSRF protection; test token replay and global logout.
- [ ] Cross-owner property/tenant/document/invoice isolation tested with real HTTP requests.
- [ ] Tenant cannot access another tenant's ledger, payment proof, ID document, invoice PDFs or complaint.
- [ ] Prevent duplicate room occupation, billing, penalties and payment credits under parallel requests.
- [ ] PII/document retention policy, encryption at rest, malware scanning and private object storage implemented.
- [ ] Payment-proof upload transmits file bytes securely (currently metadata only) and exposes authorized review endpoints.
- [ ] PDF archives signed/scoped; all downloads audited; attachment filenames sanitized.
- [ ] Background billing/reminder worker handles idempotency, lease dates and retries.
- [ ] Full source typecheck, lint, automated tests, production build and browser QA pass.
- [ ] B6 admin/subscription/approval modules completed or feature-gated and removed from public navigation.
- [ ] Logs/metrics, uptime monitoring, backups, restore drill, incident alerting, TLS and reverse proxy configured.

## Suggested disposable test sequence

1. Owner A creates an enrollment-enabled property; Owner B cannot read it.
2. Owner A creates a floor and room; tenant registers and sees only allowed catalogue entries.
3. Tenant submits enrollment; Owner B cannot approve it; Owner A approves it once.
4. Tenant re-authenticates; verify tenancy and own profile, but no other tenant data.
5. Generate monthly invoice twice; exactly one persists and original revision is unchanged.
6. Submit partial UPI payment with proof metadata; ledger unchanged before verification.
7. Verify payment once; ledger and allocation exactly match; second verification fails.
8. Confirm other Owner/Tenant cannot download invoice PDF or tenant documents.
9. Move tenant out; room becomes vacant and tenancy history remains, while future rent stops.
10. Test deposit settlement, complaint notification and reconciliation for the same organization.

Call-media tests are deferred by product decision. Cross-request **financial** concurrency is *not* waived by that decision.
