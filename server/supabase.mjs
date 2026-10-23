export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export class Supabase {
  constructor(env) {
    this.url = env.SUPABASE_URL?.replace(/\/$/, "");
    this.anon = env.SUPABASE_ANON_KEY;
    this.secret = env.SUPABASE_SERVICE_ROLE_KEY;
  }
  get configured() {
    return !!(
      this.url &&
      this.anon &&
      this.secret &&
      !this.url.includes("YOUR_")
    );
  }
  async request(
    path,
    {
      method = "GET",
      body,
      token,
      admin = false,
      headers = {},
      raw = false,
    } = {},
  ) {
    if (!this.configured)
      throw new HttpError(
        503,
        "Supabase is not configured. Follow README.md to connect a project.",
      );
    let res;
    try {
      res = await fetch(this.url + path, {
        method,
        headers: {
          apikey: admin ? this.secret : this.anon,
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : !(admin ? this.secret : this.anon).startsWith("sb_")
              ? { Authorization: `Bearer ${admin ? this.secret : this.anon}` }
              : {}),
          ...(body !== undefined && !(body instanceof Uint8Array)
            ? { "Content-Type": "application/json" }
            : {}),
          ...headers,
        },
        body:
          body === undefined
            ? undefined
            : body instanceof Uint8Array
              ? body
              : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new HttpError(502, "Supabase is temporarily unavailable.");
    }
    if (!res.ok) {
      // Never forward upstream errors that may contain SQL, credentials, or PII.
      if (
        (res.status === 400 || res.status === 422) &&
        path.startsWith("/auth/v1/token")
      )
        throw new HttpError(
          401,
          "Sign-in failed. Check your email and password, or sign in again.",
        );
      if (
        (res.status === 400 || res.status === 422) &&
        path === "/auth/v1/user"
      )
        throw new HttpError(
          400,
          "Supabase rejected this account update. Check your password policy.",
        );
      if (res.status === 401 || res.status === 403)
        throw new HttpError(
          401,
          "Authentication failed. Please sign in again.",
        );
      if (res.status === 409)
        throw new HttpError(409, "Data changed. Refresh and try again.");
      if (res.status === 429)
        throw new HttpError(429, "Too many attempts. Try again later.");
      throw new HttpError(
        502,
        "Supabase rejected the operation. Check server configuration and migrations.",
      );
    }
    if (raw) return res;
    return res.status === 204 ? null : res.json();
  }
  async current(token) {
    if (!token) throw new HttpError(401, "Please sign in.");
    return this.request("/auth/v1/user", { token });
  }
  async profiles() {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      const rows = await this.request(
        `/rest/v1/bpro_profiles?select=*&order=id&limit=1000&offset=${offset}`,
        { admin: true },
      );
      all.push(...rows);
      if (rows.length < 1000) return all;
    }
  }
  async owner() {
    return (
      await this.request("/rest/v1/bpro_owner?select=user_id", { admin: true })
    )[0]?.user_id;
  }
  async state() {
    return (
      await this.request("/rest/v1/bpro_state?id=eq.1&select=*", {
        admin: true,
      })
    )[0];
  }
  async commit(revision, payload, actor, action) {
    if (Buffer.byteLength(JSON.stringify(payload)) > 6 * 1024 * 1024)
      throw new HttpError(
        413,
        "Application data exceeds 6 MiB. Archive records or migrate to normalized tables before adding more data.",
      );
    const saved = await this.request("/rest/v1/rpc/bpro_commit", {
      method: "POST",
      admin: true,
      body: {
        expected_revision: revision,
        new_payload: payload,
        actor_id: actor,
        action_name: action,
      },
    });
    if (!saved)
      throw new HttpError(
        409,
        "Another user saved changes. Refresh and retry.",
      );
  }
  async listAuthUsers() {
    const all = [];
    for (let page = 1; ; page++) {
      const r = await this.request(
        `/auth/v1/admin/users?page=${page}&per_page=100`,
        { admin: true },
      );
      all.push(...r.users);
      if (r.users.length < 100) return all;
    }
  }
}
