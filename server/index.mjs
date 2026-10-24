import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Supabase, HttpError } from "./supabase.mjs";
import {
  assert,
  identity,
  ownerOnly,
  need,
  can,
  canRead,
  redact,
} from "./policy.mjs";
import {
  mutate,
  meta,
  visible,
  decorate,
  list,
  dashboard,
  report,
  create,
  dateNow,
} from "./domain.mjs";
const seed = JSON.parse(
  await readFile(new URL("./seed.json", import.meta.url), "utf8"),
);
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const safeFiles = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.js": "app.js",
  "/config.js": "config.js",
  "/vendor/exceljs.min.js": "vendor/exceljs.min.js",
};
const types = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
};
const parseCookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter((x) => x.includes("="))
      .map((x) => {
        const i = x.indexOf("=");
        return [x.slice(0, i).trim(), x.slice(i + 1)];
      }),
  );
function cookies(res, session, secure) {
  const suffix = `; HttpOnly; SameSite=Strict; Path=/${secure ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", [
    `bpro_access=${session?.access_token || ""}; Max-Age=${session?.expires_in || 0}${suffix}`,
    `bpro_refresh=${session?.refresh_token || ""}; Max-Age=${session ? 604800 : 0}${suffix}`,
  ]);
}
async function body(req, limit = 6 * 1024 * 1024) {
  let n = 0;
  const chunks = [];
  for await (const c of req) {
    n += c.length;
    assert(n <= limit, 413, "Request exceeds the size limit.");
    chunks.push(c);
  }
  const buf = Buffer.concat(chunks);
  if (req.headers["content-type"]?.includes("application/octet-stream"))
    return buf;
  try {
    return buf.length ? JSON.parse(buf.toString()) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
const json = (res, data, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};
export function createApp({ env = process.env, db = new Supabase(env) } = {}) {
  const origin = env.APP_ORIGIN || "http://localhost:3000",
    secure = env.COOKIE_SECURE === "true";
  const rates = new Map();
  assert(
    !origin.startsWith("https:") || secure,
    500,
    "HTTPS deployments require COOKIE_SECURE=true.",
  );
  const rate = (key, max, window = 60000) => {
    const now = Date.now();
    if (rates.size > 10000)
      for (const [k, v] of rates) if (v.until < now) rates.delete(k);
    let r = rates.get(key);
    if (!r || r.until < now)
      rates.set(key, (r = { count: 0, until: now + window }));
    assert(++r.count <= max, 429, "Too many requests. Try again shortly.");
  };
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader("Cache-Control", "no-store");
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const url = new URL(req.url, origin),
        p = url.pathname,
        method = req.method;
      if (!p.startsWith("/api/")) {
        assert(method === "GET" || method === "HEAD", 405);
        const file = safeFiles[p];
        assert(file, 404, "Not found.");
        const data = await readFile(publicDir + file);
        res.writeHead(200, { "Content-Type": types[file.split(".").at(-1)] });
        return res.end(method === "HEAD" ? undefined : data);
      }
      const path = p.slice(4);
      rate(req.socket.remoteAddress, 600);
      if (!["GET", "HEAD"].includes(method))
        assert(req.headers.origin === origin, 403, "Untrusted request origin.");
      if (path === "/auth/status" && method === "GET")
        return json(res, {
          needs_setup: false,
          configured: db.configured,
          app_name: "BPRO",
          company_name: "Bombay Hemp Company",
          message: db.configured
            ? "Supabase configured; deployment verification required."
            : "Supabase is not configured.",
        });
      if (path === "/auth/login" && method === "POST") {
        rate("login:" + req.socket.remoteAddress, 10, 15 * 60000);
        const b = await body(req, 20000);
        assert(
          typeof b.username === "string" &&
            b.username.includes("@") &&
            typeof b.password === "string" &&
            b.password.length <= 1024,
          400,
          "Enter your email and password.",
        );
        const session = await db.request("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email: b.username, password: b.password },
        });
        const [stored, profiles, owner] = await Promise.all([
          db.state(),
          db.profiles(),
          db.owner(),
        ]);
        const state = stored?.payload || structuredClone(seed);
        const user = identity(
          session.user,
          profiles.find((p) => p.id === session.user.id),
          owner,
          state.overview.roles,
        );
        cookies(res, session, secure);
        return json(res, { user });
      }
      const cs = parseCookies(req);
      let token = cs.bpro_access;
      let auth;
      try {
        auth = await db.current(token);
      } catch (e) {
        if (e.status !== 401 || !cs.bpro_refresh) throw e;
        const session = await db.request(
          "/auth/v1/token?grant_type=refresh_token",
          { method: "POST", body: { refresh_token: cs.bpro_refresh } },
        );
        token = session.access_token;
        auth = session.user;
        cookies(res, session, secure);
      }
      if (path === "/auth/logout" && method === "POST") {
        cookies(res, null, secure);
        await db
          .request("/auth/v1/logout?scope=local", { method: "POST", token })
          .catch(() => {});
        return json(res, { ok: true });
      }
      const [stored, profiles, owner] = await Promise.all([
        db.state(),
        db.profiles(),
        db.owner(),
      ]);
      const S = stored?.payload || structuredClone(seed);
      const u = identity(
        auth,
        profiles.find((p) => p.id === auth.id),
        owner,
        S.overview.roles,
      );
      S.meta.users = profiles.map((p) => ({
        id: p.id,
        name: p.name || p.email,
        active: p.active,
        role_id: p.role_id,
        role_name:
          S.overview.roles.find((r) => r.id === p.role_id)?.name ||
          "Unassigned",
        poc_type: S.overview.roles.find((r) => r.id === p.role_id)?.poc_type,
      }));
      if (path.startsWith("/admin/")) ownerOnly(u);
      if (path === "/auth/me" && method === "GET")
        return json(res, { user: u });
      if (path === "/auth/change-password" && method === "POST") {
        const b = await body(req, 20000);
        assert(
          typeof b.next === "string" && b.next.length >= 12,
          400,
          "Use at least 12 characters.",
        );
        await db.request("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: { email: auth.email, password: b.current },
        });
        await db.request("/auth/v1/user", {
          method: "PUT",
          token,
          body: { password: b.next },
        });
        return json(res, { ok: true });
      }
      if (path === "/auth/notifications" && method === "GET") {
        const tasks = visible(S, u).flatMap((r) =>
          r.current_steps
            .filter(
              (s) =>
                s.esc_level &&
                (s.esc_level === 2 ? s.esc2_roles : s.esc1_roles)?.includes(
                  u.role_id,
                ),
            )
            .map((s) => ({
              id: `${r.id}-${s.id}`,
              title: `${r.pr_no}: ${s.name}`,
              body: `${s.overdue_days} working days overdue`,
              request_id: r.id,
              created_at: r.updated_at,
              read_at: null,
            })),
        );
        return json(res, { unread: tasks.length, rows: tasks });
      }
      // Escalations are derived alerts; no email or background-delivery claims.
      if (path === "/auth/notifications/read" && method === "POST")
        return json(res, {
          ok: true,
          message: "Alerts clear when the overdue step is resolved.",
        });
      if (method === "GET") {
        let result, m;
        if (path === "/meta") result = meta(S, u);
        else if (path === "/requests") result = list(S, u, url.searchParams);
        else if ((m = path.match(/^\/requests\/(\d+)$/))) {
          const r = S.req[m[1]];
          assert(r && canRead(u, r), 404, "Request not found.");
          visible(S, u);
          result = decorate(r, u);
        } else if (path === "/dashboard")
          result = dashboard(S, u, url.searchParams);
        else if (path === "/tasks")
          result = {
            tasks: visible(S, u).flatMap((r) =>
              r.current_steps
                .filter(
                  (s) =>
                    can(u, "steps.override") ||
                    (can(u, "steps.update") &&
                      s.update_roles.includes(u.role_id)),
                )
                .map((s) => ({
                  ...s,
                  role: "action",
                  step_id: s.id,
                  request_id: r.id,
                  pr_no: r.pr_no,
                  requirement: r.requirement,
                  location: r.location,
                  step_name: s.name,
                  party: s.owner_party,
                  req_delivery_date: r.req_delivery_date,
                  ops_poc_name: r.ops_poc_name,
                  marketing_poc_name: r.marketing_poc_name,
                  can_update: true,
                })),
            ),
          };
        else if (path === "/vendors") {
          need(u, "vendors.view");
          result = {
            rows: S.vendors.rows.map((v) => ({
              ...v,
              ...dashboard(S, {
                ...u,
                perms: [...u.perms, "dashboard.view"],
              }).vendors.find((x) => x.id === v.id),
            })),
          };
        } else if ((m = path.match(/^\/vendors\/(\d+)$/))) {
          need(u, "vendors.view");
          const vendor = S.vendors.rows.find((v) => v.id === Number(m[1]));
          assert(vendor, 404);
          result = {
            vendor,
            rates: vendor.rates || [],
            orders: visible(S, u).filter((r) => r.vendor_id === vendor.id),
            can_see_rates: can(u, "financials.view"),
          };
        } else if (path === "/reports") {
          need(u, "reports.export");
          result = S.reports;
        } else if (path.startsWith("/export/"))
          result = report(S, u, path.slice(8), url.searchParams);
        else if (path === "/admin/overview") {
          const users = await db.listAuthUsers();
          result = {
            ...S.overview,
            request_count: Object.keys(S.req).length,
            demo_count: 0,
            users: users.map((a) => {
              const p = profiles.find((p) => p.id === a.id);
              return {
                ...p,
                id: a.id,
                email: a.email,
                username: a.email,
                name: p?.name || a.email,
                role_name:
                  S.overview.roles.find((r) => r.id === p?.role_id)?.name ||
                  "Unassigned",
                is_owner: a.id === owner,
                last_login: a.last_sign_in_at,
              };
            }),
          };
          result.roles = result.roles.map((r) => ({
            ...r,
            user_count: profiles.filter((p) => p.role_id === r.id).length,
          }));
        } else if (path === "/admin/backup") result = { ...S, profiles };
        else if (path === "/admin/audit")
          result = {
            rows: await db.request(
              "/rest/v1/bpro_audit?select=*&order=created_at.desc&limit=300",
              { admin: true },
            ),
          };
        else if ((m = path.match(/^\/attachments\/(\d+)$/))) {
          const r = Object.values(S.req).find((r) =>
            r.attachments.some((a) => a.id === Number(m[1])),
          );
          assert(r && canRead(u, r), 404);
          const a = r.attachments.find((a) => a.id === Number(m[1]));
          const blob = await db.request(
            "/storage/v1/object/authenticated/bpro-files/" + a.object_path,
            { admin: true, raw: true },
          );
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.orig_name)}`,
            "X-File-Name": encodeURIComponent(a.orig_name),
          });
          return res.end(Buffer.from(await blob.arrayBuffer()));
        } else assert(false, 404, "Route not found.");
        return json(res, redact(result, u));
      }
      const b = await body(req);
      let m;
      if (
        (m = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/)) &&
        method === "PUT"
      ) {
        ownerOnly(u);
        assert(m[1] !== owner, 403, "The primary-owner account is protected.");
        assert(
          profiles.some((p) => p.id === m[1]),
          404,
          "Auth profile not found.",
        );
        assert(
          b.role_id === null ||
            S.overview.roles.some((r) => r.id === b.role_id),
          400,
          "Unknown role.",
        );
        assert(typeof b.active === "boolean");
        await db.request("/rest/v1/rpc/bpro_assign_role", {
          admin: true,
          method: "POST",
          body: {
            target_id: m[1],
            new_role: b.role_id,
            enabled: b.active,
            actor_id: u.id,
          },
        });
        return json(res, { ok: true });
      }
      if (
        (m = path.match(/^\/requests\/(\d+)\/attachments$/)) &&
        method === "POST"
      ) {
        ownerOnly(u);
        const r = S.req[m[1]];
        assert(r, 404);
        assert(
          b instanceof Uint8Array && b.length > 0,
          400,
          "Choose a nonempty file.",
        );
        const name = url.searchParams.get("name");
        assert(name && name.length <= 200 && !/[\x00-\x1f]/.test(name));
        const ext = name.split(".").at(-1).toLowerCase();
        assert(
          ["pdf", "png", "jpg", "jpeg", "webp", "xlsx", "csv", "txt"].includes(
            ext,
          ),
          400,
          "Use PDF, image, spreadsheet, CSV or text files.",
        );
        const object_path = `${r.id}/${randomUUID()}.${ext}`;
        await db.request("/storage/v1/object/bpro-files/" + object_path, {
          method: "POST",
          admin: true,
          body: b,
          headers: {
            "Content-Type": "application/octet-stream",
            "x-upsert": "false",
          },
        });
        S.sequence = (S.sequence || 1000) + 1;
        r.attachments.push({
          id: S.sequence,
          object_path,
          orig_name: name,
          mime: "application/octet-stream",
          size: b.length,
          kind: url.searchParams.get("kind") || "other",
          step_id: Number(url.searchParams.get("step_id")) || null,
          created_at: new Date().toISOString(),
          uploaded_by: u.id,
          uploaded_by_name: u.name,
        });
        try {
          await db.commit(
            stored?.revision || 0,
            S,
            u.id,
            "attachment_uploaded",
          );
        } catch (e) {
          await db
            .request("/storage/v1/object/bpro-files", {
              method: "DELETE",
              admin: true,
              body: { prefixes: [object_path] },
            })
            .catch(() => {});
          throw e;
        }
        return json(res, { ok: true });
      }
      if ((m = path.match(/^\/attachments\/(\d+)$/)) && method === "DELETE") {
        ownerOnly(u);
        const r = Object.values(S.req).find((r) =>
          r.attachments.some((a) => a.id === Number(m[1])),
        );
        assert(r, 404);
        const a = r.attachments.find((a) => a.id === Number(m[1]));
        r.attachments = r.attachments.filter((a) => a.id !== Number(m[1]));
        await db.commit(stored?.revision || 0, S, u.id, "attachment_deleted");
        await db.request("/storage/v1/object/bpro-files", {
          method: "DELETE",
          admin: true,
          body: { prefixes: [a.object_path] },
        });
        return json(res, { ok: true });
      }
      if (path === "/admin/import" && method === "POST") {
        ownerOnly(u);
        assert(
          Array.isArray(b.rows) && b.rows.length <= 10000,
          400,
          "Import a tracker with at most 10,000 rows.",
        );
        const header = b.rows.findIndex(
          (r) =>
            String(r?.[0] || "")
              .toLowerCase()
              .replace(/[^a-z]/g, "") === "prno",
        );
        assert(header >= 0, 400, "The tracker must have PR No. in column A.");
        const hs = b.rows[header].map((h) =>
          String(h || "")
            .toLowerCase()
            .replace(/[^a-z]/g, ""),
        );
        const col = (r, ...names) => {
          const i = hs.findIndex((h) => names.includes(h));
          return i < 0 ? "" : r[i];
        };
        const result = {
          found: 0,
          created: 0,
          skipped: [],
          warnings: [],
          users_created: [],
        };
        for (const row of b.rows.slice(header + 1)) {
          if (!row?.[0]) continue;
          result.found++;
          const pr = String(row[0]);
          if (Object.values(S.req).some((r) => r.pr_no === pr)) {
            result.skipped.push(pr + ": already exists");
            continue;
          }
          const collateral = S.overview.collaterals.find(
              (c) =>
                c.name.toLowerCase() ===
                String(col(row, "collateral", "collateraltype")).toLowerCase(),
            ),
            location = String(col(row, "location", "store"));
          if (!collateral) {
            result.skipped.push(pr + ": collateral not recognized");
            continue;
          }
          const raised = col(row, "raiseddate", "date");
          const raised_date = raised?.$d
            ? raised.$d.slice(0, 10)
            : /^\d{4}-\d{2}-\d{2}/.test(String(raised))
              ? String(raised).slice(0, 10)
              : dateNow();
          try {
            const x = create(S, u, {
              locations: [location],
              collateral_id: collateral.id,
              request_type_id: S.overview.lookups.find(
                (x) => x.type === "request_type" && x.active,
              ).id,
              requirement: String(col(row, "requirement", "description")),
              quantity: String(col(row, "quantity", "qty")),
              raised_date,
            });
            S.req[x.created[0].id].pr_no = pr;
            result.created++;
          } catch (e) {
            result.skipped.push(pr + ": " + e.message);
          }
        }
        result.warnings.push(
          "Only PR No., raised date, location, collateral, requirement and quantity are imported. Review workflow dates and assignments after import. No Auth users are created.",
        );
        await db.commit(stored?.revision || 0, S, u.id, "tracker_imported");
        return json(res, { ok: true, report: result });
      }
      if (path.startsWith("/admin/demo/"))
        throw new HttpError(400, "Sample data is disabled in production.");
      const result = mutate(S, u, method, path, b);
      await db.commit(stored?.revision || 0, S, u.id, method + " " + path);
      json(res, result);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500)
        console.error("BPRO operation failed:", e.constructor.name);
      if (!res.headersSent)
        json(
          res,
          { error: status === 500 ? "An internal error occurred." : e.message },
          status,
        );
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
    console.log("BPRO ready on port " + (process.env.PORT || 3000)),
  );
}
