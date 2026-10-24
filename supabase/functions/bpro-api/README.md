# BPRO Edge Function

This function adapts the validated BPRO API routes in `server/index.mjs` to Supabase Edge Functions. It enforces the configured Pages origin, uses BPRO role and owner checks, and keeps the Supabase secret key on the server. Browser sessions use short-lived access and refresh tokens in tab session storage because GitHub Pages and Supabase are separate sites and browsers may block cross-site cookies.

The GitHub integration reads `supabase/config.toml` and deploys this function with gateway JWT verification disabled. The handler still requires Supabase Auth for every protected request and validates the bearer token with Supabase Auth.

In the Supabase Dashboard, open **Edge Functions → Secrets** and set:

```sh
SUPABASE_URL=https://ogtwwviftkmdzckgnphd.supabase.co
SUPABASE_PUBLISHABLE_KEY=<project publishable key>
SUPABASE_SECRET_KEY=<rotated project secret key>
ALLOWED_ORIGIN=https://blaziconhp.github.io
```

The secret key must be rotated because its previous value was posted in chat. Add the replacement only in Supabase Edge Function secrets. Never commit it or put it in GitHub Pages variables. The JWKS URL is not needed by this function: it verifies each user token through Supabase Auth's `/auth/v1/user` endpoint.
