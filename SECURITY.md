# Security boundaries

All privileged credentials belong only in the Node server environment. Browser requests never carry a Supabase service-role/secret key. Public signup and owner-claim endpoints do not exist. New Auth users are denied access until the owner assigns and enables a role.

The Supabase service key bypasses RLS. The public browser roles are deliberately denied direct state, audit and private-storage access; authorization of application data lives in the same-origin server. Any additional API or Edge Function accessing these tables must independently enforce the same policy. Do not expose the privileged RPCs to authenticated or anon roles.

The owner is a singleton UUID with protected profile and restrictive Auth foreign key. Browser requests cannot alter it. A database operator retains ultimate control, as they do in every database-backed application. For owner recovery, identify and verify the replacement account out of band, back up data, and write an audited migration that temporarily disables only the immutable-owner trigger, replaces the UUID and updates both profiles in one transaction, then reenables protection. Do not add a recovery button, shared password or email-based bypass.

Security-related controls are covered by tests. Deployment still needs HTTPS, host secret management, access logs without cookies/passwords, edge rate limiting, backup/restore drills and periodic dependency review. The app does not claim MFA support, a penetration test or an independent security audit.

Sessions are checked with Supabase Auth on each request and current membership is reloaded. Revoking role access takes effect on the next request. A request that has already passed authorization may finish while an operator changes permissions; sensitive operator actions should account for in-flight requests. Concurrent refreshes can be subject to Supabase's configured refresh-token reuse policy; validate this with your real Auth project.

Uploaded files have a 6 MiB limit and an allowlist of extensions. They are downloaded as inert attachments; they are not malware-scanned. Do not treat an allowed extension as proof that a file is safe to open. Storage objects remain private even if the app server is stopped.
