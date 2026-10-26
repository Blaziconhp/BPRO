import test from "node:test";
import assert from "node:assert/strict";

const stored = new Map();
globalThis.window = {
  EBO_CONFIG: {
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
};
globalThis.location = { origin: "https://example.github.io" };
globalThis.sessionStorage = {
  getItem: (key) => stored.get(key) || null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};

test("static runtime authenticates with publishable key and exposes owner identity from RPC", async () => {
  const calls = [];
  const ownerId = "11111111-1111-4111-8111-111111111111";
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/token?grant_type=password"))
      return Response.json({ access_token: "user-jwt", refresh_token: "refresh", user: { id: ownerId } });
    if (String(url).endsWith("/auth/v1/user"))
      return Response.json({ id: ownerId, email: "owner@example.test" });
    if (String(url).endsWith("/rpc/bpro_direct_context"))
      return Response.json({ id: ownerId, email: "owner@example.test", name: "Owner", is_owner: true, role_id: 1, role_name: "Primary owner", permissions: [] });
    if (String(url).endsWith("/rpc/bpro_direct_read_snapshot"))
      return Response.json({ revision: 0, payload: { overview: { roles: [] }, req: {}, vendors: { rows: [] }, reports: {}, meta: { users: [] } } });
    return Response.json([]);
  };

  const { directApi } = await import(`../public/direct-runtime.mjs?test=${Date.now()}`);
  const status = await directApi.call("GET", "/auth/status");
  assert.equal(status.configured, true);
  const result = await directApi.call("POST", "/auth/login", { username: "owner@example.test", password: "not-a-real-password" });
  assert.equal(result.user.is_owner, true);
  assert.equal(result.user.is_admin, true);
  for (const { options } of calls) {
    assert.equal(options.headers.apikey, "sb_publishable_test_key");
    assert.equal(JSON.stringify(options.headers).includes("service_role"), false);
    assert.equal(JSON.stringify(options.headers).includes("sb_secret"), false);
  }
});
