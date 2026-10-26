# BPRO

BPRO is the procurement dashboard adapted from the supplied HTML. It keeps the dashboard screens, eight role definitions, workflow, requests, tasks, vendors, reports, calendar and configuration. The production site is a static GitHub Pages app that connects directly to Supabase Auth, Postgres RPCs and private Storage. **It does not use a Supabase Edge Function or a service-role/secret key in the browser.**

The direct Supabase runtime is deployed on GitHub Pages and targets project `ogtwwviftkmdzckgnphd`. The production database currently has one owner; apply the co-owner migration and provision verified accounts before granting additional owner access.

## Production setup

1. In Supabase project `ogtwwviftkmdzckgnphd`, confirm Auth is enabled and public sign-up is disabled. Set the Site URL to `https://blaziconhp.github.io` and add that origin to the allowed redirect URLs.
2. In Supabase SQL Editor, apply the migrations in order: `202610230001_bpro.sql`, `202610230002_seed.sql`, `202610260001_static_client_access.sql`, and `202610260002_co_owners.sql`. The direct-access migration grants limited RPC access and installs RLS; the co-owner migration allows multiple explicitly provisioned owner UUIDs. Review migrations before applying them to production.
3. Create and verify the intended accounts in **Authentication → Users**. For a single owner, use `supabase/bootstrap-owner.sql`. To enable the two configured co-owners, run `supabase/bootstrap-co-owners.sql` after both Auth accounts exist. This script grants the owner boundary to those email-matched UUIDs; it does not create Auth users or set passwords.
4. Push the repository's `main` branch. The `pages.yml` GitHub Actions workflow publishes `public/` to [https://blaziconhp.github.io/BPRO/](https://blaziconhp.github.io/BPRO/). In GitHub repository **Settings → Pages**, select **GitHub Actions** as the source.
5. Sign in using an enabled owner's Supabase Auth email and password. Create other accounts in Supabase **Authentication → Users**; the database trigger mirrors them into BPRO's user list as disabled/unassigned. An owner assigns roles and enables each account.

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

Original roles are retained: Admin; Head of Operations; Operations Lead; Procurement Executive; Head of Marketing/EBO; Marketing Lead; Marketing POC; Viewer. Only explicitly provisioned owner UUIDs can enter Admin Console, manage users and roles, change dashboard configuration, view the audit log, import/backup data, or upload/delete files. The non-owner Admin role does not bypass those owner-only rules.

All browser state reads and writes go through narrowly granted Postgres RPCs that derive the caller from `auth.uid()`. RLS denies direct access to the raw state and audit tables. The database write RPC checks role permissions, request scope, workflow assignment, financial access and owner-only configuration. Attachment reads are limited to visible requests; uploads and deletes are owner-only. Financial fields are redacted for roles without `financials.view`. Auth passwords are managed only by Supabase Auth and are never copied into BPRO tables.

The dashboard keeps its flexible records in a versioned JSON state row and uses revision checks to detect concurrent edits. This model suits a small internal team; move to normalized tables and paginated queries before the data volume grows substantially. Database tests do not replace an independent security audit or live access testing.

## Existing features and limits

- XLSX import accepts core tracker fields only; workflow history, assignments, vendor quotes and files need review afterward. Imports do not create Auth users.
- Reports can export CSV and XLSX from current data. Sample/demo data is disabled.
- Step timing uses configured working days, weekly days off and holidays. Escalations are calculated when the dashboard is read; no email/SMS scheduler is included.
- Files are limited to 6 MiB and an extension allowlist. They are private and not malware-scanned. Keep sensitive information out of shared comments.
- Configure and test Supabase database and Storage backups separately. The JSON backup export does not include uploaded files or Auth credentials.

Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The supplied dashboard has no new open-source license; keep the repository private unless redistribution rights are confirmed.
