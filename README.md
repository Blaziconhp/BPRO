# BPRO

BPRO is the procurement dashboard adapted from the supplied HTML. It keeps the dashboard screens, eight role definitions, workflow, requests, tasks, vendors, reports, calendar and configuration. The production site is a static GitHub Pages app that connects directly to Supabase Auth, Postgres RPCs and private Storage. **It does not use a Supabase Edge Function or a service-role/secret key in the browser.**

The production database migration and sole-owner setup are applied to project `ogtwwviftkmdzckgnphd`. The GitHub Pages update is being published; finish the sign-in and upload smoke checks before using this for business records.

## Production setup

1. In Supabase project `ogtwwviftkmdzckgnphd`, confirm Auth is enabled and public sign-up is disabled. Set the Site URL to `https://blaziconhp.github.io` and add that origin to the allowed redirect URLs.
2. In Supabase SQL Editor, apply these files in order: `supabase/migrations/202610230001_bpro.sql`, `supabase/migrations/202610230002_seed.sql`, then `supabase/migrations/202610260001_static_client_access.sql`. The last migration grants authenticated browser sessions limited RPC access, enables request-scoped reads and owner-only writes for protected areas, and sets private Storage policies. Review it before applying it to production.
3. In **Authentication → Users**, create or identify the primary owner account and copy its exact UUID. Run `supabase/bootstrap-owner.sql` once after replacing its all-zero UUID with that exact Auth UUID. Do not use an email address as the owner identifier.
   To transfer an existing production owner, use a separately reviewed, exact-identity operator script rather than editing the owner table in the app. The current reviewed transfer script is `supabase/transfer-primary-owner-to-harsh.sql`.
4. Push the repository's `main` branch. The `pages.yml` GitHub Actions workflow publishes `public/` to [https://blaziconhp.github.io/BPRO/](https://blaziconhp.github.io/BPRO/). In GitHub repository **Settings → Pages**, select **GitHub Actions** as the source.
5. Sign in using the primary owner's Supabase Auth email and password. Create other accounts in Supabase **Authentication → Users**; the database trigger mirrors them into BPRO's user list as disabled/unassigned. In **Admin Console → Users**, the primary owner assigns a role and enables each account.

The only browser-side Supabase values are the project URL and publishable key in `public/config.js`. The publishable key is public by design. Never add a Supabase secret/service-role key to this project, GitHub Pages, or any browser file.

## Local checks

Requires Node 22 or newer.

```sh
npm ci
npm run check
npm test
```

The PGlite database tests run the SQL migrations against local Auth/Storage stubs. They do not change the production project or prove that live Auth/Storage is configured. The legacy Node API under `server/` is not used by GitHub Pages; no server or Edge Function needs to be deployed.

## Roles and security

Original roles are retained: Admin; Head of Operations; Operations Lead; Procurement Executive; Head of Marketing/EBO; Marketing Lead; Marketing POC; Viewer. The single primary owner UUID is the only identity allowed into Admin Console, to manage users and roles, change dashboard configuration, view the audit log, import/backup data, or upload/delete files. The non-owner Admin role does not bypass those owner-only rules.

All browser state reads and writes go through narrowly granted Postgres RPCs that derive the caller from `auth.uid()`. RLS denies direct access to the raw state and audit tables. The database write RPC checks role permissions, request scope, workflow assignment, financial access and owner-only configuration. Attachment reads are limited to visible requests; uploads and deletes are owner-only. Financial fields are redacted for roles without `financials.view`. Auth passwords are managed only by Supabase Auth and are never copied into BPRO tables.

The dashboard keeps its flexible records in a versioned JSON state row and uses revision checks to detect concurrent edits. This model suits a small internal team; move to normalized tables and paginated queries before the data volume grows substantially. Database tests do not replace an independent security audit or live access testing.

## Existing features and limits

- XLSX import accepts core tracker fields only; workflow history, assignments, vendor quotes and files need review afterward. Imports do not create Auth users.
- Reports can export CSV and XLSX from current data. Sample/demo data is disabled.
- Step timing uses configured working days, weekly days off and holidays. Escalations are calculated when the dashboard is read; no email/SMS scheduler is included.
- Files are limited to 6 MiB and an extension allowlist. They are private and not malware-scanned. Keep sensitive information out of shared comments.
- Configure and test Supabase database and Storage backups separately. The JSON backup export does not include uploaded files or Auth credentials.

Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The supplied dashboard has no new open-source license; keep the repository private unless redistribution rights are confirmed.
