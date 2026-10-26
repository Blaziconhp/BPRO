import test from "node:test";
import assert from "node:assert/strict";
import {
  identity,
  can,
  ownerOnly,
  redact,
  canEdit,
} from "../server/policy.mjs";
import {
  state,
  seed,
  user,
  owner,
  OWNER,
  MEMBER,
  requestBody,
} from "./helpers.mjs";
import {
  mutate,
  create,
  recompute,
  list,
  dashboard,
  report,
  days,
} from "../server/domain.mjs";
for (const role of seed.overview.roles)
  test("original role preserved: " + role.name, () =>
    assert.deepEqual(
      user(role.id).perms,
      role.permissions.filter(
        (p) => !p.startsWith("admin.") && p !== "audit.view",
      ),
    ),
  );
test("owner derives from immutable UUID, never role or metadata", () => {
  assert.throws(() => ownerOnly(user(1)), { status: 403 });
  assert.equal(owner().is_owner, true);
  assert.equal(user(1).is_owner, false);
});
test("both explicitly listed co-owners receive owner privileges", () => {
  const coOwners = [OWNER, "another-owner-id"];
  const coOwner = identity(
    { id: "another-owner-id", email: "co-owner@example.test" },
    null,
    coOwners,
    seed.overview.roles,
  );
  assert.equal(coOwner.is_owner, true);
  assert.equal(coOwner.role_name, "Co-owner");
  assert.deepEqual(coOwner.perms, ["*"]);
});
test("unassigned and disabled accounts fail closed", () => {
  for (const p of [
    null,
    { active: false, role_id: 1 },
    { active: true, role_id: null },
    { active: true, role_id: 999 },
  ])
    assert.throws(
      () => identity({ id: MEMBER }, p, OWNER, seed.overview.roles),
      { status: 403 },
    );
});
test("viewer cannot mutate requests or enter admin", () => {
  const S = state();
  assert.throws(() => create(S, user(), requestBody()), { status: 403 });
  assert.throws(
    () =>
      mutate(S, user(), "POST", "/admin/roles", { name: "x", permissions: [] }),
    { status: 403 },
  );
});
test("non-owner Admin cannot alter roles", () =>
  assert.throws(
    () =>
      mutate(state(), user(1), "POST", "/admin/roles", {
        name: "x",
        permissions: [],
      }),
    { status: 403 },
  ));
test("financial data recursively redacted", () => {
  const x = {
    amount: 10,
    nested: { rate: 2, spend: 30, issue_cost: 8, cost: 3 },
    quotes: [{ amount: 5, ratecard_rate: 9 }],
  };
  const r = redact(x, user(7));
  assert.equal(r.amount, null);
  assert.equal(r.nested.spend, null);
  assert.equal(r.quotes[0].ratecard_rate, null);
  assert.deepEqual(redact(x, user(4)), x);
});
test("create validates and persists a fresh workflow", () => {
  const S = state(),
    r = create(S, owner(), requestBody());
  assert.equal(r.created.length, 1);
  const x = S.req[r.created[0].id];
  assert.equal(x.steps.length, 12);
  assert.equal(x.steps[0].status, "done");
  assert.equal(x.progress, 8);
  assert.equal(x.is_demo, false);
  assert.equal(x.created_by, OWNER);
  assert.equal(x.quotes.length, 0);
});
test("arbitrary fields cannot grant ownership or replace workflow", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  mutate(S, owner(), "PUT", "/requests/" + id, {
    ...requestBody(),
    created_by: MEMBER,
    steps: [],
    amount: 999999,
    status: "closed",
  });
  assert.equal(S.req[id].created_by, OWNER);
  assert.equal(S.req[id].steps.length, 12);
  assert.equal(S.req[id].amount, undefined);
  assert.equal(S.req[id].status, "open");
});
test("own request editing scope is enforced", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  assert.equal(canEdit(user(7), S.req[id]), false);
  assert.throws(
    () =>
      mutate(S, user(7), "PUT", "/requests/" + id, { requirement: "changed" }),
    { status: 403 },
  );
});
test("step role, quote count, and order checked server-side", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  assert.throws(
    () => mutate(S, user(7), "POST", `/requests/${id}/steps/2/complete`, {}),
    { status: 403 },
  );
  assert.throws(
    () => mutate(S, user(4), "POST", `/requests/${id}/steps/2/complete`, {}),
    { status: 400 },
  );
  assert.throws(
    () => mutate(S, user(4), "POST", `/requests/${id}/steps/8/complete`, {}),
    { status: 403 },
  );
});
test("required attachment cannot be bypassed", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  assert.throws(
    () => mutate(S, owner(), "POST", `/requests/${id}/steps/10/complete`, {}),
    { status: 400 },
  );
});
test("workflow override and undo recompute progress", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  mutate(S, owner(), "POST", `/requests/${id}/steps/2/skip`, {
    remark: "not required",
  });
  assert.equal(S.req[id].progress, 17);
  mutate(S, owner(), "POST", `/requests/${id}/steps/2/undo`, {});
  assert.equal(S.req[id].progress, 8);
});
test("quote selection uses quantity and cannot be deleted while selected", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  mutate(S, user(4), "POST", `/requests/${id}/quotes`, {
    vendor_id: 1,
    rate: 25,
  });
  const q = S.req[id].quotes[0];
  assert.equal(q.amount, 250);
  mutate(S, user(4), "POST", `/requests/${id}/quotes/${q.id}/select`, {});
  assert.equal(S.req[id].amount, 250);
  assert.throws(
    () => mutate(S, user(4), "DELETE", `/requests/${id}/quotes/${q.id}`, {}),
    { status: 400 },
  );
});
test("financial writes rejected for roles without financial access", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  assert.throws(
    () =>
      mutate(S, user(7), "POST", `/requests/${id}/issues`, {
        type_id: 12,
        description: "damage",
        cost_impact: 50,
      }),
    { status: 403 },
  );
});
test("working-day calculation excludes weekly off and holidays", () =>
  assert.equal(
    days("2026-10-17", "2026-10-20", { weekly_off: [0] }, [
      { date: "2026-10-19" },
    ]),
    1,
  ));
test("closed requests do not show active steps", () => {
  const S = state(),
    id = create(S, owner(), requestBody()).created[0].id;
  S.req[id].steps.forEach((s) => {
    s.status = "done";
    s.done_date = "2026-10-21";
  });
  recompute(S.req[id], S);
  assert.equal(S.req[id].status, "closed");
  assert.equal(S.req[id].current_steps.length, 0);
  assert.equal(S.req[id].progress, 100);
});
test("filters and pagination operate on current state", () => {
  const S = state();
  create(S, owner(), requestBody());
  create(S, owner(), { ...requestBody(), requirement: "Other item" });
  assert.equal(list(S, user(), new URLSearchParams("q=signs")).total, 1);
  assert.equal(list(S, user(), new URLSearchParams("size=1")).rows.length, 1);
});
test("dashboard recomputes after changes and never uses sample aggregates", () => {
  const S = state();
  assert.equal(dashboard(S, owner()).kpis.total, 0);
  const id = create(S, owner(), requestBody()).created[0].id;
  assert.equal(dashboard(S, owner()).kpis.total, 1);
  mutate(S, owner(), "DELETE", "/requests/" + id, {});
  assert.equal(dashboard(S, owner()).kpis.total, 0);
});
test("all eight reports produce real data or valid empty workbooks", () => {
  for (const r of seed.reports.reports) {
    const out = report(state(), owner(), r.key, new URLSearchParams());
    assert(out.sheets.length);
    assert(Array.isArray(out.sheets[0].rows));
  }
});
test("unknown writes fail explicitly", () =>
  assert.throws(() => mutate(state(), owner(), "POST", "/admin/unknown", {}), {
    status: 404,
  }));
