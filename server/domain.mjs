import { assert, can, need, ownerOnly, canRead, canEdit } from "./policy.mjs";
export const dateNow = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const done = (s) => ["done", "skipped"].includes(s.status);
const num = (v) => Number(v) || 0;
const avg = (xs) =>
  xs.length
    ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10
    : null;
const median = (xs) => {
  xs = xs.slice().sort((a, b) => a - b);
  return xs.length
    ? (xs[Math.floor((xs.length - 1) / 2)] + xs[Math.floor(xs.length / 2)]) / 2
    : null;
};
export function days(a, b, settings = {}, holidays = []) {
  if (!a || !b) return 0;
  let x = new Date(a + "T12:00:00Z"),
    end = new Date(b + "T12:00:00Z"),
    n = 0;
  for (let i = 0; i < 36600 && x < end; i++) {
    x.setUTCDate(x.getUTCDate() + 1);
    if (
      !(settings.weekly_off || [0]).includes(x.getUTCDay()) &&
      !holidays.some((h) => h.date === x.toISOString().slice(0, 10))
    )
      n++;
  }
  return n;
}
const addDays = (a, n, S) => {
  let d = new Date(a + "T12:00:00Z");
  for (let i = 0; n > 0 && i < 36600; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const key = d.toISOString().slice(0, 10);
    if (
      !(S.overview.settings.weekly_off || [0]).includes(d.getUTCDay()) &&
      !S.overview.holidays.some((h) => h.date === key)
    )
      n--;
  }
  return d.toISOString().slice(0, 10);
};
export function recompute(r, S, today = dateNow()) {
  const st = r.steps,
    first = st.find((s) => !done(s));
  for (const s of st) {
    const prev = st.filter((p) => p.group < s.group);
    s.start_date = prev.length
      ? prev.every(done)
        ? prev
            .map((p) => p.done_date || r.raised_date)
            .sort()
            .at(-1)
        : null
      : r.raised_date;
    s.is_active = !!first && s.group === first.group && r.status === "open";
    s.elapsed =
      s.is_active && s.start_date
        ? days(s.start_date, today, S.overview.settings, S.overview.holidays)
        : null;
    s.tat =
      s.done_date && s.start_date
        ? days(
            s.start_date,
            s.done_date,
            S.overview.settings,
            S.overview.holidays,
          )
        : null;
    const lead = S.overview.collaterals.find((c) => c.id === r.collateral_id);
    const budget =
      s.sla_mode === "lead_time"
        ? lead?.lead_days_max || lead?.lead_days
        : s.sla_days;
    s.due_date =
      s.start_date && budget != null
        ? addDays(s.start_date, num(budget), S)
        : null;
    s.overdue_days =
      s.is_active && s.due_date
        ? days(s.due_date, today, S.overview.settings, S.overview.holidays)
        : 0;
    s.late_by =
      s.done_date && s.due_date
        ? days(
            s.due_date,
            s.done_date,
            S.overview.settings,
            S.overview.holidays,
          )
        : 0;
    s.esc_level =
      s.overdue_days > num(s.esc1_grace_days) + num(s.esc2_after_days)
        ? 2
        : s.overdue_days > num(s.esc1_grace_days)
          ? 1
          : 0;
  }
  if (
    !first &&
    r.status === "open" &&
    S.overview.settings.auto_close_when_complete
  ) {
    r.status = "closed";
    r.closed_date =
      st
        .map((s) => s.done_date)
        .filter(Boolean)
        .sort()
        .at(-1) || today;
  }
  r.current_steps = st.filter((s) => s.is_active);
  r.current_step = r.current_steps[0] || null;
  r.progress = Math.round(
    (100 * st.filter(done).length) / Math.max(st.length, 1),
  );
  r.age = days(
    r.raised_date,
    r.closed_date || today,
    S.overview.settings,
    S.overview.holidays,
  );
  r.delivered_date =
    st.find((s) => s.is_delivery && done(s))?.done_date || null;
  r.actual_dispatch =
    st.find((s) => s.ends_lead_time && done(s))?.done_date || null;
  r.lead_start =
    st.find((s) => s.starts_lead_time && done(s))?.done_date || null;
  r.expected_dispatch = r.lead_start
    ? addDays(
        r.lead_start,
        num(
          S.overview.collaterals.find((c) => c.id === r.collateral_id)
            ?.lead_days_max ||
            S.overview.collaterals.find((c) => c.id === r.collateral_id)
              ?.lead_days,
        ),
        S,
      )
    : null;
  r.production_tat =
    r.lead_start && r.actual_dispatch
      ? days(
          r.lead_start,
          r.actual_dispatch,
          S.overview.settings,
          S.overview.holidays,
        )
      : null;
  r.e2e_tat = r.delivered_date
    ? days(
        r.raised_date,
        r.delivered_date,
        S.overview.settings,
        S.overview.holidays,
      )
    : null;
  r.flags = {
    overdue: r.current_steps.some((s) => s.overdue_days > 0),
    esc_level: Math.max(0, ...r.current_steps.map((s) => s.esc_level)),
    late:
      r.status === "open" &&
      !!r.req_delivery_date &&
      r.req_delivery_date < today,
    at_risk:
      r.status === "open" &&
      !!r.req_delivery_date &&
      days(
        today,
        r.req_delivery_date,
        S.overview.settings,
        S.overview.holidays,
      ) <= 2,
  };
  for (const k of ["issues", "quotes", "comments", "attachments"]) r[k] ||= [];
  r.issue_count = r.issues.length;
  r.open_issue_count = r.issues.filter((i) => i.status === "open").length;
  r.quote_count = r.quotes.length;
  r.comment_count = r.comments.length;
  r.attachment_count = r.attachments.length;
  r.strip = st.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    active: s.is_active,
    party: s.owner_party,
    overdue: s.overdue_days > 0,
  }));
  const v = S.vendors.rows.find((v) => v.id === r.vendor_id);
  r.vendor_name = v?.name || null;
}
export function visible(S, u, q = new URLSearchParams()) {
  let rs = Object.values(S.req).filter((r) => canRead(u, r));
  rs.forEach((r) => recompute(r, S));
  return rs.filter(
    (r) =>
      (!q.get("q") ||
        [r.pr_no, r.requirement, r.location, r.collateral_name, r.vendor_name]
          .join(" ")
          .toLowerCase()
          .includes(q.get("q").toLowerCase())) &&
      [
        "location",
        "collateral_id",
        "vendor_id",
        "marketing_poc_id",
        "ops_poc_id",
      ].every((k) => !q.get(k) || String(r[k]) === q.get(k)) &&
      (!q.get("from") || r.raised_date >= q.get("from")) &&
      (!q.get("to") || r.raised_date <= q.get("to")) &&
      (!q.get("stage") ||
        r.current_steps.some((s) => s.id === num(q.get("stage")))) &&
      (!q.get("unassigned") || !r.ops_poc_id) &&
      (!q.get("mine") ||
        [r.created_by, r.marketing_poc_id, r.ops_poc_id].includes(u.id)),
  );
}
export function decorate(r, u) {
  const v = structuredClone(r);
  v.can_edit = canEdit(u, r);
  v.can_see_financials = can(u, "financials.view");
  v.steps.forEach(
    (s) =>
      (s.can_update =
        can(u, "steps.override") ||
        (can(u, "steps.update") &&
          s.update_roles?.includes(u.role_id) &&
          s.is_active)),
  );
  return v;
}
export function list(S, u, q) {
  let rows = visible(S, u, q),
    counts = { open: 0, on_hold: 0, closed: 0, cancelled: 0 };
  rows.forEach((r) => counts[r.status]++);
  let status = q.get("status");
  if (status)
    rows = rows.filter((r) =>
      status === "active"
        ? ["open", "on_hold"].includes(r.status)
        : r.status === status,
    );
  const f = q.get("flag");
  if (f)
    rows = rows.filter((r) =>
      f === "escalated"
        ? r.flags.esc_level > 0
        : f === "urgent"
          ? r.is_urgent
          : f === "issues"
            ? r.issue_count > 0
            : f === "at_risk"
              ? r.flags.at_risk || r.flags.late
              : r.flags[f],
    );
  const keys = new Set([
    "raised_date",
    "pr_no",
    "req_delivery_date",
    "age",
    "progress",
    "amount",
    "location",
    "requirement",
    "vendor_name",
  ]);
  const key = keys.has(q.get("sort")) ? q.get("sort") : "raised_date",
    dir = q.get("dir") === "asc" ? 1 : -1;
  rows.sort(
    (a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : b.id - a.id) * dir,
  );
  const page = Math.max(1, num(q.get("page")) || 1),
    size = Math.min(500, Math.max(1, num(q.get("size")) || 25));
  return {
    total: rows.length,
    total_all: Object.values(S.req).filter((r) => canRead(u, r)).length,
    page,
    size,
    counts,
    rows: rows.slice((page - 1) * size, page * size).map((r) => decorate(r, u)),
  };
}
function next(S) {
  S.sequence =
    Math.max(S.sequence || 1000, ...Object.values(S.req).map((r) => r.id)) + 1;
  return S.sequence;
}
function fields(b, keys) {
  return Object.fromEntries(
    Object.entries(b).filter(([k]) => keys.includes(k)),
  );
}
const editable = [
  "requirement",
  "material",
  "quantity",
  "dimension",
  "artwork_link",
  "req_delivery_date",
  "remark_marketing",
  "remark_procurement",
  "urgency_reason",
  "raised_date",
  "custom",
  "collateral_id",
  "request_type_id",
  "ops_poc_id",
  "marketing_poc_id",
  "committed_date",
];
function validate(r, S) {
  assert(
    typeof r.requirement === "string" &&
      r.requirement.trim() &&
      r.requirement.length <= 5000,
    400,
    "A requirement is required (maximum 5000 characters).",
  );
  for (const k of ["raised_date", "req_delivery_date", "committed_date"])
    if (r[k])
      assert(
        /^\d{4}-\d{2}-\d{2}$/.test(r[k]) && !isNaN(Date.parse(r[k])),
        400,
        "Use a valid ISO date.",
      );
  const c = S.overview.collaterals.find(
      (c) => c.id === num(r.collateral_id) && c.active,
    ),
    t = S.overview.lookups.find(
      (t) =>
        t.id === num(r.request_type_id) &&
        t.type === "request_type" &&
        t.active,
    );
  assert(c && t, 400, "Choose a valid collateral and request type.");
  r.collateral_id = c.id;
  r.collateral_name = c.name;
  r.request_type_id = t.id;
  r.request_type = t.value;
  r.is_urgent = !!t.meta?.urgent;
  r.min_quotes = num(t.meta?.min_quotes) || 1;
  assert(
    !t.meta?.requires_reason || r.urgency_reason?.trim(),
    400,
    "An urgency reason is required.",
  );
  for (const k of ["ops_poc_id", "marketing_poc_id"])
    if (r[k])
      assert(
        S.meta.users.some((u) => u.id === r[k] && u.active),
        400,
        "Choose an active user.",
      );
  for (const k of ["artwork_link"])
    if (r[k])
      assert(
        /^https?:\/\//i.test(r[k]),
        400,
        "Links must start with https:// or http://.",
      );
}
export function create(S, u, b) {
  need(u, "requests.create");
  assert(
    Array.isArray(b.locations) &&
      b.locations.length > 0 &&
      b.locations.length <= 100,
    400,
    "Choose 1–100 locations.",
  );
  const created = [];
  for (const location of b.locations) {
    assert(
      S.overview.lookups.some(
        (l) => l.type === "location" && l.value === location && l.active,
      ),
      400,
      "Choose a valid location.",
    );
    const id = next(S);
    let group = -1;
    const steps = S.overview.steps
      .filter((s) => s.active)
      .sort((a, b) => a.sort - b.sort)
      .map((s) => {
        if (!s.parallel_with_prev) group++;
        return {
          ...s,
          group,
          status: "pending",
          done_date: null,
          done_by: null,
          remark: "",
        };
      });
    const r = {
      ...fields(b, editable),
      id,
      pr_no: `${S.overview.settings.pr_prefix || "BPRO/PR"}/${String(id).padStart(6, "0")}`,
      location,
      raised_date: b.raised_date || dateNow(),
      status: "open",
      proof_rounds: 0,
      is_demo: false,
      created_by: u.id,
      created_by_name: u.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps,
      quotes: [],
      issues: [],
      attachments: [],
      comments: [],
      activity: [],
      batch_siblings: [],
      vendor_id: null,
    };
    validate(r, S);
    if (steps[0]?.auto_done)
      Object.assign(steps[0], {
        status: "done",
        done_date: r.raised_date,
        done_by: u.id,
        done_by_name: u.name,
      });
    recompute(r, S);
    S.req[id] = r;
    created.push({ id, pr_no: r.pr_no });
  }
  return { created };
}
export function mutate(S, u, method, p, b) {
  if (method === "POST" && p === "/requests") return create(S, u, b);
  let m = p.match(/^\/requests\/(\d+)(?:\/(.*))?$/);
  if (m) {
    const r = S.req[m[1]],
      sub = m[2] || "";
    assert(r && canRead(u, r), 404, "Request not found.");
    if (!sub && method === "PUT") {
      assert(canEdit(u, r), 403, "You can only edit requests assigned to you.");
      Object.assign(r, fields(b, editable));
      validate(r, S);
    } else if (!sub && method === "DELETE") {
      need(u, "requests.delete");
      delete S.req[r.id];
      return { ok: true };
    } else if (sub === "clone" && method === "POST")
      return create(S, u, {
        ...r,
        locations: [r.location],
        raised_date: dateNow(),
      });
    else if (sub === "status" && method === "POST") {
      need(u, "requests.hold");
      assert(canEdit(u, r), 403, "Request is not assigned to you.");
      const status = {
        hold: "on_hold",
        resume: "open",
        reopen: "open",
        cancel: "cancelled",
      }[b.action];
      assert(status);
      assert(b.reason?.trim(), 400, "A reason is required.");
      r.status = status;
      r.status_reason = b.reason;
    } else if (sub === "comments" && method === "POST") {
      need(u, "comments.add");
      assert(b.body?.trim() && b.body.length <= 10000);
      r.comments.push({
        id: next(S),
        body: b.body,
        user_id: u.id,
        user_name: u.name,
        created_at: new Date().toISOString(),
      });
    } else if (sub === "proof-round" && method === "POST") {
      assert(canEdit(u, r), 403);
      r.proof_rounds++;
    } else if (
      /^steps\/\d+\/(complete|skip|undo|date)$/.test(sub) &&
      method === "POST"
    ) {
      const [, sid, act] = sub.split("/"),
        s = r.steps.find((s) => s.id === num(sid));
      assert(s, 404, "Step not found.");
      const override = can(u, "steps.override");
      assert(
        override ||
          (can(u, "steps.update") &&
            s.update_roles.includes(u.role_id) &&
            s.is_active),
        403,
        "Your role cannot update this step.",
      );
      assert(
        override || ["complete"].includes(act),
        403,
        "Only workflow managers can override steps.",
      );
      const date = b.date || dateNow();
      assert(
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          date >= r.raised_date &&
          date <= dateNow(),
        400,
        "Step date must be between raised date and today.",
      );
      if (act === "undo") {
        s.status = "pending";
        s.done_date = null;
        r.status = r.status === "closed" ? "open" : r.status;
      } else if (act === "date") {
        assert(done(s));
        s.done_date = date;
      } else {
        assert(
          override || date === dateNow(),
          403,
          "Backdating requires override access.",
        );
        if (act === "complete") {
          assert(
            !s.req_quotes ||
              r.quotes.filter((q) => q.rate != null).length >= r.min_quotes,
            400,
            "The required vendor quotes are missing.",
          );
          assert(!s.req_vendor || r.vendor_id, 400, "Select a vendor first.");
          assert(
            !s.req_attachment || r.attachments.some((a) => a.step_id === s.id),
            400,
            "The primary owner must upload the required attachment.",
          );
        }
        Object.assign(s, {
          status: act === "skip" ? "skipped" : "done",
          done_date: date,
          done_by: u.id,
          done_by_name: u.name,
          remark: b.remark || "",
        });
      }
    } else if (/^quotes(?:\/\d+(?:\/select)?)?$/.test(sub)) {
      need(u, "quotes.manage");
      need(u, "financials.view");
      const [, id, act] = sub.split("/");
      if (method === "POST" && !id) {
        const v = S.vendors.rows.find(
          (v) => v.id === num(b.vendor_id) && v.active,
        );
        assert(v, 400, "Choose a valid vendor.");
        assert(Number.isFinite(Number(b.rate)) && num(b.rate) >= 0);
        r.quotes.push({
          id: next(S),
          vendor_id: v.id,
          vendor_name: v.name,
          rate: num(b.rate),
          amount: num(b.rate) * num(r.quantity),
          lead_days: num(b.lead_days) || null,
          received_date: b.received_date || dateNow(),
          notes: b.notes || "",
          selected: false,
        });
      } else {
        const q = r.quotes.find((q) => q.id === num(id));
        assert(q, 404, "Quote not found.");
        if (method === "DELETE") {
          assert(
            !q.selected,
            400,
            "Select a replacement before removing the selected quote.",
          );
          r.quotes = r.quotes.filter((q) => q.id !== num(id));
        } else if (method === "POST" && act === "select") {
          r.quotes.forEach((q) => (q.selected = q.id === num(id)));
          Object.assign(r, {
            vendor_id: q.vendor_id,
            rate: q.rate,
            amount: q.amount,
          });
        } else assert(false, 405);
      }
    } else if (/^issues(?:\/\d+)?$/.test(sub)) {
      need(u, "issues.manage");
      const id = num(sub.split("/")[1]);
      if (method === "POST" && !id) {
        const t = S.overview.lookups.find(
          (x) => x.id === num(b.type_id) && x.type === "issue_type",
        );
        assert(t && b.description?.trim());
        if (num(b.cost_impact)) need(u, "financials.view");
        r.issues.push({
          ...fields(b, ["responsible", "description"]),
          type_id: t.id,
          type_name: t.value,
          delay_days: Math.max(0, num(b.delay_days)),
          cost_impact: Math.max(0, num(b.cost_impact)),
          id: next(S),
          status: "open",
          raised_date: dateNow(),
          created_by_name: u.name,
        });
      } else {
        const i = r.issues.find((i) => i.id === id);
        assert(i, 404);
        if (method === "DELETE") r.issues = r.issues.filter((i) => i.id !== id);
        else if (method === "PUT") {
          assert(["open", "resolved"].includes(b.status));
          i.status = b.status;
        } else assert(false, 405);
      }
    } else assert(false, 404, "Route not found.");
    r.updated_at = new Date().toISOString();
    r.activity.unshift({
      id: next(S),
      user_name: u.name,
      action: sub || method,
      created_at: r.updated_at,
      detail: "",
    });
    recompute(r, S);
    return { ok: true };
  }
  if ((m = p.match(/^\/vendors(?:\/(\d+))?(?:\/rates(?:\/(\d+))?)?$/))) {
    need(u, "vendors.manage");
    const v = S.vendors.rows.find((v) => v.id === num(m[1]));
    const isRates = p.includes("/rates");
    if (isRates) {
      need(u, "financials.view");
      assert(v, 404);
      v.rates ||= [];
      if (method === "POST") {
        assert(Number.isFinite(Number(b.rate)) && num(b.rate) >= 0);
        v.rates.push({
          ...fields(b, ["description", "unit"]),
          collateral_id: num(b.collateral_id),
          rate: num(b.rate),
          id: next(S),
        });
      } else if (method === "DELETE")
        v.rates = v.rates.filter((r) => r.id !== num(m[2]));
      else assert(false, 405);
    } else {
      assert(b.name?.trim());
      const data = {
        ...fields(b, [
          "name",
          "contact_person",
          "email",
          "phone",
          "address",
          "gstin",
          "payment_terms",
          "empanelled",
          "notes",
          "active",
        ]),
      };
      if (method === "POST" && !m[1])
        S.vendors.rows.push({ ...data, id: next(S), active: true, rates: [] });
      else if (method === "PUT" && v) Object.assign(v, data);
      else assert(false, 404);
    }
    return { ok: true };
  }
  ownerOnly(u);
  if (p === "/admin/settings" && method === "PUT") {
    const x = fields(b, Object.keys(S.overview.settings));
    if (x.weekly_off)
      assert(
        Array.isArray(x.weekly_off) &&
          x.weekly_off.length < 7 &&
          x.weekly_off.every((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      );
    Object.assign(S.overview.settings, x);
    return { ok: true };
  }
  if (
    (m = p.match(
      /^\/admin\/(roles|steps|collaterals|lookups|fields|holidays)(?:\/([^/]+))?$/,
    ))
  ) {
    const key = m[1] === "fields" ? "custom_fields" : m[1],
      items = S.overview[key],
      id = m[2];
    if (key === "steps" && id === "reorder") {
      assert(
        Array.isArray(b.ids) &&
          b.ids.length === items.length &&
          new Set(b.ids).size === items.length &&
          b.ids.every((id) => items.some((s) => s.id === id)),
      );
      b.ids.forEach((id, i) => (items.find((s) => s.id === id).sort = i));
      return { ok: true };
    }
    const old = items.find(
      (x) => String(key === "holidays" ? x.date : x.id) === id,
    );
    if (key === "roles") {
      assert(!old?.is_system, 403, "The system role is protected.");
      if (method !== "DELETE") {
        const allowed = new Set(
          S.overview.permissions.flatMap((g) => g.items.map((x) => x[0])),
        );
        assert(
          b.name?.trim() &&
            Array.isArray(b.permissions) &&
            b.permissions.every((p) => allowed.has(p)),
        );
      }
    }
    if (method === "DELETE") {
      assert(old, 404);
      if (key === "roles")
        assert(
          !S.meta.users.some((u) => u.role_id === old.id),
          409,
          "Reassign users before deleting a role.",
        );
      if (["steps", "collaterals", "lookups", "custom_fields"].includes(key))
        old.active = 0;
      else items.splice(items.indexOf(old), 1);
    } else if (method === "POST" && !id) {
      const item = {
        ...b,
        id: next(S),
        active: 1,
        is_system: false,
        sort: items.length,
        user_count: 0,
      };
      if (key === "steps")
        Object.assign(item, {
          key: "step_" + item.id,
          update_roles: b.update_roles || [],
          esc1_roles: b.esc1_roles || [],
          esc2_roles: b.esc2_roles || [],
        });
      items.push(item);
      return { ok: true, id: item.id };
    } else if (method === "PUT" && old) {
      const safe = { ...b };
      delete safe.id;
      delete safe.is_system;
      Object.assign(old, safe);
    } else assert(false, 404);
    return { ok: true };
  }
  assert(false, 404, "Route not found.");
}
export function meta(S, u) {
  const lookup = (type) =>
    S.overview.lookups.filter((l) => l.type === type && l.active);
  return {
    ...S.meta,
    settings: {
      ...S.overview.settings,
      urgent_threshold: S.overview.settings.urgent_monthly_review_threshold,
    },
    today: dateNow(),
    steps: S.overview.steps
      .filter((s) => s.active)
      .sort((a, b) => a.sort - b.sort),
    collaterals: S.overview.collaterals.filter((c) => c.active),
    locations: lookup("location"),
    request_types: lookup("request_type"),
    issue_types: lookup("issue_type"),
    cancel_reasons: lookup("cancel_reason"),
    vendors: S.vendors.rows
      .filter((v) => v.active)
      .map((v) => ({
        id: v.id,
        name: v.name,
        active: v.active,
        empanelled: v.empanelled,
      })),
    custom_fields: S.overview.custom_fields.filter((f) => f.active),
    can_see_financials: can(u, "financials.view"),
  };
}
export function dashboard(S, u, q = new URLSearchParams()) {
  need(u, "dashboard.view");
  const rs = visible(S, u, q),
    st = S.overview.steps,
    open = rs.filter((r) => r.status === "open"),
    allSteps = rs.flatMap((r) => r.steps),
    withE = rs.filter((r) => r.e2e_tat != null),
    prod = rs.filter((r) => r.production_tat != null);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const kpis = {
    total: rs.length,
    open: open.length,
    on_hold: rs.filter((r) => r.status === "on_hold").length,
    closed: rs.filter((r) => r.status === "closed").length,
    cancelled: rs.filter((r) => r.status === "cancelled").length,
    overdue: open.filter((r) => r.flags.overdue).length,
    escalated: open.filter((r) => r.flags.esc_level).length,
    at_risk: open.filter((r) => r.flags.at_risk || r.flags.late).length,
    avg_e2e: avg(withE.map((r) => r.e2e_tat)),
    median_e2e: median(withE.map((r) => r.e2e_tat)),
    delivered: withE.length,
    avg_production: avg(prod.map((r) => r.production_tat)),
    urgent: rs.filter((r) => r.is_urgent).length,
    urgent_pct: pct(rs.filter((r) => r.is_urgent).length, rs.length),
    issues: rs.reduce((n, r) => n + r.issues.length, 0),
    open_issues: rs.reduce((n, r) => n + r.open_issue_count, 0),
    avg_proof_rounds: avg(rs.map((r) => r.proof_rounds)),
    spend: rs
      .filter((r) => r.status !== "cancelled")
      .reduce((n, r) => n + num(r.amount), 0),
    issue_cost: rs
      .flatMap((r) => r.issues)
      .reduce((n, i) => n + num(i.cost_impact), 0),
    on_time_dispatch: pct(
      prod.filter((r) => !r.steps.find((s) => s.ends_lead_time)?.late_by)
        .length,
      prod.length,
    ),
    dispatch_judged: prod.length,
    on_time_delivery: pct(
      withE.filter(
        (r) => r.req_delivery_date && r.delivered_date <= r.req_delivery_date,
      ).length,
      withE.filter((r) => r.req_delivery_date).length,
    ),
    delivery_judged: withE.filter((r) => r.req_delivery_date).length,
    qc_on_time: pct(
      allSteps.filter((s) => s.key === "qc" && done(s) && !s.late_by).length,
      allSteps.filter((s) => s.key === "qc" && done(s)).length,
    ),
    qc_judged: allSteps.filter((s) => s.key === "qc" && done(s)).length,
  };
  const pipeline = st.map((s) => ({
    step_id: s.id,
    name: s.name,
    party: s.owner_party,
    count: allSteps.filter((x) => x.id === s.id && x.is_active).length,
    overdue: allSteps.filter(
      (x) => x.id === s.id && x.is_active && x.overdue_days > 0,
    ).length,
  }));
  const step_tat = st
    .filter((s) => !s.auto_done)
    .map((s) => {
      const xs = allSteps.filter((x) => x.id === s.id && x.tat != null),
        waiting = allSteps.filter((x) => x.id === s.id && x.is_active);
      return {
        step_id: s.id,
        name: s.name,
        party: s.owner_party,
        sla_days: s.sla_days,
        sla_mode: s.sla_mode,
        count: xs.length,
        avg: avg(xs.map((x) => x.tat)),
        median: median(xs.map((x) => x.tat)),
        max: xs.length ? Math.max(...xs.map((x) => x.tat)) : null,
        breach_pct: pct(xs.filter((x) => x.late_by > 0).length, xs.length),
        waiting_now: waiting.length,
        avg_waiting_now: avg(waiting.map((x) => x.elapsed)),
      };
    });
  const totalDays = allSteps.reduce((n, s) => n + num(s.tat), 0);
  const party_tat = ["Vendor", "Procurement", "Marketing", "Store"].map((p) => {
    const xs = allSteps.filter((s) => s.owner_party === p && s.tat != null),
      total = xs.reduce((n, s) => n + s.tat, 0);
    return {
      party: p,
      avg_days: avg(xs.map((x) => x.tat)),
      total_days: total,
      requests: rs.filter((r) =>
        r.steps.some((s) => s.owner_party === p && s.tat != null),
      ).length,
      share: pct(total, totalDays),
    };
  });
  const by = (key) =>
    [...new Set(rs.map((r) => r[key]))].filter(Boolean).map((name) => {
      const xs = rs.filter((r) => r[key] === name),
        ps = xs.filter((r) => r.production_tat != null);
      return {
        name,
        count: xs.length,
        open: xs.filter((r) => r.status === "open").length,
        spend: xs.reduce((n, r) => n + num(r.amount), 0),
        avg_production: avg(ps.map((r) => r.production_tat)),
        std_lead: S.overview.collaterals.find((c) => c.name === name)
          ?.lead_days,
        on_time: pct(
          ps.filter((r) => !r.steps.find((s) => s.ends_lead_time)?.late_by)
            .length,
          ps.length,
        ),
      };
    });
  const vendors = S.vendors.rows.map((v) => {
    const xs = rs.filter((r) => r.vendor_id === v.id),
      ps = xs.filter((r) => r.production_tat != null);
    return {
      id: v.id,
      name: v.name,
      orders: xs.length,
      avg_production: avg(ps.map((r) => r.production_tat)),
      on_time: pct(
        ps.filter((r) => !r.steps.find((s) => s.ends_lead_time)?.late_by)
          .length,
        ps.length,
      ),
      judged: ps.length,
      avg_vendor_days: avg(
        xs.map((r) =>
          r.steps
            .filter((s) => s.owner_party === "Vendor")
            .reduce((n, s) => n + num(s.tat), 0),
        ),
      ),
      issues: xs.reduce((n, r) => n + r.issues.length, 0),
      spend: xs.reduce((n, r) => n + num(r.amount), 0),
    };
  });
  const issueGroups = (key) =>
    [...new Set(rs.flatMap((r) => r.issues.map((i) => i[key])))].map((name) => {
      const xs = rs.flatMap((r) => r.issues).filter((i) => i[key] === name);
      return {
        name,
        count: xs.length,
        cost: xs.reduce((n, i) => n + num(i.cost_impact), 0),
      };
    });
  const ongoing = open.map((r) => ({
    ...decorate(r, u),
    step: r.current_step?.name,
    party: r.current_step?.owner_party,
    overdue_days: Math.max(0, ...r.current_steps.map((s) => s.overdue_days)),
    esc_level: r.flags.esc_level,
    ...r.flags,
  }));
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(dateNow() + "T12:00:00Z");
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 11 + i);
    const month = d.toISOString().slice(0, 7),
      xs = rs.filter((r) => r.delivered_date?.startsWith(month));
    return {
      month,
      raised: rs.filter((r) => r.raised_date.startsWith(month)).length,
      delivered: xs.length,
      avg_e2e: avg(xs.map((r) => r.e2e_tat)),
    };
  });
  return {
    generated_for: dateNow(),
    kpis,
    pipeline,
    step_tat,
    party_tat,
    bottleneck:
      step_tat.filter((s) => s.avg != null).sort((a, b) => b.avg - a.avg)[0] ||
      null,
    monthly,
    collateral: by("collateral_name"),
    by_location: by("location"),
    vendors,
    issues: {
      by_type: issueGroups("type_name"),
      by_party: issueGroups("responsible"),
    },
    urgent_by_requester: [...new Set(rs.map((r) => r.created_by_name))].map(
      (name) => {
        const xs = rs.filter((r) => r.created_by_name === name),
          urgent = xs.filter((r) => r.is_urgent).length;
        return {
          name,
          total: xs.length,
          urgent,
          pct: pct(urgent, xs.length),
          flag:
            pct(urgent, xs.length) >
            num(S.overview.settings.urgent_monthly_review_threshold),
        };
      },
    ),
    ageing: [
      [0, 3, "0–3 days"],
      [4, 7, "4–7 days"],
      [8, 14, "8–14 days"],
      [15, Infinity, "15+ days"],
    ].map(([a, b, name]) => ({
      name,
      count: open.filter((r) => r.age >= a && r.age <= b).length,
    })),
    attention: ongoing.filter(
      (r) => r.flags.overdue || r.flags.late || r.flags.at_risk,
    ),
    ongoing,
    data_quality: {
      requests: rs.length,
      with_timing: rs.filter((r) => r.steps.some((s) => s.tat != null)).length,
    },
  };
}
export function report(S, u, type, q) {
  need(u, "reports.export");
  assert(
    S.reports.reports.some((r) => r.key === type),
    404,
    "Unknown report.",
  );
  const rs = visible(S, u, q);
  let rows = rs;
  if (type === "requests")
    rows = rs.map((r) => ({
      ...r,
      ...Object.fromEntries(r.steps.map((s) => [`${s.key}_completed`, s.done_date])),
    }));
  if (type === "steps")
    rows = rs.flatMap((r) =>
      r.steps.map((s) => ({ ...s, pr_no: r.pr_no, location: r.location })),
    );
  if (type === "quotes")
    rows = rs.flatMap((r) => r.quotes.map((s) => ({ ...s, pr_no: r.pr_no })));
  if (type === "issues")
    rows = rs.flatMap((r) => r.issues.map((s) => ({ ...s, pr_no: r.pr_no })));
  if (type === "vendors")
    rows = dashboard(
      S,
      { ...u, perms: [...u.perms, "dashboard.view"] },
      q,
    ).vendors;
  if (type === "overdue")
    rows = rs.filter((r) => r.flags.overdue || r.flags.esc_level);
  if (type === "urgent") rows = rs.filter((r) => r.is_urgent);
  if (type === "summary") {
    const d = dashboard(S, { ...u, perms: [...u.perms, "dashboard.view"] }, q);
    return {
      base: "bpro-summary",
      type,
      app_name: "BPRO",
      sheets: [
        {
          name: "KPIs",
          cols: [
            ["Measure", "measure", 30],
            ["Value", "value", 20],
          ],
          rows: Object.entries(d.kpis).map(([measure, value]) => ({
            measure,
            value:
              !can(u, "financials.view") &&
              ["spend", "issue_cost"].includes(measure)
                ? null
                : value,
          })),
        },
        ...[
          "step_tat",
          "party_tat",
          "collateral",
          "by_location",
          "vendors",
        ].map((k) => ({
          name: k,
          cols: Object.keys(d[k][0] || { name: "" }).map((k) => [k, k, 20]),
          rows: d[k],
        })),
      ],
    };
  }
  const keys = [
    ...new Set(
      rows.flatMap((r) =>
        Object.keys(r).filter((k) => r[k] === null || typeof r[k] !== "object"),
      ),
    ),
  ];
  return {
    base: "bpro-" + type,
    type,
    app_name: "BPRO",
    sheets: [
      {
        name: type,
        cols: keys.map((k) => [k.replaceAll("_", " "), k, 20]),
        rows,
      },
    ],
  };
}
