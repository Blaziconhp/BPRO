# Deployment acceptance (not yet executed against live Supabase)

- [ ] Dedicated project created; signup disabled; Auth policy and SMTP configured.
- [ ] Both migrations applied successfully and the chosen Auth UUID bootstrapped once.
- [ ] Server-only secrets injected; no secrets present in public files or repository history.
- [ ] HTTPS reverse proxy works with Secure cookies; APP_ORIGIN exactly matches the deployed origin.
- [ ] Wrong password, expired access token, refresh, signout and revoked membership tested with real Auth.
- [ ] New Auth user appears unassigned; enabling and role assignment grants exactly the selected access.
- [ ] Non-owner Admin receives 403 for all Admin Console routes, imports, backups and uploads.
- [ ] Viewer cannot create, edit, complete steps, change roles, or upload through direct HTTP calls.
- [ ] Owner cannot be demoted, disabled or deleted through API or normal database operations.
- [ ] Direct anon/authenticated requests to state, audit, privileged RPCs and bpro-files are rejected.
- [ ] A real owner file upload/download works; another permitted user can download but cannot upload/delete.
- [ ] Workflow quotes, vendor selection, required QC attachment, parallel approvals, undo and closure tested.
- [ ] Real tracker headers and mapping reviewed before import; skipped rows and missing history reconciled.
- [ ] Financial redaction confirmed in request details, vendors, dashboard and every export.
- [ ] Concurrent edits produce a conflict instead of lost changes.
- [ ] CSV/XLSX downloads, date filters, theme and narrow-screen layout checked.
- [ ] Host/edge rate limits, monitoring, periodic private-file cleanup and database/Storage backup restore verified.

Record project/deployment identifiers and test outcomes here after setup. Never paste passwords or server keys into this file.
