# Production launch checklist

## GitHub Pages

- [ ] GitHub Pages source is **GitHub Actions**.
- [ ] `pages.yml` finishes successfully after pushing to `main`.
- [ ] `https://blaziconhp.github.io/BPRO/` loads the current release.

## Supabase project `ogtwwviftkmdzckgnphd`

- [ ] Public sign-up is disabled; Site URL and allowed redirects include `https://blaziconhp.github.io`.
- [ ] Existing `bpro` schema and seed migration are confirmed.
- [ ] Reviewed and applied `supabase/migrations/202610260001_static_client_access.sql`.
- [ ] The exact Auth UUID for the primary owner was verified and installed with `supabase/bootstrap-owner.sql`.
- [ ] Owner can sign in and open Admin Console; non-owner roles cannot.
- [ ] A new Auth user appears disabled/unassigned; owner role assignment activates the selected role.
- [ ] Viewer, assigned workflow role, and owner permissions are checked with separate accounts.
- [ ] Request list/detail are scoped correctly; financial values are hidden without `financials.view`.
- [ ] Owner upload/download/delete works; other users cannot upload/delete and only read files for visible requests.
- [ ] Import, reports, CSV/XLSX, backup, workflow requirements and concurrent-edit conflicts are checked.
- [ ] Database and Storage backups are configured and a restore is verified.

No service-role/secret key is required by GitHub Pages. The publishable key in `public/config.js` is public by design. Do not paste passwords or secret keys into the repository.
