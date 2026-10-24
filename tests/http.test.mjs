import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.mjs";
import { fakeDB, OWNER, MEMBER } from "./helpers.mjs";
async function withApp(fn) {
  const db = fakeDB(),
    app = createApp({ env: { APP_ORIGIN: "http://localhost:3000" }, db });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.address().port;
  try {
    await fn(base, db);
  } finally {
    await new Promise((r) => app.close(r));
  }
}
const post = (cookie, body = {}) => ({
  method: "POST",
  headers: {
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
    Cookie: "bpro_access=" + cookie,
  },
  body: JSON.stringify(body),
});
test("anonymous protected API access denied", () =>
  withApp(async (base) =>
    assert.equal((await fetch(base + "/api/requests")).status, 401),
  ));
test("CSRF rejected before mutation", () =>
  withApp(async (base) => {
    const x = post("owner");
    delete x.headers.Origin;
    assert.equal((await fetch(base + "/api/requests", x)).status, 403);
  }));
test("non-owner Admin Console and uploads blocked", () =>
  withApp(async (base, db) => {
    db.profilesList[1].role_id = 1;
    assert.equal(
      (
        await fetch(base + "/api/admin/overview", {
          headers: { Cookie: "bpro_access=member" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/requests/1001/attachments", post("member")))
        .status,
      403,
    );
  }));
test("owner cannot be reassigned or disabled through API", () =>
  withApp(async (base) => {
    const x = post("owner", { role_id: 8, active: false });
    x.method = "PUT";
    assert.equal(
      (await fetch(base + "/api/admin/users/" + OWNER, x)).status,
      403,
    );
  }));
test("profiles cannot self-assign a role", () =>
  withApp(async (base) => {
    const x = post("member", { role_id: 1, active: true });
    x.method = "PUT";
    assert.equal(
      (await fetch(base + "/api/admin/users/" + MEMBER, x)).status,
      403,
    );
  }));
test("login sets HttpOnly strict cookies and exposes no tokens", () =>
  withApp(async (base) => {
    const r = await fetch(
      base + "/api/auth/login",
      post("", { username: "member@example.test", password: "valid-password" }),
    );
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
    const b = await r.json();
    assert(!b.token && !b.access_token);
    assert.equal(b.user.is_owner, false);
  }));
test("refresh rotates server cookies when access expires", () =>
  withApp(async (base) => {
    const r = await fetch(base + "/api/auth/me", {
      headers: { Cookie: "bpro_access=expired; bpro_refresh=refresh" },
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie"), /refreshed/);
  }));
test("viewer request writes denied", () =>
  withApp(async (base) =>
    assert.equal(
      (await fetch(base + "/api/requests", post("member"))).status,
      403,
    ),
  ));
test("secrets and internal sources are never served", () =>
  withApp(async (base) => {
    for (const p of [
      "/.env",
      "/server/seed.json",
      "/server/index.mjs",
      "/../.env",
    ])
      assert.equal((await fetch(base + p)).status, 404);
    const r = await fetch(base + "/");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
    assert(!(await r.text()).includes("service_role"));
  }));
test("unconfigured login cannot silently enter demo mode", async () => {
  const app = createApp({ env: { APP_ORIGIN: "http://localhost:3000" } });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  try {
    const r = await fetch(
      "http://127.0.0.1:" + app.address().port + "/api/auth/status",
    );
    assert.equal((await r.json()).configured, false);
  } finally {
    await new Promise((r) => app.close(r));
  }
});
