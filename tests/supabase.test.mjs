import test from "node:test";
import assert from "node:assert/strict";
import { Supabase } from "../server/supabase.mjs";
test("modern API keys use apikey header and only user JWTs use bearer", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(opts);
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const db = new Supabase({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "sb_publishable_test",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
    });
    await db.request("/rest/v1/test", { admin: true });
    assert.equal(calls[0].headers.apikey, "sb_secret_test");
    assert.equal(calls[0].headers.Authorization, undefined);
    await db.request("/auth/v1/user", { token: "user.jwt.signature" });
    assert.equal(calls[1].headers.Authorization, "Bearer user.jwt.signature");
    assert.equal(calls[1].headers.apikey, "sb_publishable_test");
  } finally {
    globalThis.fetch = original;
  }
});
test("legacy keys remain compatible", async () => {
  const original = globalThis.fetch;
  let headers;
  globalThis.fetch = async (url, opts) => {
    headers = opts.headers;
    return new Response("{}", { status: 200 });
  };
  try {
    const db = new Supabase({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "legacy.anon.jwt",
      SUPABASE_SERVICE_ROLE_KEY: "legacy.service.jwt",
    });
    await db.request("/rest/v1/test", { admin: true });
    assert.equal(headers.Authorization, "Bearer legacy.service.jwt");
  } finally {
    globalThis.fetch = original;
  }
});
test("wrong password returns a sanitized authentication error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "upstream private diagnostic",
      }),
      { status: 400 },
    );
  try {
    const db = new Supabase({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "sb_publishable_test",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
    });
    await assert.rejects(
      db.request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: {},
      }),
      (e) => e.status === 401 && !e.message.includes("upstream"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
