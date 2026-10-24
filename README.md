# BPRO

Procurement dashboard adapted from the supplied `index (1).html`. The original layout, eight role definitions, 12-step workflow, requests, tasks, vendors, reports, calendar and configuration screens are retained. Demo authentication, sample requests, fake uploads and silent successful writes are removed.

**Status: implemented and locally tested; NOT connected to a live Supabase project.** A Supabase project, server environment variables, migrations, and an explicitly selected owner UUID are required. GitHub Pages alone cannot run this application; it needs a Node server.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
cp .env.example .env
# Fill .env with your project URL, publishable/anon key and SERVER-ONLY secret/service-role key.
npm run check
npm test
npm start
```

Open http://localhost:3000. Until configuration is supplied, the interface displays a setup-pending message and rejects sign-in. There is no demo fallback.

`npm ci --omit=dev` installs no application runtime packages. The development-only PGlite dependency runs PostgreSQL migration/security tests. The Excel library is vendored from the supplied dashboard and loaded only when needed; review/update it as part of dependency maintenance.

## Supabase setup

1. Create a dedicated Supabase project. Keep public signup disabled: this dashboard has no signup endpoint. In Authentication, configure your password policy (at least 12 characters recommended), email confirmation/delivery and session expiry. Set the Site URL to your actual deployment origin.
2. Apply `supabase/migrations/202610230001_bpro.sql`, then `202610230002_seed.sql` using Supabase SQL Editor as the database operator, or apply the files with your established migration tooling. Use a fresh project or review existing policies first. The migration enables RLS and explicitly restricts client access to the private file bucket, even if another permissive storage policy exists.
3. Create the primary account in **Authentication → Users** and set its password there. Copy its exact Auth UUID.
4. Replace the zero UUID in `supabase/bootstrap-owner.sql` with that UUID and run it once in the SQL Editor. Do not commit a password or a key. The database allows exactly one protected owner. No first visitor can claim ownership.
5. Set the server environment variables from `.env.example`. Use the project URL and publishable/anon key plus a server-only secret (or legacy service-role key). The server requires this privileged key to list Auth users and persist the protected application state. Never add it to `public/`, browser config, GitHub Actions output or repository secrets used by a client build.
6. Start the server. Sign in with the owner's Supabase Auth **email and password**.
7. Create other accounts and passwords in Supabase Authentication. The database trigger creates unassigned, disabled profiles for new users and backfills existing users when the migration runs. Auth email/name changes synchronize automatically. Auth deletions remove non-owner profiles automatically.
8. Open **Admin console → Users → Refresh users**. The server paginates the Auth Admin API and joins profiles. Choose a role, enable access and save. An unassigned or disabled account cannot use the dashboard. Passwords are never listed, returned or stored in the application state.

The primary owner cannot be demoted, disabled, removed, reassigned or replaced through the application. Owner Auth deletion is blocked by the foreign key; SQL triggers protect its identity and profile. A database operator can still perform an intentional recovery migration: see SECURITY.md. Email alone is never an owner identifier.

## Roles and authorization

Original roles: Admin; Head of Operations; Operations Lead; Procurement Executive; Head of Marketing/EBO; Marketing Lead; Marketing POC; Viewer.

Existing role names, workflow role assignments and ordinary permission definitions are seeded from the source. The requirement for a single owner overrides the original administrative permissions: **Admin Console, user/role/config administration, audit, import, backups and ALL file uploads/deletes require the primary owner UUID**, even for the non-owner Admin role. The owner has full application access independently of their role name. Other roles retain their ordinary dashboard, request, workflow, comment, issue, vendor, export and financial permissions.

The server checks identity and current profile on every request; browser visibility is only a convenience. Request ownership is checked separately from edit-all access. Workflow completion checks the allowed role, active step, quote count, selected vendor and required attachments. Nonfinancial roles receive recursively redacted structured amounts/rates/spend, including exports. Free-text comments and attachments are shared with users who can read their request; do not put confidential financial information in those shared fields.

## Data and hosting architecture

Browser → same-origin Node server → Supabase Auth, Postgres and private Storage.

- Tokens stay in HttpOnly, SameSite=Strict cookies, with Secure cookies required for HTTPS origins. No tokens or privileged keys are sent in JSON or stored in browser localStorage. Theme preference may use localStorage.
- Auth passwords are sent directly from the Node server to Supabase Auth. All Supabase traffic is server-side. Refresh tokens rotate through the server; logout revokes the current Supabase session.
- RLS and grants deny anonymous/authenticated direct reads/writes to `bpro_state` and `bpro_audit`. Clients can read only their own basic profile and owner identity. All application state access passes through server RBAC. This is a backend-for-frontend design: the server's secret key deliberately bypasses RLS and must remain trusted. RLS does not replace server authorization.
- To preserve the original flexible dashboard configuration, domain records are stored in a versioned JSON document. An atomic compare-and-swap RPC saves the state and audit event in one transaction, returning HTTP 409 on concurrent writes. There is no in-memory production data fallback.
- Private files are stored in the `bpro-files` bucket. Only the owner can upload/delete; downloads require request access. Downloads use attachment disposition and application/octet-stream to prevent uploaded active content executing under the app origin. Failed metadata commits attempt to remove the uploaded object.

Deploy behind an HTTPS reverse proxy to a host that can run Node 22, with the server reachable through the same origin as the static UI. Keep it bound to loopback and proxy to it on the same host. Set `APP_ORIGIN=https://your-domain.example`, `COOKIE_SECURE=true`, and `PORT`. Inject secrets through your host's secret manager, not the frontend build. Proxy configuration must preserve Origin and stream uploads within the 6 MiB application limit. Apply an edge/WAF login rate limit for production; the built-in per-IP limiter is process-local and sees the proxy's IP behind a reverse proxy.

Example reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.example;
    # Configure valid TLS certificate paths for your host.
    client_max_body_size 7m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## Imports, exports and operational limits

- XLSX import recognizes `PR No.` in column A and named columns: Raised Date/Date, Location/Store, Collateral/Collateral Type, Requirement/Description, Quantity/Qty. Existing PR numbers are skipped. Only these core columns are imported; workflow dates, vendors, historical assignments, artwork and attachments require review/entry afterwards. Unknown collateral/location or invalid rows are reported. Imports never create Auth users or passwords.
- The original eight report choices now use current records. XLSX and CSV exports are supported; CSV formula prefixes are neutralized. Summary workbooks contain KPIs, step timing, parties, collaterals, locations and vendors. Sample-data load/clear is intentionally disabled.
- Step clocks use date-level working days, configured weekly off days and holidays. QC is labelled “within target,” not a precise 24-hour measurement. Holds do not pause the clock. Dates of dependent steps are derived from earlier completion dates; overrides and undo require workflow-manager permissions.
- Escalation alerts are derived when the dashboard is read. There is no scheduled email/SMS escalation service. “Mark read” does not permanently suppress unresolved alerts.
- The JSON-state model targets a modest internal team. Every request currently loads the full state and profile list; large datasets need normalized tables and pagination before scaling. The 6 MiB JSON request cap also limits the complete document that can be saved. Server-side direct database reporting is not implemented.
- Deleting a request removes its database records but does not purge associated storage objects. Failed cleanup can also leave private orphan files. Run a reviewed operator cleanup against metadata periodically. Backups exclude uploaded files and Auth credentials; configure and test database AND Storage backups separately. Supabase backup availability depends on your plan.
- This project has no new open-source license for the supplied dashboard. Third-party licenses are in THIRD_PARTY_NOTICES.md. Keep the repository private unless you have redistribution rights.

## Validation

```sh
npm run check
npm test
```

Tests cover all eight roles, deny-by-default membership, owner identity, permissions, request scope, field tampering, quote/step requirements, working days, live aggregate calculations, all report formats, HTTP CSRF/session behavior, static-file isolation and unconfigured behavior. PostgreSQL tests execute both migrations against PGlite with minimal Auth/Storage schema stubs and exercise trigger synchronization, immutable owner identity, RLS, restricted RPC privileges, storage policy restrictions and optimistic concurrency. These are local tests, not proof of a deployed Supabase integration.

Before launch, apply the migrations to your real project and run the acceptance checklist in SETUP_CHECKLIST.md. Live Auth, refresh behavior, email confirmation, deployed Storage, reverse proxy, backup restore and real-world concurrency remain deployment checks until the project exists and keys are supplied.
