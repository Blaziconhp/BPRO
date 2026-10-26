# Security notes

GitHub Pages contains only static files. The browser uses the Supabase project URL and publishable key, which are public values. It never receives a Supabase secret/service-role key. User passwords and sessions are handled by Supabase Auth; sessions are kept in session storage for the active browser tab.

The production database migration enables RLS and grants authenticated users only the required Postgres RPCs. RPCs derive identity from `auth.uid()`, check current profile and permissions, and enforce the singleton owner UUID. The raw state and audit tables remain unavailable to browser roles. One primary owner controls users, dashboard configuration, audit, imports, backups and file upload/deletion. A non-owner Admin role does not bypass this boundary.

Request visibility and financial redaction are enforced in database read functions, not only in the user interface. Writes use an atomic revision check and database authorization. Private Storage reads are limited by request visibility; only the owner can upload or delete.

The owner UUID is immutable through normal application and database operations. Recovery requires a separately reviewed operator migration after verifying the replacement account and backing up data. Never add an email-based owner fallback, public owner-claim endpoint, password in a BPRO table, or secret key in browser code.

The PGlite tests provide local regression coverage, not a penetration test or proof of production settings. Validate login, role access, file access, Auth redirect configuration, and backup recovery in the chosen project before using business records. Uploaded files are not malware-scanned; an allowed extension does not make a file safe. Do not place confidential values in comments shared with users who can view a request.
