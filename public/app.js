(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err2) =>
    function __init() {
      if (err2) throw err2[0];
      try {
        return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
      } catch (e) {
        throw ((err2 = [e]), e);
      }
    };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ../../../home/claude/ebo-web/web/js/ui.js
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props)
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object")
          Object.assign(el.style, v);
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k.startsWith("on") && typeof v === "function")
          el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "value") el.value = v;
        else if (
          k === "checked" ||
          k === "disabled" ||
          k === "selected" ||
          k === "readOnly" ||
          k === "required" ||
          k === "multiple"
        )
          el[k] = !!v;
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }
  function icon(name, size = 18) {
    const ns = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(ns, "svg");
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.9");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", ICONS[name] || ICONS.check);
    s.appendChild(p);
    return s;
  }
  function fmtDate(iso, withYear) {
    if (!iso) return "\u2014";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!y) return "\u2014";
    const cur = /* @__PURE__ */ new Date().getFullYear();
    return `${d} ${MONTHS[m - 1]}${withYear || y !== cur ? " " + y : ""}`;
  }
  function fmtDateTime(s) {
    if (!s) return "";
    const d = /* @__PURE__ */ new Date(String(s).replace(" ", "T") + "Z");
    if (isNaN(d)) return s;
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  function timeAgo(s) {
    const d = /* @__PURE__ */ new Date(String(s).replace(" ", "T") + "Z");
    const sec = (Date.now() - d.getTime()) / 1e3;
    if (sec < 60) return "just now";
    if (sec < 3600) return Math.floor(sec / 60) + " min ago";
    if (sec < 86400) return Math.floor(sec / 3600) + " h ago";
    if (sec < 7 * 86400) return Math.floor(sec / 86400) + " d ago";
    return fmtDate(String(s).slice(0, 10));
  }
  function statusBadge(r) {
    const m = {
      open: ["Open", "brand"],
      on_hold: ["On hold", "warn"],
      closed: ["Closed", "ok"],
      cancelled: ["Cancelled", ""],
    }[r.status] || [r.status, ""];
    return badge(m[0], m[1]);
  }
  function flagBadges(r) {
    const out = [];
    if (r.is_urgent) out.push(badge("Urgent", "bad"));
    if (r.flags && r.flags.esc_level >= 2)
      out.push(badge("Escalated L2", "bad"));
    else if (r.flags && r.flags.esc_level === 1)
      out.push(badge("Escalated", "warn"));
    else if (r.flags && r.flags.overdue) out.push(badge("Overdue", "warn"));
    if (r.flags && r.flags.late) out.push(badge("Past required date", "bad"));
    else if (r.flags && r.flags.at_risk) out.push(badge("At risk", "warn"));
    return out;
  }
  function strip(steps, lg) {
    return h(
      "div",
      {
        class: "strip" + (lg ? " lg" : ""),
        role: "img",
        "aria-label": "Progress through workflow steps",
      },
      steps.map((s) =>
        h("span", {
          class: `seg ${s.status === "done" ? "done" : s.status === "skipped" ? "skipped" : s.active ? "active" : ""} ${s.overdue ? "overdue" : ""}`,
          "data-party": s.party || s.owner_party,
          title: `${s.name}: ${s.status === "done" ? "done" : s.status === "skipped" ? "skipped" : s.active ? "in progress" : "waiting"}`,
        }),
      ),
    );
  }
  function toast(msg, kind = "") {
    if (!toastHost) {
      toastHost = h("div", {
        class: "toasts",
        role: "status",
        "aria-live": "polite",
      });
      document.body.append(toastHost);
    }
    const t = h("div", { class: "toast " + kind }, msg);
    toastHost.append(t);
    setTimeout(() => t.remove(), kind === "bad" ? 6500 : 3200);
  }
  function modal({ title, body, actions, wide, onClose }) {
    const prevFocus = document.activeElement;
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (onClose) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    const footer =
      actions && actions.length
        ? h(
            "div",
            { class: "modal-f" },
            actions.map((a) => {
              const b = h(
                "button",
                { class: "btn " + (a.kind || ""), type: "button" },
                a.label,
              );
              b.addEventListener("click", async () => {
                if (!a.onClick) return close();
                b.disabled = true;
                try {
                  const r = await a.onClick(close, b);
                  if (r === false) b.disabled = false;
                } catch (e) {
                  errToast(e);
                  b.disabled = false;
                }
              });
              return b;
            }),
          )
        : null;
    const overlay = h(
      "div",
      {
        class: "overlay",
        onmousedown: (e) => {
          if (e.target === overlay) close();
        },
      },
      h(
        "div",
        {
          class: "modal" + (wide ? " wide" : ""),
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
        },
        h(
          "div",
          { class: "modal-h" },
          h("h2", null, title),
          h(
            "button",
            {
              class: "btn ghost icon-btn",
              "aria-label": "Close",
              onclick: close,
            },
            icon("x"),
          ),
        ),
        h("div", { class: "modal-b" }, body),
        footer,
      ),
    );
    document.body.append(overlay);
    document.addEventListener("keydown", onKey);
    const first = overlay.querySelector(
      "input:not([type=hidden]), select, textarea",
    );
    if (first) first.focus();
    return close;
  }
  function confirmDialog(title, text, okLabel = "Confirm", kind = "primary") {
    return new Promise((resolve) => {
      let settled = false;
      const fin = (v) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };
      modal({
        title,
        body: h("p", null, text),
        onClose: () => fin(false),
        actions: [
          { label: "Cancel" },
          {
            label: okLabel,
            kind,
            onClick: (close) => {
              fin(true);
              close();
            },
          },
        ],
      });
    });
  }
  function field(label, control, hint, required) {
    return h(
      "div",
      { class: "field" },
      label
        ? h(
            "label",
            null,
            label,
            required ? h("span", { class: "req-star" }, " *") : null,
          )
        : null,
      control,
      hint ? h("div", { class: "hint" }, hint) : null,
    );
  }
  function select(options, value, props = {}) {
    const s = h(
      "select",
      { class: "select", ...props },
      options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return h(
          "option",
          { value: v, selected: String(v) === String(value ?? "") },
          l,
        );
      }),
    );
    return s;
  }
  function tip(el, textFn) {
    el.addEventListener("mousemove", (e) => {
      if (!tipEl) {
        tipEl = h("div", { class: "tip" });
        document.body.append(tipEl);
      }
      tipEl.textContent = typeof textFn === "function" ? textFn() : textFn;
      tipEl.style.display = "block";
      tipEl.style.left =
        Math.min(e.clientX + 14, window.innerWidth - 270) + "px";
      tipEl.style.top = e.clientY + 14 + "px";
    });
    el.addEventListener("mouseleave", () => {
      if (tipEl) tipEl.style.display = "none";
    });
    return el;
  }
  function debounce(fn, ms = 250) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }
  var clear,
    $,
    ICONS,
    MONTHS,
    fmtNum,
    CUR,
    setCurrency,
    fmtMoney,
    days,
    pctTxt,
    todayISO,
    partyDot,
    party,
    badge,
    empty,
    spinner,
    toastHost,
    errToast,
    input,
    textarea,
    checkbox,
    tipEl;
  var init_ui = __esm({
    "../../../home/claude/ebo-web/web/js/ui.js"() {
      clear = (el) => {
        while (el.firstChild) el.removeChild(el.firstChild);
        return el;
      };
      $ = (sel, root2 = document) => root2.querySelector(sel);
      ICONS = {
        dash: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
        list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
        check: "M5 12.5l4.5 4.5L19 7.5",
        task: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9",
        truck:
          "M2 6h12v10H2zM14 10h4l3 3v3h-7M6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
        file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h6",
        bell: "M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0",
        gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z",
        plus: "M12 5v14M5 12h14",
        search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
        download: "M12 3v12M7 10l5 5 5-5M4 20h16",
        upload: "M12 15V3M7 8l5-5 5 5M4 20h16",
        alert:
          "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
        clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
        x: "M6 6l12 12M18 6L6 18",
        menu: "M4 6h16M4 12h16M4 18h16",
        user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
        users:
          "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 3.5a4 4 0 010 7.5M22 21a7 7 0 00-4-6.3",
        edit: "M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16zM14 6l4 4",
        trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
        copy: "M9 9h11v11H9zM5 15H4V4h11v1",
        paperclip:
          "M20 11l-8.5 8.5a5 5 0 01-7-7L13 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L14 7",
        chevron: "M9 6l6 6-6 6",
        moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
        sun: "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
        pause: "M8 5v14M16 5v14",
        refresh:
          "M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4",
        logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
        stamp:
          "M12 3a3 3 0 00-3 3c0 1.7 1 2.5 1 4H6a2 2 0 00-2 2v2h16v-2a2 2 0 00-2-2h-4c0-1.5 1-2.3 1-4a3 3 0 00-3-3zM4 20h16",
        grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
        up: "M12 19V5M6 11l6-6 6 6",
        down: "M12 5v14M18 13l-6 6-6-6",
      };
      MONTHS = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      fmtNum = (n, dp = 1) =>
        n == null
          ? "\u2014"
          : Number(n).toLocaleString("en-IN", { maximumFractionDigits: dp });
      CUR = "\u20B9";
      setCurrency = (c) => {
        CUR = c || "\u20B9";
      };
      fmtMoney = (n) =>
        n == null || n === ""
          ? "\u2014"
          : CUR +
            Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
      days = (n) => (n == null ? "\u2014" : `${fmtNum(n)} d`);
      pctTxt = (n) => (n == null ? "\u2014" : `${fmtNum(n, 0)}%`);
      todayISO = () => /* @__PURE__ */ new Date().toLocaleDateString("en-CA");
      partyDot = (party2) =>
        h("span", { class: "pdot", "data-party": party2 || "" });
      party = (p) =>
        h(
          "span",
          { class: "party", "data-party": p || "" },
          partyDot(p),
          p || "\u2014",
        );
      badge = (text, kind = "") => h("span", { class: "badge " + kind }, text);
      empty = (title, text, action) =>
        h(
          "div",
          { class: "empty" },
          h("b", null, title),
          text ? h("div", null, text) : null,
          action ? h("div", { style: { marginTop: "12px" } }, action) : null,
        );
      spinner = () =>
        h(
          "div",
          { class: "stack" },
          h("div", { class: "skeleton" }),
          h("div", { class: "skeleton", style: { minHeight: "160px" } }),
        );
      errToast = (e) =>
        toast(e && e.message ? e.message : "Something went wrong.", "bad");
      input = (props = {}) => h("input", { class: "input", ...props });
      textarea = (props = {}) => h("textarea", { class: "input", ...props });
      checkbox = (label, checked, props = {}) =>
        h(
          "label",
          { class: "check" },
          h("input", { type: "checkbox", checked, ...props }),
          label,
        );
    },
  });

  // ../../../home/claude/ebo-web/web/js/api.js
  async function rawFetch(method, url, { body, headers = {} } = {}) {
    const h2 = { ...headers };
    try {
      return await fetch(BASE + "/api" + url, {
        method,
        headers: {
          ...h2,
          ...(getToken() ? { Authorization: `Bearer ${getToken().access}`, "X-Bpro-Refresh": getToken().refresh || "" } : {}),
        },
        body,
        credentials: "include",
      });
    } catch (e) {
      throw new ApiError(
        "Cannot reach the server. Check your internet connection and try again. (If this is the first visit in a while, the server may need a few seconds to wake up.)",
        0,
      );
    }
  }
  async function call(method, url, body) {
    if (window.BPRO_DIRECT_API) {
      try { return await window.BPRO_DIRECT_API.call(method, url, body); }
      catch (e) {
        if (e.status === 401 && !url.startsWith("/auth/login")) onUnauthorized();
        throw new ApiError(e.message || "Supabase request failed.", e.status || 500, e.code);
      }
    }
    const headers = {};
    let payload;
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await rawFetch(method, url, { body: payload, headers });
    const nextAccess = res.headers.get("x-bpro-access");
    const nextRefresh = res.headers.get("x-bpro-refresh");
    if (nextAccess && nextRefresh) setToken({ access: nextAccess, refresh: nextRefresh });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await res.json().catch(() => ({}))
      : null;
    if (!res.ok) {
      if (
        res.status === 401 &&
        !url.startsWith("/auth/login") &&
        !url.startsWith("/auth/setup")
      )
        onUnauthorized();
      throw new ApiError(
        (data && data.error) || `Request failed (${res.status}).`,
        res.status,
        data && data.code,
      );
    }
    if (
      data &&
      data.token &&
      (url.startsWith("/auth/login") || url.startsWith("/auth/setup"))
    )
      setToken(data.token);
    if (url.startsWith("/auth/logout")) setToken("");
    return data;
  }
  function saveBlob(blob, name) {
    const go = (href, revoke) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (revoke) URL.revokeObjectURL(href);
        a.remove();
      }, 4e3);
    };
    if (location.protocol === "file:") {
      const fr = new FileReader();
      fr.onload = () => go(fr.result, false);
      fr.readAsDataURL(blob);
    } else go(URL.createObjectURL(blob), true);
  }
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return (excelP ||= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      const inline = document.getElementById("exceljs-b64");
      if (inline) {
        const bin = atob(inline.textContent.trim());
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        s.src = URL.createObjectURL(
          new Blob([u8], { type: "text/javascript" }),
        );
      } else s.src = new URL("vendor/exceljs.min.js", document.baseURI).href;
      s.onload = () => resolve(window.ExcelJS);
      s.onerror = () => {
        excelP = null;
        reject(
          new ApiError(
            "Could not load the Excel library. Check your connection.",
          ),
        );
      };
      document.head.appendChild(s);
    }));
  }
  async function exportReport(url) {
    const u = new URL(url, "http://x");
    const format = u.searchParams.get("format") || "xlsx";
    u.searchParams.delete("format");
    const data = await call("GET", u.pathname + u.search);
    if (format === "csv") {
      const s = data.sheets[0];
      const lines = [s.cols.map((c) => csvCell(c[0])).join(",")].concat(
        s.rows.map((r) => s.cols.map((c) => csvCell(r[c[1]])).join(",")),
      );
      return saveBlob(
        new Blob(["\uFEFF" + lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
        data.base + ".csv",
      );
    }
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = data.app_name || "EBO Tracker";
    wb.created = /* @__PURE__ */ new Date();
    for (const s of data.sheets) {
      const ws = wb.addWorksheet(s.name.slice(0, 31));
      ws.columns = s.cols.map((c) => ({
        header: c[0],
        key: c[1],
        width: c[2] || 14,
      }));
      s.rows.forEach((r) => ws.addRow(r));
      const head = ws.getRow(1);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2F5D46" },
      };
      head.alignment = { vertical: "middle", wrapText: true };
      head.height = 30;
      ws.views = [
        {
          state: "frozen",
          ySplit: 1,
          xSplit: data.type === "requests" ? 1 : 0,
        },
      ];
      if (s.rows.length)
        ws.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: s.cols.length },
        };
    }
    const buf = await wb.xlsx.writeBuffer();
    saveBlob(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      data.base + ".xlsx",
    );
  }
  async function readTrackerGrid(file) {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.getWorksheet("Tracker") || wb.worksheets[0];
    if (!ws) throw new ApiError("No sheet found in this file.");
    const val = (c) => {
      let v = c && c.value;
      if (v instanceof Date) return { $d: v.toISOString() };
      if (v && typeof v === "object") {
        if ("result" in v) v = v.result;
        else if (v.richText) v = v.richText.map((t) => t.text).join("");
        else if (v.text) v = v.text;
        else if (v.error) v = null;
        if (v instanceof Date) return { $d: v.toISOString() };
      }
      return v === void 0 ? null : v;
    };
    const grid = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= 30; c++) cells.push(val(row.getCell(c)));
      grid.push(cells);
    }
    return grid;
  }
  async function download(url) {
    if (url.startsWith("/export/")) return exportReport(url);
    if (url.startsWith("/admin/backup")) {
      const data = await call("GET", url);
      return saveBlob(
        new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }),
        `ebo-backup-${/* @__PURE__ */ new Date().toISOString().slice(0, 10)}.json`,
      );
    }
    return fetchAttachment(url, "save");
  }
  async function fetchAttachment(url, mode, name) {
    const win = mode === "open" ? window.open("", "_blank") : null;
    try {
      if (window.BPRO_DIRECT_API) {
        const file = await window.BPRO_DIRECT_API.fetchAttachment(url);
        if (mode === "open") win.location = URL.createObjectURL(file.blob);
        else saveBlob(file.blob, name || file.name);
        return;
      }
      const res = await rawFetch("GET", url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new ApiError(
          d.error || "Could not download the file.",
          res.status,
        );
      }
      const blob = await res.blob();
      const fname =
        name || decodeURIComponent(res.headers.get("X-File-Name") || "file");
      if (mode === "open") {
        win.location = URL.createObjectURL(blob);
      } else saveBlob(blob, fname);
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  }
  var ApiError,
    BASE,
    TOKEN_KEY,
    memToken,
    getToken,
    setToken,
    onUnauthorized,
    setUnauthorizedHandler,
    api,
    qs,
    excelP,
    csvCell;
  var init_api = __esm({
    "../../../home/claude/ebo-web/web/js/api.js"() {
      ApiError = class extends Error {
        constructor(msg, status, code) {
          super(msg);
          this.status = status;
          this.code = code;
        }
      };
      BASE = String(
        (window.EBO_CONFIG && window.EBO_CONFIG.apiBase) || "",
      ).replace(/\/+$/, "");
      TOKEN_KEY = "bpro_session";
      try { memToken = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null"); } catch { memToken = null; }
      getToken = () => memToken;
      setToken = (value) => {
        if (!value) { memToken = null; sessionStorage.removeItem(TOKEN_KEY); return; }
        if (typeof value === "string") return;
        memToken = { access: value.access, refresh: value.refresh };
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(memToken));
      };
      onUnauthorized = () => {};
      setUnauthorizedHandler = (fn) => {
        onUnauthorized = fn;
      };
      api = {
        get: (url) => call("GET", url),
        post: (url, body) => call("POST", url, body === void 0 ? {} : body),
        put: (url, body) => call("PUT", url, body),
        del: (url) => call("DELETE", url),
        /** Uploads each file in formData('files') as its own request (raw bytes). */
        async upload(url, formData) {
          if (window.BPRO_DIRECT_API) {
            try { return await window.BPRO_DIRECT_API.upload(url, formData); }
            catch (e) { throw new ApiError(e.message || "Upload failed.", e.status || 500, e.code); }
          }
          if (!S2.user?.is_owner)
            throw new ApiError("Only the primary owner can upload files.", 403);
          const files = formData.getAll("files");
          if (!files.length) throw new ApiError("Choose a file to upload.");
          for (const f of files) {
            if (f.size > 6 * 1024 * 1024)
              throw new ApiError(`${f.name} is larger than 6 MB.`);
            const q = new URLSearchParams({ name: f.name, mime: f.type || "" });
            for (const k of ["kind", "step_id"])
              if (formData.get(k)) q.set(k, formData.get(k));
            const res = await rawFetch("POST", `${url}?${q}`, {
              body: f,
              headers: { "Content-Type": "application/octet-stream" },
            });
            if (!res.ok) {
              const d = await res.json().catch(() => ({}));
              throw new ApiError(
                d.error || `Upload failed (${res.status}).`,
                res.status,
              );
            }
          }
          return { ok: true, count: files.length };
        },
      };
      qs = (obj) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(obj))
          if (v !== "" && v != null && v !== false)
            p.set(k, v === true ? "1" : v);
        const s = p.toString();
        return s ? "?" + s : "";
      };
      excelP = null;
      csvCell = (v) => {
        if (v == null) return "";
        const s = /^[=+@\t\r-]/.test(String(v)) ? "\'" + String(v) : String(v);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
    },
  });

  // ../../../home/claude/ebo-web/web/js/state.js
  async function loadMeta() {
    S2.meta = await api.get("/meta");
    setCurrency(S2.meta.settings.currency_symbol);
    return S2.meta;
  }
  var S2, can, canAny, pocUsers;
  var init_state = __esm({
    "../../../home/claude/ebo-web/web/js/state.js"() {
      init_api();
      init_ui();
      S2 = { user: null, meta: null, tasks: 0 };
      can = (perm) =>
        !!S2.user &&
        (perm.startsWith("admin.") ||
        perm === "audit.view" ||
        perm === "uploads.manage"
          ? S2.user.is_owner
          : S2.user.perms.includes("*") || S2.user.perms.includes(perm));
      canAny = (...p) => p.some(can);
      pocUsers = (type) =>
        S2.meta.users.filter((u) => u.active && u.poc_type === type);
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/dashboard.js
  var dashboard_exports = {};
  __export(dashboard_exports, {
    default: () => dashboard_default,
  });
  function hbar({
    label,
    value,
    max,
    party: p,
    text,
    marker,
    onClick,
    tooltip,
    sub,
  }) {
    const pct =
      max > 0 && value != null
        ? Math.max(0, Math.min(100, (value / max) * 100))
        : 0;
    const row = h(
      "div",
      {
        class: "hbar" + (onClick ? " click" : ""),
        "data-party": p || "",
        role: onClick ? "button" : null,
        tabindex: onClick ? 0 : null,
        onclick: onClick,
        onkeydown: onClick
          ? (e) => {
              if (e.key === "Enter") onClick();
            }
          : null,
      },
      h(
        "div",
        { class: "lbl", title: label },
        p ? h("span", { class: "row gap-s" }, partyDot(p), label) : label,
        sub ? h("div", { class: "tiny muted" }, sub) : null,
      ),
      h(
        "div",
        { class: "track" },
        h("div", { class: "fill", style: { width: pct + "%" } }),
        marker != null && max > 0
          ? h("div", {
              class: "marker",
              style: { left: Math.min(100, (marker / max) * 100) + "%" },
              title: "Target",
            })
          : null,
      ),
      h("div", { class: "right num", style: { fontWeight: 620 } }, text),
    );
    if (tooltip) tip(row, tooltip);
    return row;
  }
  function columnsChart(rows2) {
    const W = 640,
      H = 210,
      L = 30,
      B = 26,
      T = 8,
      R = 6;
    const max = Math.max(4, ...rows2.flatMap((r) => [r.raised, r.delivered]));
    const step = Math.ceil(max / 4);
    const top = step * 4;
    const bw = (W - L - R) / rows2.length;
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const svg = sv("svg", {
      viewBox: `0 0 ${W} ${H}`,
      width: "100%",
      role: "img",
      "aria-label": "Requests raised and delivered per month",
    });
    for (let i = 0; i <= 4; i++) {
      const v = i * step;
      svg.append(
        sv("line", {
          x1: L,
          x2: W - R,
          y1: y(v),
          y2: y(v),
          stroke: "var(--line-2)",
        }),
        sv("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }, String(v)),
      );
    }
    rows2.forEach((r, i) => {
      const x0 = L + i * bw + bw * 0.14,
        w = bw * 0.36;
      const g = sv("g");
      g.append(
        sv("rect", {
          x: x0,
          y: y(r.raised),
          width: w,
          height: Math.max(0, H - B - y(r.raised)),
          fill: "var(--ink-3)",
          opacity: 0.55,
          rx: 2,
        }),
        sv("rect", {
          x: x0 + w + 2,
          y: y(r.delivered),
          width: w,
          height: Math.max(0, H - B - y(r.delivered)),
          fill: "var(--brand)",
          rx: 2,
        }),
      );
      const hit = sv("rect", {
        x: L + i * bw,
        y: T,
        width: bw,
        height: H - T - B,
        fill: "transparent",
      });
      tip(
        hit,
        () =>
          `${monthName(r.month)}: ${r.raised} raised, ${r.delivered} delivered`,
      );
      g.append(
        hit,
        sv(
          "text",
          { x: L + i * bw + bw / 2, y: H - 8, "text-anchor": "middle" },
          monthName(r.month, true),
        ),
      );
      svg.append(g);
    });
    return svg;
  }
  function lineChart(rows2, unit) {
    const W = 640,
      H = 170,
      L = 30,
      B = 26,
      T = 10,
      R = 10;
    const vals = rows2.map((r) => r.avg_e2e).filter((v) => v != null);
    if (!vals.length)
      return h(
        "div",
        { class: "muted small", style: { padding: "24px 0" } },
        "No deliveries with recorded dates in this period yet.",
      );
    const top = Math.max(5, Math.ceil(Math.max(...vals) / 5) * 5);
    const bw = (W - L - R) / rows2.length;
    const x = (i) => L + i * bw + bw / 2,
      y = (v) => T + (H - T - B) * (1 - v / top);
    const svg = sv("svg", {
      viewBox: `0 0 ${W} ${H}`,
      width: "100%",
      role: "img",
      "aria-label": "Average end-to-end days by month of delivery",
    });
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i;
      svg.append(
        sv("line", {
          x1: L,
          x2: W - R,
          y1: y(v),
          y2: y(v),
          stroke: "var(--line-2)",
        }),
        sv(
          "text",
          { x: L - 6, y: y(v) + 4, "text-anchor": "end" },
          fmtNum(v, 0),
        ),
      );
    }
    let d = "",
      pen = false;
    rows2.forEach((r, i) => {
      if (r.avg_e2e == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)},${y(r.avg_e2e)} `;
      pen = true;
    });
    svg.append(
      sv("path", {
        d,
        fill: "none",
        stroke: "var(--brand)",
        "stroke-width": 2,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
    rows2.forEach((r, i) => {
      svg.append(
        sv(
          "text",
          { x: x(i), y: H - 8, "text-anchor": "middle" },
          monthName(r.month, true),
        ),
      );
      if (r.avg_e2e == null) return;
      const c = sv("circle", {
        cx: x(i),
        cy: y(r.avg_e2e),
        r: 4.5,
        fill: "var(--brand)",
        stroke: "var(--surface)",
        "stroke-width": 2,
      });
      const hit = sv("circle", {
        cx: x(i),
        cy: y(r.avg_e2e),
        r: 14,
        fill: "transparent",
      });
      tip(
        hit,
        () =>
          `${monthName(r.month)}: ${r.avg_e2e} ${unit} average across ${r.delivered} deliver${r.delivered === 1 ? "y" : "ies"}`,
      );
      svg.append(c, hit);
    });
    return svg;
  }
  function periodRange(p) {
    const t = /* @__PURE__ */ new Date();
    const iso = (d) => d.toLocaleDateString("en-CA");
    if (p === "30") {
      const d = new Date(t);
      d.setDate(d.getDate() - 30);
      return { from: iso(d), to: "" };
    }
    if (p === "90") {
      const d = new Date(t);
      d.setDate(d.getDate() - 90);
      return { from: iso(d), to: "" };
    }
    if (p === "fy") {
      const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
      return { from: `${y}-04-01`, to: "" };
    }
    return { from: "", to: "" };
  }
  async function dashboard_default({ navigate: navigate2 }) {
    if (!can("dashboard.view"))
      return h(
        "div",
        { class: "banner bad" },
        "Your role cannot open the dashboard.",
      );
    const meta = S2.meta,
      fin = meta.can_see_financials;
    const body = h("div", { class: "stack stack-l" });
    const f = persisted;
    const go = (extra) => navigate2("#/requests" + qs(extra));
    async function load() {
      clear(body).append(spinner());
      const r =
        f.period === "custom"
          ? { from: f.from, to: f.to }
          : periodRange(f.period);
      let d;
      try {
        d = await api.get(
          "/dashboard" +
            qs({
              ...r,
              location: f.location,
              collateral_id: f.collateral_id,
              vendor_id: f.vendor_id,
            }),
        );
      } catch (e) {
        clear(body).append(h("div", { class: "banner bad" }, e.message));
        return;
      }
      clear(body).append(...render(d));
    }
    function render(d) {
      const k = d.kpis;
      const out = [];
      if (!k.total) {
        out.push(
          h(
            "div",
            { class: "card" },
            empty(
              "No requests in this period",
              "Widen the date range or clear a filter.",
            ),
          ),
        );
        return out;
      }
      if (
        d.data_quality.with_timing < Math.max(3, d.data_quality.requests * 0.4)
      ) {
        out.push(
          h(
            "div",
            { class: "banner warn" },
            icon("alert", 18),
            h(
              "div",
              { class: "grow" },
              h("b", null, "Turnaround figures are still thin. "),
              `${d.data_quality.with_timing} of ${d.data_quality.requests} requests have step dates. Requests brought over from Excel did not record dates, so the averages fill in as steps are updated here.`,
            ),
            null,
          ),
        );
      }
      const tile = (label, value, sub, o = {}) =>
        h(
          o.href ? "button" : "div",
          {
            class: "kpi " + (o.kind || ""),
            onclick: o.href ? () => go(o.href) : null,
            "aria-label": `${label}: ${value}`,
          },
          h("div", { class: "v" }, value),
          h("div", { class: "l" }, label),
          h("div", { class: "s" }, sub || " "),
        );
      out.push(
        h(
          "div",
          { class: "kpis" },
          tile(
            "Open requests",
            fmtNum(k.open, 0),
            k.on_hold ? `${k.on_hold} on hold` : `${k.total} in this period`,
            { href: { status: "active" } },
          ),
          tile("Overdue", fmtNum(k.overdue, 0), "Past a step's target", {
            kind: k.overdue ? "warn" : "",
            href: { flag: "overdue" },
          }),
          tile(
            "Escalated",
            fmtNum(k.escalated, 0),
            "Past the escalation limit",
            { kind: k.escalated ? "bad" : "", href: { flag: "escalated" } },
          ),
          tile(
            "At risk or late",
            fmtNum(k.at_risk, 0),
            "Against required-by date",
            { kind: k.at_risk ? "warn" : "", href: { flag: "at_risk" } },
          ),
          tile(
            "Avg end to end",
            k.avg_e2e == null ? "\u2014" : fmtNum(k.avg_e2e) + " d",
            k.avg_e2e == null
              ? "No dated deliveries yet"
              : `Median ${fmtNum(k.median_e2e)} d \xB7 ${k.delivered} delivered`,
          ),
          tile(
            "Avg production",
            k.avg_production == null
              ? "\u2014"
              : fmtNum(k.avg_production) + " d",
            "Artwork approval to dispatch",
          ),
          tile(
            "On-time dispatch",
            pctTxt(k.on_time_dispatch),
            k.dispatch_judged
              ? `Within standard lead time \xB7 ${k.dispatch_judged} orders`
              : "Needs dated orders",
          ),
          tile(
            "On-time delivery",
            pctTxt(k.on_time_delivery),
            k.delivery_judged
              ? `By required date \xB7 ${k.delivery_judged} orders`
              : "Needs required-by dates",
          ),
          tile(
            "QC within target",
            pctTxt(k.qc_on_time),
            k.qc_judged ? `${k.qc_judged} QC reports` : "No QC reports yet",
          ),
          tile(
            "Urgent share",
            pctTxt(k.urgent_pct),
            `${k.urgent} urgent request${k.urgent === 1 ? "" : "s"}`,
            { href: { flag: "urgent", status: "" } },
          ),
          tile(
            "Correction rounds",
            k.avg_proof_rounds == null ? "\u2014" : fmtNum(k.avg_proof_rounds),
            "Average artwork rounds per request",
          ),
          tile(
            "Issues logged",
            fmtNum(k.issues, 0),
            `${k.open_issues} still open${fin && k.issue_cost ? " \xB7 " + fmtMoney(k.issue_cost) + " wasted" : ""}`,
            { href: { flag: "issues", status: "" } },
          ),
          fin ? tile("Spend", fmtMoney(k.spend), "Excluding cancelled") : null,
        ),
      );
      const total = d.pipeline.reduce((a, b) => a + b.count, 0);
      out.push(
        card(
          "Where open requests are right now",
          total
            ? `${total} open request${total === 1 ? "" : "s"}. Select a step to see them.`
            : "No open requests.",
          h(
            "div",
            { class: "pipeline" },
            d.pipeline.map((p) =>
              h(
                "button",
                {
                  class: "pstep",
                  "data-party": p.party,
                  onclick: () => go({ stage: p.step_id, status: "active" }),
                },
                h("div", { class: "n" + (p.count ? "" : " zero") }, p.count),
                h("div", { class: "nm" }, p.name),
                p.overdue
                  ? h("div", { class: "od" }, `${p.overdue} overdue`)
                  : h("div", { class: "tiny muted" }, p.party),
              ),
            ),
          ),
        ),
      );
      const tats = d.step_tat;
      const maxT = Math.max(
        1,
        ...tats.map((s) => Math.max(s.avg || 0, s.sla_days || 0)),
      );
      const bn = d.bottleneck;
      const bnCall = bn
        ? h(
            "div",
            { class: "banner", style: { marginBottom: "10px" } },
            icon("clock", 18),
            h(
              "div",
              null,
              h("b", null, `${bn.name} takes longest: `),
              `${fmtNum(bn.avg)} working days on average${bn.sla_days != null ? ` against a target of ${bn.sla_days}` : ""}. This step is owned by ${bn.party}.`,
            ),
          )
        : null;
      out.push(
        h(
          "div",
          { class: "grid g-21" },
          card(
            "Where the time goes",
            "Average working days each step took, from when it became active. The line marks the target.",
            h(
              "div",
              null,
              bnCall,
              tats.length
                ? tats.map((s) =>
                    hbar({
                      label: s.name,
                      p: s.party,
                      party: s.party,
                      value: s.avg,
                      max: maxT,
                      marker: s.sla_days,
                      text: s.avg == null ? "\u2014" : fmtNum(s.avg) + " d",
                      sub:
                        s.breach_pct != null
                          ? `${fmtNum(s.breach_pct, 0)}% late${s.waiting_now ? ` \xB7 ${s.waiting_now} waiting now` : ""}`
                          : s.waiting_now
                            ? `${s.waiting_now} waiting now`
                            : null,
                      tooltip: () =>
                        `${s.name} (${s.party}): average ${s.avg ?? "\u2014"} d, median ${s.median ?? "\u2014"} d, slowest ${s.max ?? "\u2014"} d across ${s.count} completed.${s.sla_days != null ? ` Target ${s.sla_days} d.` : ""}`,
                    }),
                  )
                : empty("No completed steps with dates yet"),
            ),
          ),
          card(
            "Time by owner",
            "Share of all working days spent waiting on each party.",
            d.party_tat.length
              ? h(
                  "div",
                  { class: "stack" },
                  h(
                    "div",
                    {
                      class: "stacked",
                      role: "img",
                      "aria-label": "Share of days by owner",
                    },
                    d.party_tat.map((p) =>
                      tip(
                        h("div", {
                          "data-party": p.party,
                          style: { flex: String(p.total_days) },
                        }),
                        () => `${p.party}: ${p.share}% of days`,
                      ),
                    ),
                  ),
                  d.party_tat.map((p) =>
                    h(
                      "div",
                      { class: "row between" },
                      party(p.party),
                      h(
                        "div",
                        { class: "right num" },
                        h("b", null, pctTxt(p.share)),
                        h(
                          "span",
                          { class: "small muted" },
                          `  ${fmtNum(p.avg_days)} d per request`,
                        ),
                      ),
                    ),
                  ),
                  h(
                    "div",
                    { class: "small muted" },
                    "The biggest share is where a faster hand-off would help most.",
                  ),
                )
              : empty("No dated steps yet"),
          ),
        ),
      );
      out.push(
        h(
          "div",
          { class: "grid g2" },
          card(
            "Needs attention",
            "Overdue, escalated, or at risk against the required date.",
            d.attention.length
              ? h(
                  "div",
                  { class: "table-wrap" },
                  h(
                    "table",
                    { class: "t" },
                    h(
                      "thead",
                      null,
                      h(
                        "tr",
                        null,
                        h("th", null, "Request"),
                        h("th", null, "Stuck at"),
                        h("th", null, "Delay"),
                        h("th", null, "Owner"),
                      ),
                    ),
                    h(
                      "tbody",
                      null,
                      d.attention.map((a) =>
                        h(
                          "tr",
                          {
                            class: "click",
                            onclick: () => {
                              location.hash = "#/requests/" + a.id;
                            },
                          },
                          h(
                            "td",
                            { class: "wrap" },
                            h(
                              "b",
                              null,
                              a.pr_no.split("/").slice(-2).join("/"),
                            ),
                            h("div", { class: "small" }, a.requirement),
                            h("div", { class: "tiny muted" }, a.location || ""),
                          ),
                          h(
                            "td",
                            null,
                            a.step ? party(a.party) : "\u2014",
                            a.step
                              ? h("div", { class: "small" }, a.step)
                              : null,
                          ),
                          h(
                            "td",
                            null,
                            a.late
                              ? badge("Past required date", "bad")
                              : a.overdue_days
                                ? badge(
                                    `${a.overdue_days} d overdue`,
                                    a.esc_level ? "bad" : "warn",
                                  )
                                : badge("At risk", "warn"),
                            a.esc_level
                              ? h(
                                  "div",
                                  {
                                    class: "tiny",
                                    style: { color: "var(--bad)" },
                                  },
                                  `Level ${a.esc_level} escalation`,
                                )
                              : null,
                          ),
                          h(
                            "td",
                            { class: "small" },
                            a.ops_poc_name || "Not assigned",
                          ),
                        ),
                      ),
                    ),
                  ),
                )
              : h(
                  "div",
                  { class: "empty" },
                  h("b", null, "Nothing is stuck"),
                  "No open request is past its targets.",
                ),
          ),
          card(
            "Ongoing projects",
            "Oldest open requests first.",
            d.ongoing.length
              ? h(
                  "div",
                  { class: "table-wrap" },
                  h(
                    "table",
                    { class: "t" },
                    h(
                      "thead",
                      null,
                      h(
                        "tr",
                        null,
                        h("th", null, "Request"),
                        h("th", null, "Now at"),
                        h("th", null, "Age"),
                        h("th", null, "Needed by"),
                      ),
                    ),
                    h(
                      "tbody",
                      null,
                      d.ongoing.map((o) =>
                        h(
                          "tr",
                          {
                            class: "click",
                            onclick: () => {
                              location.hash = "#/requests/" + o.id;
                            },
                          },
                          h(
                            "td",
                            { class: "wrap" },
                            h(
                              "b",
                              null,
                              o.pr_no.split("/").slice(-2).join("/"),
                            ),
                            h("div", { class: "small" }, o.requirement),
                            h(
                              "div",
                              { class: "tiny muted" },
                              [o.location, o.vendor_name]
                                .filter(Boolean)
                                .join(" \xB7 "),
                            ),
                          ),
                          h(
                            "td",
                            null,
                            o.party ? party(o.party) : "\u2014",
                            h("div", { class: "small" }, o.step),
                            h(
                              "div",
                              { class: "tiny muted" },
                              `${o.progress}% done`,
                            ),
                          ),
                          h("td", { class: "num" }, `${o.age} d`),
                          h(
                            "td",
                            { class: "nowrap small" },
                            fmtDate(o.req_delivery_date),
                          ),
                        ),
                      ),
                    ),
                  ),
                )
              : empty("No open requests"),
            h("a", { class: "small", href: "#/requests" }, "See all requests"),
          ),
        ),
      );
      out.push(
        h(
          "div",
          { class: "grid g2" },
          card(
            "Raised and delivered per month",
            "Last 12 months to the end of the period.",
            h(
              "div",
              null,
              columnsChart(d.monthly),
              h(
                "div",
                { class: "legend" },
                h(
                  "span",
                  { class: "row gap-s" },
                  h("span", {
                    class: "pdot",
                    style: { background: "var(--ink-3)", opacity: 0.6 },
                  }),
                  "Raised",
                ),
                h(
                  "span",
                  { class: "row gap-s" },
                  h("span", {
                    class: "pdot",
                    style: { background: "var(--brand)" },
                  }),
                  "Delivered",
                ),
              ),
            ),
          ),
          card(
            "Average end-to-end time",
            "Working days from raised to delivered, by month of delivery.",
            lineChart(d.monthly, "working days"),
          ),
        ),
      );
      const maxC = Math.max(
        1,
        ...d.collateral.map((c) =>
          Math.max(c.avg_production || 0, c.std_lead || 0),
        ),
      );
      out.push(
        h(
          "div",
          { class: "grid g2" },
          card(
            "Production time by collateral",
            "Average artwork-approval-to-dispatch days. The line is the standard lead time.",
            d.collateral.some((c) => c.avg_production != null)
              ? d.collateral
                  .filter((c) => c.avg_production != null || c.count > 1)
                  .slice(0, 12)
                  .map((c) =>
                    hbar({
                      label: c.name,
                      value: c.avg_production,
                      max: maxC,
                      marker: c.std_lead,
                      text:
                        c.avg_production == null
                          ? "\u2014"
                          : fmtNum(c.avg_production) + " d",
                      sub: `${c.count} request${c.count === 1 ? "" : "s"}${c.on_time != null ? ` \xB7 ${fmtNum(c.on_time, 0)}% on time` : ""}`,
                      tooltip: () =>
                        `${c.name}: ${c.avg_production ?? "\u2014"} d average vs ${c.std_lead ?? "\u2014"} d standard`,
                    }),
                  )
              : empty("No dispatched orders with dates yet"),
          ),
          card(
            "Requests by location",
            "All statuses in this period.",
            d.by_location.length
              ? (() => {
                  const mx = Math.max(...d.by_location.map((l) => l.count));
                  return d.by_location
                    .slice(0, 10)
                    .map((l) =>
                      hbar({
                        label: l.name,
                        value: l.count,
                        max: mx,
                        text: String(l.count),
                        sub: `${l.open} open${fin && l.spend ? " \xB7 " + fmtMoney(l.spend) : ""}`,
                        onClick: () =>
                          go({
                            location: l.name === "Not set" ? "" : l.name,
                            status: "",
                          }),
                      }),
                    );
                })()
              : empty("No data"),
          ),
        ),
      );
      out.push(
        card(
          "Vendor scorecard",
          "Orders in this period. Production time and on-time dispatch need dated orders.",
          d.vendors.length
            ? h(
                "div",
                { class: "table-wrap" },
                h(
                  "table",
                  { class: "t" },
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      h("th", null, "Vendor"),
                      h("th", { class: "right" }, "Orders"),
                      h("th", { class: "right" }, "Avg production"),
                      h("th", { class: "right" }, "On-time dispatch"),
                      h("th", { class: "right" }, "Days with vendor"),
                      h("th", { class: "right" }, "Issues"),
                      fin ? h("th", { class: "right" }, "Spend") : null,
                    ),
                  ),
                  h(
                    "tbody",
                    null,
                    d.vendors.map((v) =>
                      h(
                        "tr",
                        {
                          class: "click",
                          onclick: () => go({ vendor_id: v.id, status: "" }),
                        },
                        h("td", null, h("b", null, v.name)),
                        h("td", { class: "right num" }, v.orders),
                        h("td", { class: "right num" }, days(v.avg_production)),
                        h("td", { class: "right num" }, pctTxt(v.on_time)),
                        h(
                          "td",
                          { class: "right num" },
                          days(v.avg_vendor_days),
                        ),
                        h("td", { class: "right num" }, v.issues),
                        fin
                          ? h("td", { class: "right num" }, fmtMoney(v.spend))
                          : null,
                      ),
                    ),
                  ),
                ),
              )
            : empty("No vendor orders yet"),
        ),
      );
      const mxI = Math.max(1, ...d.issues.by_type.map((i) => i.count));
      const mxA = Math.max(1, ...d.ageing.map((a) => a.count));
      out.push(
        h(
          "div",
          { class: "grid g3" },
          card(
            "Issues by type",
            "Mistakes, changes and delays logged.",
            d.issues.by_type.length
              ? [
                  d.issues.by_type
                    .slice(0, 8)
                    .map((i) =>
                      hbar({
                        label: i.name,
                        value: i.count,
                        max: mxI,
                        text: String(i.count),
                        sub: fin && i.cost ? fmtMoney(i.cost) : null,
                      }),
                    ),
                  h("hr", { class: "sep" }),
                  h("div", { class: "small muted" }, "By who was responsible"),
                  h(
                    "div",
                    { class: "row wrap", style: { marginTop: "6px" } },
                    d.issues.by_party.map((p) =>
                      h(
                        "span",
                        { class: "chip", style: { cursor: "default" } },
                        p.name,
                        h("b", null, p.count),
                      ),
                    ),
                  ),
                ]
              : empty("No issues logged"),
          ),
          card(
            "Urgent requests by requester",
            `Reviewed monthly (SOP 10.3). A review flag shows from ${meta.settings.urgent_threshold}% urgent.`,
            d.urgent_by_requester.some((u) => u.total)
              ? h(
                  "table",
                  { class: "t" },
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      h("th", null, "Requester"),
                      h("th", { class: "right" }, "Total"),
                      h("th", { class: "right" }, "Urgent"),
                      h("th", { class: "right" }, "Share"),
                    ),
                  ),
                  h(
                    "tbody",
                    null,
                    d.urgent_by_requester.map((u) =>
                      h(
                        "tr",
                        null,
                        h(
                          "td",
                          null,
                          u.name,
                          u.flag ? [" ", badge("Review", "bad")] : null,
                        ),
                        h("td", { class: "right num" }, u.total),
                        h("td", { class: "right num" }, u.urgent),
                        h("td", { class: "right num" }, pctTxt(u.pct)),
                      ),
                    ),
                  ),
                )
              : empty("No data"),
            can("reports.export")
              ? h(
                  "div",
                  { style: { marginTop: "8px" } },
                  h(
                    "a",
                    { class: "small", href: "#/reports" },
                    "Download the monthly urgent-request list",
                  ),
                )
              : null,
          ),
          card(
            "How long open requests have waited",
            "Working days since each open request was raised.",
            d.ageing.map((a) =>
              hbar({
                label: a.name,
                value: a.count,
                max: mxA,
                text: String(a.count),
              }),
            ),
          ),
        ),
      );
      return out;
    }
    const sel = (key, label, opts) =>
      select([["", label], ...opts], f[key], {
        "aria-label": label,
        style: { width: "auto", maxWidth: "200px" },
        onchange: (e) => {
          f[key] = e.target.value;
          load();
        },
      });
    const periodSel = select(
      [
        ["fy", "This financial year"],
        ["30", "Last 30 days"],
        ["90", "Last 90 days"],
        ["all", "All time"],
        ["custom", "Custom range"],
      ],
      f.period,
      {
        "aria-label": "Period",
        style: { width: "auto" },
        onchange: (e) => {
          f.period = e.target.value;
          customBox.classList.toggle("hidden", f.period !== "custom");
          if (f.period !== "custom") load();
        },
      },
    );
    const customBox = h(
      "div",
      { class: "row gap-s" + (f.period === "custom" ? "" : " hidden") },
      input({
        type: "date",
        value: f.from,
        "aria-label": "From",
        style: { width: "auto" },
        onchange: (e) => {
          f.from = e.target.value;
          load();
        },
      }),
      "to",
      input({
        type: "date",
        value: f.to,
        "aria-label": "To",
        style: { width: "auto" },
        onchange: (e) => {
          f.to = e.target.value;
          load();
        },
      }),
    );
    const bar = h(
      "div",
      { class: "row wrap" },
      periodSel,
      customBox,
      sel(
        "location",
        "All locations",
        meta.locations.filter((l) => l.active).map((l) => [l.value, l.value]),
      ),
      sel(
        "collateral_id",
        "All collaterals",
        meta.collaterals.filter((c) => c.active).map((c) => [c.id, c.name]),
      ),
      sel(
        "vendor_id",
        "All vendors",
        meta.vendors.filter((v) => v.active).map((v) => [v.id, v.name]),
      ),
      h("div", { class: "grow" }),
      can("reports.export")
        ? h(
            "a",
            { class: "btn", href: "#/reports" },
            icon("download", 16),
            "Export reports",
          )
        : null,
    );
    const page = h(
      "div",
      { class: "stack stack-l" },
      h(
        "div",
        { class: "page-head", style: { marginBottom: 0 } },
        h(
          "div",
          null,
          h("h1", null, "Dashboard"),
          h(
            "p",
            null,
            "How procurement is moving, where it slows down, and who is holding it up.",
          ),
        ),
      ),
      bar,
      body,
    );
    load();
    return page;
  }
  var SVG, sv, card, monthName, persisted;
  var init_dashboard = __esm({
    "../../../home/claude/ebo-web/web/js/pages/dashboard.js"() {
      init_ui();
      init_api();
      init_state();
      SVG = "http://www.w3.org/2000/svg";
      sv = (tag, attrs = {}, ...kids) => {
        const e = document.createElementNS(SVG, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        kids
          .flat()
          .forEach(
            (k) =>
              k != null &&
              e.append(k instanceof Node ? k : document.createTextNode(k)),
          );
        return e;
      };
      card = (title, sub, body, right) =>
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-h" },
            h(
              "div",
              null,
              h("h2", null, title),
              sub ? h("div", { class: "small muted" }, sub) : null,
            ),
            right || null,
          ),
          h("div", { class: "card-b" }, body),
        );
      monthName = (m, short) => {
        const [y, mo] = m.split("-").map(Number);
        const n = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ][mo - 1];
        return short ? n : `${n} ${y}`;
      };
      persisted = {
        period: "fy",
        from: "",
        to: "",
        location: "",
        collateral_id: "",
        vendor_id: "",
      };
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/tasks.js
  var tasks_exports = {};
  __export(tasks_exports, {
    default: () => tasks_default,
  });
  async function tasks_default({ navigate: navigate2 }) {
    const { tasks } = await api.get("/tasks");
    const mine = tasks.filter((t) => t.role === "action");
    const watch = tasks.filter((t) => t.role === "watch");
    const host = h("div", { class: "stack" });
    function quick(t) {
      const date = input({ type: "date", value: todayISO(), max: todayISO() });
      const remark = textarea({ rows: 2, placeholder: "Optional note" });
      modal({
        title: `Mark done: ${t.step_name}`,
        body: h(
          "div",
          { class: "stack" },
          h(
            "div",
            { class: "small ink2" },
            `${t.pr_no} \xB7 ${t.requirement}${t.location ? " \xB7 " + t.location : ""}`,
          ),
          field("Completed on", date),
          field("Note", remark),
        ),
        actions: [
          {
            label: "Open request",
            onClick: (close) => {
              close();
              navigate2("#/requests/" + t.request_id);
            },
          },
          {
            label: "Mark done",
            kind: "primary",
            onClick: async (close) => {
              await api.post(
                `/requests/${t.request_id}/steps/${t.step_id}/complete`,
                { date: date.value, remark: remark.value },
              );
              close();
              toast("Done");
              navigate2("#/tasks");
            },
          },
        ],
      });
    }
    const card2 = (t) =>
      h(
        "div",
        {
          class: "card",
          style: {
            padding: "12px 16px",
            boxShadow: "none",
            borderLeft: `4px solid ${t.overdue_days > 0 ? "var(--bad)" : "var(--c-" + (t.owner_party || "other") + ")"}`,
          },
        },
        h(
          "div",
          { class: "row wrap" },
          h(
            "div",
            { class: "grow" },
            h(
              "div",
              { class: "row wrap gap-s" },
              h(
                "a",
                {
                  href: "#/requests/" + t.request_id,
                  style: { fontWeight: 700 },
                },
                t.pr_no.split("/").slice(-2).join("/"),
              ),
              h("b", null, t.requirement),
              t.is_urgent ? badge("Urgent", "bad") : null,
              t.unassigned ? badge("Not assigned", "warn") : null,
            ),
            h(
              "div",
              { class: "small muted" },
              [t.location, t.collateral_name, t.vendor_name]
                .filter(Boolean)
                .join(" \xB7 "),
            ),
            h(
              "div",
              {
                class: "row wrap",
                style: { marginTop: "6px", gap: "6px 16px" },
              },
              h(
                "span",
                { class: "party", "data-party": t.owner_party },
                h("span", { class: "pdot", "data-party": t.owner_party }),
                t.step_name,
              ),
              t.elapsed != null
                ? h(
                    "span",
                    { class: "small muted" },
                    `Waiting ${t.elapsed} working day${t.elapsed === 1 ? "" : "s"}`,
                  )
                : null,
              t.due_date
                ? h(
                    "span",
                    {
                      class: "small",
                      style:
                        t.overdue_days > 0
                          ? { color: "var(--bad)", fontWeight: 650 }
                          : { color: "var(--ink-3)" },
                    },
                    t.overdue_days > 0
                      ? `${t.overdue_days} day${t.overdue_days > 1 ? "s" : ""} overdue`
                      : `Due ${fmtDate(t.due_date)}`,
                  )
                : null,
              t.req_delivery_date
                ? h(
                    "span",
                    { class: "small muted" },
                    `Needed by ${fmtDate(t.req_delivery_date)}`,
                  )
                : null,
            ),
          ),
          h(
            "div",
            { class: "row gap-s" },
            t.role === "action" && t.can_update
              ? h(
                  "button",
                  { class: "btn primary sm", onclick: () => quick(t) },
                  icon("check", 14),
                  "Mark done",
                )
              : null,
            h(
              "a",
              { class: "btn sm", href: "#/requests/" + t.request_id },
              "Open",
            ),
          ),
        ),
      );
    host.append(
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          null,
          h("h1", null, "My tasks"),
          h(
            "p",
            null,
            mine.length
              ? `${mine.length} step${mine.length > 1 ? "s" : ""} waiting for you.`
              : "Nothing is waiting for you right now.",
          ),
        ),
      ),
      mine.length
        ? h("div", { class: "stack" }, mine.map(card2))
        : h(
            "div",
            { class: "card" },
            empty(
              "You are all caught up",
              "New steps appear here the moment the previous step is done.",
              can("requests.create")
                ? h(
                    "a",
                    { class: "btn primary", href: "#/new" },
                    "Raise a request",
                  )
                : null,
            ),
          ),
      watch.length
        ? h(
            "div",
            { class: "stack" },
            h(
              "div",
              null,
              h("h2", null, "Waiting on others"),
              h(
                "p",
                { class: "small muted" },
                "Your requests where the next step belongs to someone else.",
              ),
            ),
            watch.map(card2),
          )
        : null,
    );
    return host;
  }
  var init_tasks = __esm({
    "../../../home/claude/ebo-web/web/js/pages/tasks.js"() {
      init_ui();
      init_api();
      init_state();
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/requests.js
  var requests_exports = {};
  __export(requests_exports, {
    default: () => requests_default,
    stageCell: () => stageCell,
  });
  function stageCell(r) {
    if (r.status === "closed")
      return h("span", { class: "muted" }, "Completed");
    if (r.status === "cancelled")
      return h("span", { class: "muted" }, "Cancelled");
    if (r.status === "on_hold") return badge("On hold", "warn");
    const cs = r.current_steps && r.current_steps[0];
    if (!cs) return h("span", { class: "muted" }, "\u2014");
    const more =
      r.current_steps.length > 1 ? ` +${r.current_steps.length - 1}` : "";
    return h(
      "div",
      null,
      h(
        "div",
        { class: "party", "data-party": cs.owner_party },
        h("span", { class: "pdot", "data-party": cs.owner_party }),
        cs.name + more,
      ),
      h(
        "div",
        {
          class: "tiny " + (cs.overdue_days > 0 ? "" : "muted"),
          style:
            cs.overdue_days > 0
              ? { color: "var(--bad)", fontWeight: 650 }
              : null,
        },
        cs.overdue_days > 0
          ? `${cs.overdue_days} working day${cs.overdue_days > 1 ? "s" : ""} overdue`
          : cs.elapsed != null
            ? `${cs.elapsed} working day${cs.elapsed === 1 ? "" : "s"} so far`
            : "Waiting on " + cs.owner_party,
      ),
    );
  }
  async function requests_default({ query }) {
    const meta = S2.meta;
    const f = {
      q: query.q || "",
      status: query.status || "active",
      location: query.location || "",
      collateral_id: query.collateral_id || "",
      vendor_id: query.vendor_id || "",
      stage: query.stage || "",
      flag: query.flag || "",
      mine: query.mine || "",
      unassigned: query.unassigned || "",
      sort: query.sort || "raised_date",
      dir: query.dir || "desc",
      page: Number(query.page) || 1,
      marketing_poc_id: query.marketing_poc_id || "",
      ops_poc_id: query.ops_poc_id || "",
      from: query.from || "",
      to: query.to || "",
    };
    const fin = meta.can_see_financials;
    const host = h("div", { class: "stack" });
    const tabsEl = h("div", { class: "tabs", role: "tablist" });
    const filtersEl = h("div", { class: "row wrap" });
    const tableCard = h("div", { class: "card" });
    let counts = {};
    const syncUrl = () =>
      history.replaceState(
        null,
        "",
        "#/requests" +
          qs({
            ...f,
            page: f.page > 1 ? f.page : "",
            status: f.status === "active" ? "" : f.status,
            sort: f.sort === "raised_date" ? "" : f.sort,
            dir: f.dir === "desc" ? "" : f.dir,
          }),
      );
    async function load() {
      syncUrl();
      clear(tableCard).append(
        h("div", {
          class: "skeleton",
          style: { minHeight: "260px", border: 0 },
        }),
      );
      let data;
      try {
        data = await api.get("/requests" + qs({ ...f, size: 25 }));
      } catch (e) {
        clear(tableCard).append(h("div", { class: "banner bad" }, e.message));
        return;
      }
      counts = data.counts;
      drawTabs();
      drawTable(data);
    }
    function drawTabs() {
      const act = (counts.open || 0) + (counts.on_hold || 0);
      const items = [
        ["active", "Active", act],
        ["closed", "Closed", counts.closed || 0],
        ["cancelled", "Cancelled", counts.cancelled || 0],
        ["", "All", act + (counts.closed || 0) + (counts.cancelled || 0)],
      ];
      clear(tabsEl).append(
        ...items.map(([k, l, n]) =>
          h(
            "button",
            {
              class: "tab" + (f.status === k ? " on" : ""),
              role: "tab",
              onclick: () => {
                f.status = k;
                f.page = 1;
                load();
              },
            },
            l,
            h("span", { class: "n" }, n),
          ),
        ),
      );
    }
    function th(label, key) {
      const on = f.sort === key;
      return h(
        "th",
        {
          class: key ? "sort" : "",
          "aria-sort": on
            ? f.dir === "asc"
              ? "ascending"
              : "descending"
            : null,
          onclick: key
            ? () => {
                if (on) f.dir = f.dir === "asc" ? "desc" : "asc";
                else {
                  f.sort = key;
                  f.dir =
                    key === "raised_date" || key === "age" || key === "amount"
                      ? "desc"
                      : "asc";
                }
                f.page = 1;
                load();
              }
            : null,
        },
        label,
        on ? (f.dir === "asc" ? " \u2191" : " \u2193") : "",
      );
    }
    function drawTable(data) {
      clear(tableCard);
      if (!data.rows.length) {
        tableCard.append(
          empty(
            data.total_all
              ? "No requests match these filters"
              : "No requests yet",
            data.total_all
              ? "Clear a filter or change the tab above."
              : "Raise the first request to start tracking it here.",
            data.total_all
              ? h(
                  "button",
                  {
                    class: "btn",
                    onclick: () => {
                      Object.assign(f, {
                        q: "",
                        location: "",
                        collateral_id: "",
                        vendor_id: "",
                        stage: "",
                        flag: "",
                        mine: "",
                        unassigned: "",
                        page: 1,
                        marketing_poc_id: "",
                        ops_poc_id: "",
                        from: "",
                        to: "",
                      });
                      buildFilters();
                      load();
                    },
                  },
                  "Clear filters",
                )
              : can("requests.create")
                ? h("a", { class: "btn primary", href: "#/new" }, "New request")
                : null,
          ),
        );
        return;
      }
      const rows2 = data.rows.map((r) =>
        h(
          "tr",
          {
            class: "click",
            tabindex: 0,
            onclick: () => {
              location.hash = "#/requests/" + r.id;
            },
            onkeydown: (e) => {
              if (e.key === "Enter") location.hash = "#/requests/" + r.id;
            },
          },
          h(
            "td",
            { class: "pr" },
            r.pr_no.replace(/^.*?\/(\d\d-\d\d)\//, "$1/"),
            r.is_demo ? h("div", { class: "tiny muted" }, "Sample") : null,
          ),
          h(
            "td",
            { class: "wrap" },
            h("div", { style: { fontWeight: 620 } }, r.requirement),
            h(
              "div",
              { class: "small muted" },
              [r.collateral_name, r.quantity ? "Qty " + r.quantity : ""]
                .filter(Boolean)
                .join(" \xB7 "),
            ),
            h(
              "div",
              { class: "row wrap gap-s", style: { marginTop: "3px" } },
              flagBadges(r),
            ),
          ),
          h("td", { class: "small" }, r.location || "\u2014"),
          h("td", { class: "nowrap" }, fmtDate(r.raised_date)),
          h("td", { class: "nowrap" }, fmtDate(r.req_delivery_date)),
          h("td", null, stageCell(r)),
          h(
            "td",
            { style: { minWidth: "150px" } },
            strip(r.strip),
            h(
              "div",
              { class: "tiny muted", style: { marginTop: "3px" } },
              `${r.progress}% \xB7 ${r.status === "open" || r.status === "on_hold" ? "age " + r.age + " d" : statusBadgeText(r)}`,
            ),
          ),
          h(
            "td",
            { class: "small" },
            r.vendor_name || h("span", { class: "muted" }, "\u2014"),
            fin && r.amount != null
              ? h("div", { class: "muted num" }, fmtMoney(r.amount))
              : null,
          ),
          h(
            "td",
            { class: "small nowrap" },
            r.marketing_poc_name || "\u2014",
            h(
              "div",
              { class: "muted" },
              r.ops_poc_name ||
                h("span", { style: { color: "var(--warn)" } }, "Not assigned"),
            ),
          ),
        ),
      );
      const pages2 = Math.max(1, Math.ceil(data.total / data.size));
      tableCard.append(
        h(
          "div",
          { class: "table-wrap" },
          h(
            "table",
            { class: "t" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                th("PR no.", "pr_no"),
                th("Requirement", "requirement"),
                th("Location", "location"),
                th("Raised", "raised_date"),
                th("Required by", "req_delivery_date"),
                th("Stage", "stage"),
                th("Progress", "progress"),
                th(fin ? "Vendor / amount" : "Vendor", "vendor"),
                th("POC (Mktg / Ops)"),
              ),
            ),
            h("tbody", null, rows2),
          ),
        ),
        h(
          "div",
          { class: "pager" },
          h(
            "span",
            { class: "small muted" },
            `${(data.page - 1) * data.size + 1}\u2013${Math.min(data.page * data.size, data.total)} of ${data.total}`,
          ),
          h(
            "div",
            { class: "row gap-s" },
            h(
              "button",
              {
                class: "btn sm",
                disabled: data.page <= 1,
                onclick: () => {
                  f.page--;
                  load();
                },
              },
              "Previous",
            ),
            h("span", { class: "small" }, `Page ${data.page} of ${pages2}`),
            h(
              "button",
              {
                class: "btn sm",
                disabled: data.page >= pages2,
                onclick: () => {
                  f.page++;
                  load();
                },
              },
              "Next",
            ),
          ),
        ),
      );
    }
    const statusBadgeText = (r) =>
      r.status === "closed" ? "closed" : "cancelled";
    function buildFilters() {
      const reload = () => {
        f.page = 1;
        load();
      };
      const search = input({
        type: "search",
        placeholder: "Search requests",
        value: f.q,
        "aria-label": "Search requests",
        style: { width: "220px" },
        oninput: debounce((e) => {
          f.q = e.target.value.trim();
          reload();
        }, 300),
      });
      const sel = (key, label, opts) => {
        const s = select([["", label], ...opts], f[key], {
          "aria-label": label,
          style: { width: "auto", maxWidth: "190px" },
          onchange: (e) => {
            f[key] = e.target.value;
            reload();
          },
        });
        return s;
      };
      clear(filtersEl).append(
        search,
        sel(
          "location",
          "All locations",
          meta.locations.filter((l) => l.active).map((l) => [l.value, l.value]),
        ),
        sel(
          "collateral_id",
          "All collaterals",
          meta.collaterals.filter((c) => c.active).map((c) => [c.id, c.name]),
        ),
        sel(
          "vendor_id",
          "All vendors",
          meta.vendors.filter((v) => v.active).map((v) => [v.id, v.name]),
        ),
        sel(
          "stage",
          "Any stage",
          meta.steps.map((s) => [s.id, s.name]),
        ),
        h(
          "div",
          { class: "chips" },
          h(
            "button",
            {
              class: "chip" + (f.mine ? " on" : ""),
              onclick: () => {
                f.mine = f.mine ? "" : "1";
                buildFilters();
                reload();
              },
            },
            "Mine",
          ),
          FLAGS.map(([k, l]) =>
            h(
              "button",
              {
                class: "chip" + (f.flag === k ? " on" : ""),
                onclick: () => {
                  f.flag = f.flag === k ? "" : k;
                  buildFilters();
                  reload();
                },
              },
              l,
            ),
          ),
          f.unassigned
            ? h(
                "button",
                {
                  class: "chip on",
                  onclick: () => {
                    f.unassigned = "";
                    buildFilters();
                    reload();
                  },
                },
                "Not assigned",
                h("span", { class: "x" }, "\xD7"),
              )
            : null,
        ),
      );
    }
    buildFilters();
    const exportBtns = can("reports.export")
      ? h(
          "div",
          { class: "row gap-s" },
          h(
            "button",
            {
              class: "btn",
              onclick: () =>
                download(
                  "/export/requests" +
                    qs({ ...f, format: "xlsx", status: void 0, page: void 0 }),
                ).catch(errToast),
            },
            icon("download", 16),
            "Excel",
          ),
          h(
            "button",
            {
              class: "btn",
              onclick: () =>
                download(
                  "/export/requests" +
                    qs({ ...f, format: "csv", page: void 0 }),
                ).catch(errToast),
            },
            "CSV",
          ),
        )
      : null;
    host.append(
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          null,
          h("h1", null, "Requests"),
          h(
            "p",
            null,
            "Every procurement request, where it is now, and who it is waiting on.",
          ),
        ),
        h(
          "div",
          { class: "row gap-s" },
          exportBtns,
          can("requests.create")
            ? h(
                "a",
                { class: "btn primary", href: "#/new" },
                icon("plus", 16),
                "New request",
              )
            : null,
        ),
      ),
      h(
        "div",
        { class: "card" },
        tabsEl,
        h(
          "div",
          {
            style: {
              padding: "12px 14px",
              borderBottom: "1px solid var(--line-2)",
            },
          },
          filtersEl,
        ),
        tableCard,
      ),
    );
    load();
    return host;
  }
  var FLAGS;
  var init_requests = __esm({
    "../../../home/claude/ebo-web/web/js/pages/requests.js"() {
      init_ui();
      init_api();
      init_state();
      FLAGS = [
        ["overdue", "Overdue"],
        ["escalated", "Escalated"],
        ["at_risk", "At risk or late"],
        ["urgent", "Urgent"],
        ["issues", "Has issues"],
      ];
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/newrequest.js
  var newrequest_exports = {};
  __export(newrequest_exports, {
    default: () => newrequest_default,
    requestForm: () => requestForm,
  });
  function requestForm(initial = {}, mode = "create") {
    const meta = S2.meta;
    const v = { raised_date: todayISO(), ...initial };
    const types = meta.request_types.filter(
      (t) => t.active || t.id === v.request_type_id,
    );
    if (mode === "create" && !v.request_type_id && types[0])
      v.request_type_id = types[0].id;
    const chosen = new Set(v.locations || (v.location ? [v.location] : []));
    let locEl;
    if (mode === "create") {
      locEl = h(
        "div",
        null,
        h(
          "div",
          { class: "chips", id: "loc-chips" },
          meta.locations
            .filter((l) => l.active)
            .map((l) => {
              const chip = h(
                "button",
                {
                  type: "button",
                  class: "chip" + (chosen.has(l.value) ? " on" : ""),
                  "aria-pressed": chosen.has(l.value),
                  onclick: () => {
                    if (chosen.has(l.value)) chosen.delete(l.value);
                    else chosen.add(l.value);
                    chip.classList.toggle("on");
                    chip.setAttribute("aria-pressed", chosen.has(l.value));
                    note.textContent =
                      chosen.size > 1
                        ? `${chosen.size} locations selected: one PR number is created for each.`
                        : "";
                  },
                },
                l.value,
              );
              return chip;
            }),
        ),
      );
      var note = h(
        "div",
        { class: "hint", style: { marginTop: "6px" } },
        chosen.size > 1
          ? `${chosen.size} locations selected: one PR number is created for each.`
          : "Pick more than one location to raise the same requirement for each of them.",
      );
      locEl.append(note);
    } else
      locEl = select(
        meta.locations
          .filter((l) => l.active || l.value === v.location)
          .map((l) => [l.value, l.value]),
        v.location,
        { id: "f-loc" },
      );
    const requirement = input({
      value: v.requirement || "",
      placeholder: "e.g. Business cards, BFS sunboard, Prescription pad",
      maxlength: 300,
    });
    const collateral = select(
      [
        ["", "Not listed / other"],
        ...meta.collaterals
          .filter((c) => c.active || c.id === v.collateral_id)
          .map((c) => [c.id, c.name]),
      ],
      v.collateral_id || "",
    );
    const leadHint = h("div", { class: "hint" });
    const quantity = input({
      value: v.quantity || "",
      placeholder: "e.g. 400, or 2 booklets of 200 pages",
    });
    const material = input({
      value: v.material || "",
      placeholder: "Paper, GSM, finish",
    });
    const dimension = input({
      value: v.dimension || "",
      placeholder: "Size, e.g. A5 or 4 ft x 3 ft",
    });
    const artwork = input({
      value: v.artwork_link || "",
      placeholder: "Link to the artwork folder or file",
      type: "url",
    });
    const need = input({
      type: "date",
      value: v.req_delivery_date || "",
      min: mode === "create" ? todayISO() : null,
    });
    const needHint = h("div", { class: "hint" });
    const raised = input({
      type: "date",
      value: v.raised_date,
      max: todayISO(),
    });
    const mkt = select(
      [
        ["", "Not assigned"],
        ...pocUsers("marketing").map((u) => [u.id, u.name]),
      ],
      v.marketing_poc_id ||
        (mode === "create" && S2.user.poc_type === "marketing"
          ? S2.user.id
          : ""),
    );
    const ops = select(
      [["", "Not assigned yet"], ...pocUsers("ops").map((u) => [u.id, u.name])],
      v.ops_poc_id ||
        (mode === "create" && S2.user.poc_type === "ops" ? S2.user.id : ""),
    );
    const rmk = textarea({
      value: v.remark_marketing || "",
      placeholder: "Anything Operations should know",
      rows: 2,
    });
    const reason = input({
      value: v.urgency_reason || "",
      placeholder:
        "e.g. Store opening on 1 Nov, event date, compliance deadline",
    });
    const reasonField = field(
      "Business reason for urgency",
      reason,
      "Required. Requests without a reason are treated as Standard.",
      true,
    );
    const committed = input({ type: "date", value: v.committed_date || "" });
    let typeId = v.request_type_id || "";
    const cards = h("div", {
      class: "form-grid",
      style: { gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" },
      role: "radiogroup",
      "aria-label": "Request type",
    });
    const drawTypes = () => {
      clear(cards).append(
        ...types.map((t) =>
          h(
            "button",
            {
              type: "button",
              role: "radio",
              "aria-checked": t.id === typeId,
              class: "card",
              style: {
                textAlign: "left",
                padding: "11px 13px",
                cursor: "pointer",
                borderColor: t.id === typeId ? "var(--brand)" : null,
                background: t.id === typeId ? "var(--brand-soft)" : null,
                boxShadow: "none",
              },
              onclick: () => {
                typeId = t.id;
                drawTypes();
                sync2();
              },
            },
            h("div", { style: { fontWeight: 650 } }, t.value),
            h("div", { class: "small muted" }, t.meta.description || ""),
          ),
        ),
      );
    };
    const sync2 = () => {
      const t = types.find((x) => x.id === typeId);
      reasonField.classList.toggle("hidden", !(t && t.meta.requires_reason));
      const c = meta.collaterals.find(
        (x) => String(x.id) === String(collateral.value),
      );
      leadHint.textContent = c
        ? `Standard lead time: ${c.lead_days_max ? c.lead_days + "\u2013" + c.lead_days_max : c.lead_days} working days from final artwork approval to dispatch.`
        : "";
      needHint.textContent = "";
      if (c && need.value) {
        const gap = Math.round(
          (new Date(need.value) - new Date(todayISO())) / 864e5,
        );
        if (gap < c.lead_days)
          needHint.textContent =
            "This is tighter than the standard lead time. If it is genuinely urgent, choose Urgent and give the business reason.";
      }
    };
    collateral.addEventListener("change", sync2);
    need.addEventListener("change", sync2);
    drawTypes();
    sync2();
    const cvals = v.custom || {};
    const customCtl = meta.custom_fields.map((cf) => {
      let ctl;
      const cur = cvals[cf.key];
      if (cf.type === "textarea") ctl = textarea({ value: cur || "", rows: 2 });
      else if (cf.type === "number")
        ctl = input({ type: "number", value: cur ?? "" });
      else if (cf.type === "date")
        ctl = input({ type: "date", value: cur || "" });
      else if (cf.type === "select")
        ctl = select([["", "Choose"], ...cf.options], cur || "");
      else if (cf.type === "checkbox") ctl = checkbox(cf.label, !!cur);
      else ctl = input({ value: cur || "" });
      return {
        cf,
        ctl,
        el:
          cf.type === "checkbox"
            ? h("div", { class: "field" }, ctl)
            : field(cf.label, ctl, null, cf.required),
      };
    });
    const customBlock = customCtl.length
      ? [
          h("hr", { class: "sep full" }),
          h(
            "div",
            { class: "form-grid" },
            customCtl.map((c) => c.el),
          ),
        ]
      : [];
    const el = h(
      "div",
      { class: "stack stack-l" },
      h(
        "div",
        { class: "stack" },
        h("h3", null, "What is needed"),
        h(
          "div",
          { class: "form-grid" },
          h(
            "div",
            { class: "field full" },
            h(
              "label",
              null,
              mode === "create" ? "Location(s)" : "Location",
              h("span", { class: "req-star" }, " *"),
            ),
            locEl,
          ),
          h(
            "div",
            { class: "full" },
            field("Requirement", requirement, null, true),
          ),
          field("Collateral type", collateral, null),
          field("Quantity", quantity),
          field("Material / specification", material),
          field("Dimension", dimension),
          h("div", { class: "full" }, field("Artwork link", artwork)),
          h("div", { class: "full" }, leadHint),
        ),
      ),
      h(
        "div",
        { class: "stack" },
        h("h3", null, "How it should be sourced"),
        cards,
        reasonField,
        h(
          "div",
          { class: "hint" },
          "Standard requests get quotes from 3 vendors. Repeat orders go to the existing vendor. Urgent skips the comparison and needs a reason (SOP 10.1).",
        ),
      ),
      h(
        "div",
        { class: "stack" },
        h("h3", null, "Dates and people"),
        h(
          "div",
          { class: "form-grid" },
          field("Required at location by", need, null),
          mode === "create" || can("steps.override")
            ? field("Request raised on", raised)
            : null,
          field("Marketing POC", mkt),
          field("Procurement POC", ops),
          mode === "edit" && (can("quotes.manage") || can("steps.override"))
            ? field(
                "Vendor committed dispatch date",
                committed,
                "Optional. Overrides the standard lead-time due date.",
              )
            : null,
          h("div", { class: "full" }, needHint),
          h("div", { class: "full" }, field("Remarks from Marketing", rmk)),
        ),
        ...customBlock,
      ),
    );
    const values = () => {
      const out = {
        requirement: requirement.value.trim(),
        collateral_id: collateral.value || null,
        quantity: quantity.value.trim(),
        material: material.value.trim(),
        dimension: dimension.value.trim(),
        artwork_link: artwork.value.trim(),
        request_type_id: typeId || null,
        urgency_reason: reason.value.trim(),
        req_delivery_date: need.value || null,
        marketing_poc_id: mkt.value || null,
        ops_poc_id: ops.value || null,
        remark_marketing: rmk.value.trim(),
        custom: {},
      };
      if (mode === "create") {
        out.locations = [...chosen];
        out.raised_date = raised.value || todayISO();
      } else {
        out.location = locEl.value;
        if (can("steps.override")) out.raised_date = raised.value;
        if (can("quotes.manage") || can("steps.override"))
          out.committed_date = committed.value || null;
      }
      for (const c of customCtl) {
        const ctl =
          c.cf.type === "checkbox" ? c.ctl.querySelector("input") : c.ctl;
        out.custom[c.cf.key] =
          c.cf.type === "checkbox" ? ctl.checked : ctl.value;
      }
      return out;
    };
    return { el, values };
  }
  async function newrequest_default({ navigate: navigate2 }) {
    if (!can("requests.create"))
      return h(
        "div",
        { class: "banner bad" },
        "Your role cannot raise requests.",
      );
    const form = requestForm({}, "create");
    const btn = h(
      "button",
      {
        class: "btn primary",
        type: "button",
        onclick: async () => {
          btn.disabled = true;
          try {
            const r = await api.post("/requests", form.values());
            toast(
              r.created.length > 1
                ? `${r.created.length} requests created: ${r.created.map((c) => c.pr_no.split("/").pop()).join(", ")}`
                : `Request ${r.created[0].pr_no} created`,
            );
            navigate2(
              r.created.length > 1
                ? "#/requests"
                : "#/requests/" + r.created[0].id,
            );
          } catch (e) {
            errToast(e);
            btn.disabled = false;
          }
        },
      },
      icon("check", 16),
      "Raise request",
    );
    return h(
      "div",
      { class: "stack", style: { maxWidth: "900px" } },
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          null,
          h("h1", null, "New request"),
          h(
            "p",
            null,
            "Marketing raises the requirement here. Operations is notified and takes it from there.",
          ),
        ),
      ),
      h(
        "div",
        { class: "card" },
        h(
          "div",
          { class: "card-b" },
          form.el,
          h(
            "div",
            {
              class: "row sticky-actions",
              style: { marginTop: "18px", justifyContent: "flex-end" },
            },
            h("a", { class: "btn", href: "#/requests" }, "Cancel"),
            btn,
          ),
        ),
      ),
    );
  }
  var init_newrequest = __esm({
    "../../../home/claude/ebo-web/web/js/pages/newrequest.js"() {
      init_ui();
      init_api();
      init_state();
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/request.js
  var request_exports = {};
  __export(request_exports, {
    default: () => request_default,
  });
  function describe(a) {
    const d = a.detail && typeof a.detail === "object" ? a.detail : {};
    const s = typeof a.detail === "string" ? a.detail : "";
    switch (a.action) {
      case "request_created":
        return d.repeat_of
          ? `Raised as a repeat of ${d.repeat_of}`
          : "Request raised";
      case "request_edited":
        return Array.isArray(a.detail)
          ? "Edited: " +
              a.detail
                .map(
                  (x) =>
                    `${x.field} ${x.from ?? "\u2014"} \u2192 ${x.to ?? "\u2014"}`,
                )
                .join("; ")
          : "Edited";
      case "step_done":
        return `${d.step} completed${d.date ? " (" + fmtDate(d.date, true) + ")" : ""}${d.remark ? ": " + d.remark : ""}`;
      case "step_skipped":
        return `${d.step} skipped: ${d.remark}`;
      case "step_undone":
        return `${d.step} reopened`;
      case "step_date_changed":
        return `${d.step} date changed ${fmtDate(d.from, true)} \u2192 ${fmtDate(d.to, true)}`;
      case "quote_added":
        return `Vendor added to shortlist: ${d.vendor}${d.rate != null ? " at " + fmtMoney(d.rate) : ""}`;
      case "quote_updated":
        return `Quote updated: ${d.vendor}${d.rate != null ? " at " + fmtMoney(d.rate) : ""}`;
      case "quote_removed":
        return `Vendor removed from shortlist: ${d.vendor}`;
      case "vendor_selected":
        return `Vendor selected: ${d.vendor} at ${fmtMoney(d.rate)}`;
      case "issue_logged":
        return `Issue logged: ${d.type}${d.responsible ? " (" + d.responsible + ")" : ""}`;
      case "issue_resolved":
        return "Issue resolved";
      case "issue_open":
        return "Issue reopened";
      case "issue_updated":
        return "Issue updated";
      case "issue_removed":
        return "Issue removed";
      case "proof_round":
        return `Artwork correction round logged${s && s !== "Artwork correction round logged" ? ": " + s : ""}`;
      case "file_uploaded":
        return `File added: ${d.name}`;
      case "file_deleted":
        return `File removed: ${d.name}`;
      case "status_hold":
        return `Put on hold: ${s}`;
      case "status_resume":
        return "Resumed";
      case "status_cancel":
        return `Cancelled: ${s}`;
      case "status_reopen":
        return "Reopened";
      case "request_closed":
        return s || "Closed";
      case "imported":
        return s;
      default:
        return a.action.replace(/_/g, " ");
    }
  }
  async function request_default({ params, navigate: navigate2 }) {
    const id = Number(params[0]);
    const host = h("div", { class: "stack" });
    let data;
    const fin = S2.meta.can_see_financials;
    async function load(keepScroll) {
      const y = window.scrollY;
      data = await api.get("/requests/" + id);
      clear(host).append(build());
      if (keepScroll) window.scrollTo(0, y);
    }
    const act = async (fn, okMsg) => {
      try {
        await fn();
        if (okMsg) toast(okMsg);
        await load(true);
      } catch (e) {
        errToast(e);
      }
    };
    function stepDialog(step, mode) {
      const date = input({
        type: "date",
        value: todayISO(),
        max: todayISO(),
        min: data.raised_date,
      });
      const remark = textarea({
        rows: 2,
        placeholder:
          mode === "skip"
            ? "Why is this step not needed?"
            : "Optional note, e.g. mail reference or who confirmed",
      });
      const files = input({ type: "file", multiple: true });
      const body = h(
        "div",
        { class: "stack" },
        h("div", { class: "small ink2" }, step.description),
        step.req_quotes
          ? h(
              "div",
              { class: "banner" },
              `Needs ${data.min_quotes} vendor${data.min_quotes > 1 ? "s" : ""} on the shortlist (${data.quotes.length} added).`,
            )
          : null,
        step.req_vendor
          ? h(
              "div",
              { class: "banner" },
              data.vendor_name
                ? `Selected vendor: ${data.vendor_name}${fin ? " at " + fmtMoney(data.rate) : ""}.`
                : "Select the final vendor and rate in the Vendors & quotes tab first.",
            )
          : null,
        mode === "done"
          ? field(
              "Completed on",
              date,
              "Change this if you are recording something that happened earlier.",
            )
          : null,
        step.req_attachment
          ? S2.user.is_owner
            ? field("Attach files", files, "Required for this step.", true)
            : h(
                "p",
                { class: "muted" },
                "The primary owner must upload this step’s required attachment.",
              )
          : null,
        field(
          mode === "skip" ? "Reason" : "Note",
          remark,
          null,
          mode === "skip",
        ),
      );
      modal({
        title:
          mode === "skip" ? `Skip: ${step.name}` : `Mark done: ${step.name}`,
        body,
        actions: [
          { label: "Cancel" },
          {
            label: mode === "skip" ? "Skip step" : "Mark done",
            kind: "primary",
            onClick: async (close) => {
              if (
                mode === "done" &&
                step.req_attachment &&
                files.files.length
              ) {
                const fd = new FormData();
                [...files.files].forEach((f) => fd.append("files", f));
                fd.append("step_id", step.id);
                fd.append("kind", "qc");
                await api.upload(`/requests/${id}/attachments`, fd);
              }
              await api.post(
                `/requests/${id}/steps/${step.id}/${mode === "skip" ? "skip" : "complete"}`,
                { date: date.value, remark: remark.value },
              );
              close();
              toast(mode === "skip" ? "Step skipped" : `${step.name}: done`);
              await load(true);
            },
          },
        ],
      });
    }
    function dateDialog(step) {
      const date = input({
        type: "date",
        value: step.done_date,
        max: todayISO(),
        min: data.raised_date,
      });
      modal({
        title: `Change date: ${step.name}`,
        body: field("Completed on", date),
        actions: [
          { label: "Cancel" },
          {
            label: "Save date",
            kind: "primary",
            onClick: async (close) => {
              await api.post(`/requests/${id}/steps/${step.id}/date`, {
                date: date.value,
              });
              close();
              toast("Date updated");
              await load(true);
            },
          },
        ],
      });
    }
    function stepRow(s, i) {
      const cls =
        s.status === "done"
          ? "done"
          : s.status === "skipped"
            ? "skipped"
            : s.is_active
              ? "active" + (s.overdue_days > 0 ? " overdue" : "")
              : "future";
      const meta = [];
      if (s.status === "done") {
        meta.push(
          s.done_date
            ? `Done ${fmtDate(s.done_date, true)}`
            : "Done (date not recorded)",
        );
        if (s.done_by_name) meta.push("by " + s.done_by_name);
        if (s.tat != null)
          meta.push(
            h(
              "span",
              {
                class: s.late_by > 0 ? "" : "",
                style:
                  s.late_by > 0
                    ? { color: "var(--bad)", fontWeight: 600 }
                    : null,
              },
              `took ${s.tat} working day${s.tat === 1 ? "" : "s"}${s.due_date && s.sla_days != null ? ` (target ${s.sla_days})` : ""}${s.late_by > 0 ? `, ${s.late_by} late` : ""}`,
            ),
          );
      } else if (s.status === "skipped") meta.push("Skipped");
      else if (s.is_active) {
        if (s.elapsed != null)
          meta.push(
            `Waiting ${s.elapsed} working day${s.elapsed === 1 ? "" : "s"}`,
          );
        if (s.due_date)
          meta.push(
            h(
              "span",
              {
                style:
                  s.overdue_days > 0
                    ? { color: "var(--bad)", fontWeight: 650 }
                    : null,
              },
              s.overdue_days > 0
                ? `Overdue by ${s.overdue_days} working day${s.overdue_days > 1 ? "s" : ""} (was due ${fmtDate(s.due_date)})`
                : `Due ${fmtDate(s.due_date)}`,
            ),
          );
        if (s.esc_level)
          meta.push(
            badge(
              s.esc_level >= 2 ? "Escalated to heads" : "Escalated to lead",
              s.esc_level >= 2 ? "bad" : "warn",
            ),
          );
      } else if (s.sla_mode === "lead_time")
        meta.push("Due = standard lead time from artwork approval");
      else if (s.sla_days != null)
        meta.push(
          `Target ${s.sla_days} working day${s.sla_days === 1 ? "" : "s"}`,
        );
      const acts = [];
      if (
        s.can_update &&
        s.status === "pending" &&
        (s.is_active || can("steps.override"))
      ) {
        acts.push(
          h(
            "button",
            { class: "btn primary sm", onclick: () => stepDialog(s, "done") },
            icon("check", 14),
            "Mark done",
          ),
        );
        if (s.is_active)
          acts.push(
            h(
              "button",
              { class: "btn ghost sm", onclick: () => stepDialog(s, "skip") },
              "Skip",
            ),
          );
      }
      if (
        s.can_update &&
        s.status !== "pending" &&
        !(i === 0 && !can("steps.override"))
      )
        acts.push(
          h(
            "button",
            {
              class: "btn ghost sm",
              onclick: async () => {
                if (
                  await confirmDialog(
                    "Undo this step?",
                    `"${s.name}" will go back to waiting.`,
                    "Undo step",
                    "danger",
                  )
                )
                  act(
                    () => api.post(`/requests/${id}/steps/${s.id}/undo`),
                    "Step reopened",
                  );
              },
            },
            "Undo",
          ),
        );
      if (
        can("steps.override") &&
        s.status === "done" &&
        s.done_date &&
        i > 0 &&
        data.status !== "cancelled"
      )
        acts.push(
          h(
            "button",
            { class: "btn ghost sm", onclick: () => dateDialog(s) },
            "Change date",
          ),
        );
      return h(
        "div",
        { class: `step ${cls}`, "data-party": s.owner_party },
        h(
          "div",
          { class: "mark" },
          s.status === "done"
            ? icon("check", 14)
            : s.status === "skipped"
              ? "\u2013"
              : i + 1,
        ),
        h(
          "div",
          null,
          h(
            "div",
            { class: "row wrap gap-s" },
            h("span", { class: "nm" }, s.name),
            party(s.owner_party),
          ),
          s.status === "pending" && s.is_active
            ? h("div", { class: "small ink2" }, s.description)
            : null,
          h(
            "div",
            { class: "meta" },
            meta.map((m) => h("span", null, m)),
          ),
          s.remark && !/^Imported|^Not tracked|^Step added/.test(s.remark)
            ? h(
                "div",
                { class: "small ink2", style: { marginTop: "3px" } },
                `\u201C${s.remark}\u201D`,
              )
            : null,
        ),
        h("div", { class: "acts" }, acts),
      );
    }
    function detailsTab() {
      const r = data;
      const link = safeLink(r.artwork_link);
      const dl = (k, v) => [
        h("dt", null, k),
        h(
          "dd",
          null,
          v == null || v === "" ? h("span", { class: "muted" }, "\u2014") : v,
        ),
      ];
      return h(
        "div",
        { class: "stack" },
        h(
          "dl",
          { class: "dl" },
          dl("Requirement", r.requirement),
          dl("Collateral type", r.collateral_name),
          dl("Location", r.location),
          dl("Quantity", r.quantity),
          dl("Material", r.material),
          dl("Dimension", r.dimension),
          dl(
            "Artwork link",
            link
              ? h(
                  "a",
                  { href: link, target: "_blank", rel: "noopener noreferrer" },
                  r.artwork_link,
                )
              : r.artwork_link,
          ),
          dl("Request type", r.request_type),
          r.urgency_reason ? dl("Urgency reason", r.urgency_reason) : [],
          dl("Raised on", fmtDate(r.raised_date, true)),
          dl("Required by", fmtDate(r.req_delivery_date, true)),
          r.committed_date
            ? dl(
                "Vendor committed to dispatch",
                fmtDate(r.committed_date, true),
              )
            : [],
          dl("Marketing POC", r.marketing_poc_name),
          dl("Procurement POC", r.ops_poc_name),
          dl("Raised by", r.created_by_name),
          dl("Marketing remarks", r.remark_marketing),
          dl("Procurement remarks", r.remark_procurement),
          S2.meta.custom_fields.map((cf) =>
            dl(
              cf.label,
              r.custom[cf.key] === true
                ? "Yes"
                : r.custom[cf.key] === false
                  ? "No"
                  : r.custom[cf.key],
            ),
          ),
        ),
        h("hr", { class: "sep" }),
        h(
          "div",
          { class: "row between wrap" },
          h(
            "div",
            null,
            h("b", null, "Artwork correction rounds: "),
            String(r.proof_rounds),
            h(
              "div",
              { class: "small muted" },
              "Each round of corrections on the proof adds a communication loop. Fewer is better.",
            ),
          ),
          r.status === "open" && (r.can_edit || can("steps.update"))
            ? h(
                "button",
                {
                  class: "btn sm",
                  onclick: () => {
                    const n = textarea({
                      rows: 2,
                      placeholder: "What was corrected? (optional)",
                    });
                    modal({
                      title: "Log an artwork correction round",
                      body: field("Note", n),
                      actions: [
                        { label: "Cancel" },
                        {
                          label: "Log round",
                          kind: "primary",
                          onClick: async (close) => {
                            await api.post(`/requests/${id}/proof-round`, {
                              note: n.value,
                            });
                            close();
                            toast("Round logged");
                            await load(true);
                          },
                        },
                      ],
                    });
                  },
                },
                icon("plus", 14),
                "Log a round",
              )
            : null,
        ),
        r.batch_siblings.length
          ? h(
              "div",
              null,
              h(
                "div",
                { class: "label" },
                "Raised together for other locations",
              ),
              h(
                "div",
                { class: "chips", style: { marginTop: "6px" } },
                r.batch_siblings.map((b) =>
                  h(
                    "a",
                    { class: "chip", href: "#/requests/" + b.id },
                    `${b.pr_no.split("/").pop()} \xB7 ${b.location}`,
                  ),
                ),
              ),
            )
          : null,
      );
    }
    function quotesTab() {
      const r = data;
      const canManage =
        can("quotes.manage") && ["open", "on_hold"].includes(r.status);
      const prices = r.quotes.filter((q) => q.rate != null).map((q) => q.rate);
      const best = prices.length ? Math.min(...prices) : null;
      const rows2 = r.quotes.map((q) =>
        h(
          "tr",
          { class: q.selected ? "quote-best" : "" },
          h(
            "td",
            null,
            h("b", null, q.vendor_name),
            q.selected ? h("div", null, badge("Selected", "ok")) : null,
          ),
          fin
            ? h(
                "td",
                { class: "num" },
                q.rate == null
                  ? h("span", { class: "muted" }, "Awaiting quote")
                  : fmtMoney(q.rate),
                q.rate != null && q.rate === best && prices.length > 1
                  ? h("div", null, badge("Lowest", "brand"))
                  : null,
                q.ratecard_rate != null && q.rate != null
                  ? h(
                      "div",
                      {
                        class:
                          "tiny " + (q.rate > q.ratecard_rate ? "" : "muted"),
                        style:
                          q.rate > q.ratecard_rate
                            ? { color: "var(--warn)" }
                            : null,
                      },
                      `Rate card ${fmtMoney(q.ratecard_rate)}${q.rate > q.ratecard_rate ? ` (+${fmtNum((q.rate / q.ratecard_rate - 1) * 100, 0)}%)` : ""}`,
                    )
                  : null,
              )
            : null,
          fin ? h("td", { class: "num" }, fmtMoney(q.amount)) : null,
          h("td", null, q.lead_days != null ? q.lead_days + " d" : "\u2014"),
          h("td", null, fmtDate(q.received_date)),
          h("td", { class: "small wrap" }, q.notes || ""),
          h(
            "td",
            { class: "right nowrap" },
            canManage
              ? [
                  !q.selected && q.rate != null
                    ? h(
                        "button",
                        {
                          class: "btn sm primary",
                          onclick: () =>
                            act(
                              () =>
                                api.post(
                                  `/requests/${id}/quotes/${q.id}/select`,
                                ),
                              "Vendor selected",
                            ),
                        },
                        "Select",
                      )
                    : null,
                  " ",
                  h(
                    "button",
                    { class: "btn sm ghost", onclick: () => quoteDialog(q) },
                    "Edit",
                  ),
                  h(
                    "button",
                    {
                      class: "btn sm ghost",
                      "aria-label": "Remove",
                      onclick: async () => {
                        if (
                          await confirmDialog(
                            "Remove this vendor?",
                            q.vendor_name,
                            "Remove",
                            "danger",
                          )
                        )
                          act(() => api.del(`/requests/${id}/quotes/${q.id}`));
                      },
                    },
                    icon("x", 14),
                  ),
                ]
              : null,
          ),
        ),
      );
      return h(
        "div",
        { class: "stack" },
        h(
          "div",
          { class: "banner" + (r.quotes.length >= r.min_quotes ? " ok" : "") },
          h(
            "div",
            null,
            h("b", null, r.request_type || "Request"),
            `: ${r.min_quotes > 1 ? `compare at least ${r.min_quotes} vendors` : "one vendor is enough"}. ${r.quotes.length} on the shortlist.`,
          ),
        ),
        r.quotes.length
          ? h(
              "div",
              { class: "table-wrap" },
              h(
                "table",
                { class: "t" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "Vendor"),
                    fin ? h("th", null, "Rate") : null,
                    fin ? h("th", null, "Amount") : null,
                    h("th", null, "Lead time"),
                    h("th", null, "Quote received"),
                    h("th", null, "Notes"),
                    h("th"),
                  ),
                ),
                h("tbody", null, rows2),
              ),
            )
          : empty(
              "No vendors yet",
              canManage ? "Add the vendors you are asking for quotes." : "",
            ),
        canManage
          ? h(
              "div",
              null,
              h(
                "button",
                { class: "btn", onclick: () => quoteDialog() },
                icon("plus", 16),
                "Add vendor or quote",
              ),
            )
          : null,
      );
    }
    function quoteDialog(q) {
      const used = new Set(data.quotes.map((x) => x.vendor_id));
      const vendor = q
        ? h("div", null, h("b", null, q.vendor_name))
        : select(
            [
              ["", "Choose a vendor"],
              ...S2.meta.vendors
                .filter((v) => v.active && !used.has(v.id))
                .map((v) => [
                  v.id,
                  v.name + (v.empanelled ? "" : " (not empanelled)"),
                ]),
            ],
            "",
          );
      const rate = input({
        type: "number",
        min: 0,
        step: "0.01",
        value: q && q.rate != null ? q.rate : "",
        placeholder: "Per unit",
      });
      const lead = input({
        type: "number",
        min: 0,
        value: q && q.lead_days != null ? q.lead_days : "",
      });
      const rec = input({
        type: "date",
        value: q ? q.received_date || "" : "",
        max: todayISO(),
      });
      const notes = input({
        value: q ? q.notes : "",
        placeholder: "e.g. 5 days if artwork ready, GST extra",
      });
      modal({
        title: q ? `Quote: ${q.vendor_name}` : "Add vendor to shortlist",
        body: h(
          "div",
          { class: "form-grid", style: { gridTemplateColumns: "1fr 1fr" } },
          h("div", { class: "full" }, field("Vendor", vendor)),
          fin
            ? field(
                "Rate (per unit)",
                rate,
                "Leave empty if the quote has not come yet.",
              )
            : null,
          field("Lead time (working days)", lead),
          field("Quote received on", rec),
          h("div", { class: "full" }, field("Notes", notes)),
        ),
        actions: [
          { label: "Cancel" },
          {
            label: "Save",
            kind: "primary",
            onClick: async (close) => {
              const vid = q ? q.vendor_id : vendor.value;
              if (!vid) {
                toast("Choose a vendor first.", "bad");
                return false;
              }
              await api.post(`/requests/${id}/quotes`, {
                vendor_id: vid,
                rate: rate.value,
                lead_days: lead.value,
                received_date: rec.value,
                notes: notes.value,
              });
              close();
              toast("Saved");
              await load(true);
            },
          },
        ],
      });
    }
    function filesTab() {
      const r = data;
      const kind = select(
        [
          ["artwork", "Artwork"],
          ["proof", "Proof"],
          ["quote", "Quotation"],
          ["qc", "QC report / photos"],
          ["invoice", "Invoice"],
          ["other", "Other"],
        ],
        "other",
      );
      const file = input({ type: "file", multiple: true });
      const kinds = {
        artwork: "Artwork",
        proof: "Proof",
        quote: "Quotation",
        qc: "QC",
        invoice: "Invoice",
        other: "Other",
      };
      const up = S2.user.is_owner
        ? h(
            "div",
            { class: "row wrap" },
            kind,
            file,
            h(
              "button",
              {
                class: "btn primary",
                onclick: async () => {
                  if (!file.files.length)
                    return toast("Choose a file first.", "bad");
                  const fd = new FormData();
                  [...file.files].forEach((f) => fd.append("files", f));
                  fd.append("kind", kind.value);
                  act(
                    () => api.upload(`/requests/${id}/attachments`, fd),
                    "Uploaded",
                  );
                },
              },
              icon("upload", 16),
              "Upload",
            ),
          )
        : null;
      return h(
        "div",
        { class: "stack" },
        up,
        h(
          "div",
          { class: "small muted" },
          "Up to 6 MB per file. PDF, PNG, JPEG, WebP, XLSX, CSV and text files are accepted.",
        ),
        r.attachments.length
          ? h(
              "div",
              { class: "stack-s stack" },
              r.attachments.map((a) =>
                h(
                  "div",
                  {
                    class: "row card",
                    style: { padding: "9px 12px", boxShadow: "none" },
                  },
                  icon("paperclip", 16),
                  h(
                    "div",
                    { class: "grow" },
                    h(
                      "a",
                      {
                        href: "#",
                        onclick: (e) => {
                          e.preventDefault();
                          fetchAttachment(
                            `/attachments/${a.id}`,
                            "save",
                            a.orig_name,
                          ).catch(errToast);
                        },
                      },
                      a.orig_name,
                    ),
                    h(
                      "div",
                      { class: "tiny muted" },
                      `${kinds[a.kind] || "File"} \xB7 ${fmtNum(a.size / 1024, 0)} KB \xB7 ${a.uploaded_by_name || ""} \xB7 ${timeAgo(a.created_at)}`,
                    ),
                  ),
                  /\.(png|jpe?g|gif|webp|pdf)$/i.test(a.orig_name)
                    ? h(
                        "button",
                        {
                          class: "btn sm",
                          onclick: () =>
                            fetchAttachment(
                              `/attachments/${a.id}`,
                              "open",
                            ).catch(errToast),
                        },
                        "Open",
                      )
                    : null,
                  S2.user.is_owner
                    ? h(
                        "button",
                        {
                          class: "btn sm ghost",
                          "aria-label": "Delete file",
                          onclick: async () => {
                            if (
                              await confirmDialog(
                                "Delete this file?",
                                a.orig_name,
                                "Delete",
                                "danger",
                              )
                            )
                              act(() => api.del("/attachments/" + a.id));
                          },
                        },
                        icon("trash", 14),
                      )
                    : null,
                ),
              ),
            )
          : empty(
              "No files yet",
              "Attach artwork, proofs, quotations and QC photos here.",
            ),
      );
    }
    function issuesTab() {
      const r = data;
      const canIssue = can("issues.manage");
      return h(
        "div",
        { class: "stack" },
        canIssue
          ? h(
              "div",
              null,
              h(
                "button",
                { class: "btn", onclick: () => issueDialog() },
                icon("plus", 16),
                "Log an issue",
              ),
            )
          : null,
        r.issues.length
          ? r.issues.map((i) =>
              h(
                "div",
                {
                  class: "card",
                  style: { padding: "11px 14px", boxShadow: "none" },
                },
                h(
                  "div",
                  { class: "row between wrap" },
                  h(
                    "div",
                    null,
                    h("b", null, i.type_name || "Issue"),
                    " ",
                    badge(
                      i.status === "open" ? "Open" : "Resolved",
                      i.status === "open" ? "warn" : "ok",
                    ),
                    i.responsible
                      ? h(
                          "span",
                          { class: "small muted" },
                          ` \xB7 ${i.responsible}`,
                        )
                      : null,
                  ),
                  canIssue
                    ? h(
                        "div",
                        { class: "row gap-s" },
                        h(
                          "button",
                          {
                            class: "btn sm",
                            onclick: () =>
                              act(() =>
                                api.put(`/requests/${id}/issues/${i.id}`, {
                                  status:
                                    i.status === "open" ? "resolved" : "open",
                                }),
                              ),
                          },
                          i.status === "open" ? "Mark resolved" : "Reopen",
                        ),
                        h(
                          "button",
                          {
                            class: "btn sm ghost",
                            "aria-label": "Delete issue",
                            onclick: async () => {
                              if (
                                await confirmDialog(
                                  "Delete this issue?",
                                  i.type_name,
                                  "Delete",
                                  "danger",
                                )
                              )
                                act(() =>
                                  api.del(`/requests/${id}/issues/${i.id}`),
                                );
                            },
                          },
                          icon("trash", 14),
                        ),
                      )
                    : null,
                ),
                i.description
                  ? h(
                      "div",
                      { class: "small ink2", style: { marginTop: "4px" } },
                      i.description,
                    )
                  : null,
                h(
                  "div",
                  { class: "tiny muted", style: { marginTop: "4px" } },
                  [
                    i.delay_days != null ? `Delay ${i.delay_days} d` : "",
                    fin && i.cost_impact != null
                      ? `Cost ${fmtMoney(i.cost_impact)}`
                      : "",
                    `Logged ${fmtDate(i.raised_date)} by ${i.created_by_name || "\u2014"}`,
                  ]
                    .filter(Boolean)
                    .join(" \xB7 "),
                ),
              ),
            )
          : empty(
              "No issues logged",
              "Log design changes after RFQ, cancellations, print errors and delays so they show up in the dashboard.",
            ),
      );
    }
    function issueDialog(prefillTypeLike) {
      const types = S2.meta.issue_types.filter((t) => t.active);
      const pre = prefillTypeLike
        ? types.find((t) => new RegExp(prefillTypeLike, "i").test(t.value))
        : null;
      const type = select(
        [["", "Choose type"], ...types.map((t) => [t.id, t.value])],
        pre ? pre.id : "",
      );
      const resp = select([["", "Not decided"], ...S2.meta.parties], "");
      const desc = textarea({ rows: 2, placeholder: "What happened?" });
      const delay = input({
        type: "number",
        min: 0,
        placeholder: "Working days lost",
      });
      const cost = input({
        type: "number",
        min: 0,
        step: "0.01",
        placeholder: "Wasted cost",
      });
      modal({
        title: "Log an issue",
        body: h(
          "div",
          { class: "form-grid", style: { gridTemplateColumns: "1fr 1fr" } },
          field("Issue type", type, null, true),
          field("Who was responsible", resp),
          h("div", { class: "full" }, field("Description", desc)),
          field("Delay (days)", delay),
          fin ? field("Cost impact", cost) : null,
        ),
        actions: [
          { label: "Cancel" },
          {
            label: "Log issue",
            kind: "primary",
            onClick: async (close) => {
              if (!type.value) {
                toast("Choose the issue type.", "bad");
                return false;
              }
              await api.post(`/requests/${id}/issues`, {
                type_id: type.value,
                responsible: resp.value,
                description: desc.value,
                delay_days: delay.value,
                cost_impact: cost.value,
              });
              close();
              toast("Issue logged");
              await load(true);
            },
          },
        ],
      });
    }
    function commentsTab() {
      const box = textarea({
        rows: 2,
        placeholder: "Write a comment. The request POCs are notified.",
        "aria-label": "Comment",
      });
      return h(
        "div",
        { class: "stack" },
        data.comments.length
          ? data.comments.map((c) =>
              h(
                "div",
                { class: "comment" },
                h(
                  "div",
                  { class: "row between" },
                  h("b", { class: "small" }, c.user_name || "Someone"),
                  h("span", { class: "tiny muted" }, fmtDateTime(c.created_at)),
                ),
                h(
                  "div",
                  {
                    style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
                  },
                  c.body,
                ),
              ),
            )
          : h("div", { class: "muted small" }, "No comments yet."),
        can("comments.add")
          ? h(
              "div",
              { class: "stack-s stack" },
              box,
              h(
                "div",
                null,
                h(
                  "button",
                  {
                    class: "btn primary",
                    onclick: () => {
                      if (!box.value.trim()) return;
                      act(
                        () =>
                          api.post(`/requests/${id}/comments`, {
                            body: box.value,
                          }),
                        "Comment added",
                      );
                    },
                  },
                  "Add comment",
                ),
              ),
            )
          : null,
      );
    }
    function historyTab() {
      return data.activity.length
        ? h(
            "div",
            { class: "timeline" },
            data.activity.map((a) =>
              h(
                "div",
                { class: "tl" },
                h(
                  "div",
                  null,
                  h("div", null, describe(a)),
                  h(
                    "div",
                    { class: "tiny muted" },
                    `${a.user_name || "System"} \xB7 ${fmtDateTime(a.created_at)}`,
                  ),
                ),
              ),
            ),
          )
        : empty("No history yet");
    }
    function statusDialog(action) {
      const needsReason = action === "hold" || action === "cancel";
      let reasonCtl;
      if (action === "cancel")
        reasonCtl = select(
          [
            ["", "Choose a reason"],
            ...S2.meta.cancel_reasons
              .filter((c) => c.active)
              .map((c) => [c.value, c.value]),
          ],
          "",
        );
      else reasonCtl = textarea({ rows: 2, placeholder: "Reason" });
      const other =
        action === "cancel"
          ? input({ placeholder: "Add details (optional)" })
          : null;
      const prodDone = data.steps.find(
        (s) => s.key === "production" && s.status === "done",
      );
      const t = {
        hold: "Put on hold",
        resume: "Resume request",
        cancel: "Cancel request",
        reopen: "Reopen request",
      }[action];
      modal({
        title: t,
        body: h(
          "div",
          { class: "stack" },
          action === "cancel" && prodDone
            ? h(
                "div",
                { class: "banner warn" },
                "Production is already complete. After cancelling, log it as an issue (cancelled after production) so the cost is tracked.",
              )
            : null,
          action === "hold"
            ? h(
                "div",
                { class: "small ink2" },
                "The delay clocks stop while a request is on hold.",
              )
            : null,
          needsReason
            ? field(
                action === "cancel" ? "Reason" : "Reason for hold",
                reasonCtl,
                null,
                true,
              )
            : h(
                "div",
                null,
                action === "resume"
                  ? "The request goes back to its current step."
                  : "The request goes back to open.",
              ),
          other ? field("Details", other) : null,
        ),
        actions: [
          { label: "Back" },
          {
            label: t,
            kind: action === "cancel" ? "danger" : "primary",
            onClick: async (close) => {
              let reason = reasonCtl.value;
              if (needsReason && !reason.trim()) {
                toast("Give a reason.", "bad");
                return false;
              }
              if (other && other.value.trim())
                reason += ": " + other.value.trim();
              await api.post(`/requests/${id}/status`, { action, reason });
              close();
              toast("Updated");
              await load(true);
              if (action === "cancel" && prodDone && can("issues.manage"))
                issueDialog("cancelled after production");
            },
          },
        ],
      });
    }
    function editDialog() {
      const form = requestForm({ ...data }, "edit");
      modal({
        title: `Edit ${data.pr_no}`,
        wide: true,
        body: form.el,
        actions: [
          { label: "Cancel" },
          {
            label: "Save changes",
            kind: "primary",
            onClick: async (close) => {
              await api.put("/requests/" + id, form.values());
              close();
              toast("Saved");
              await load(true);
            },
          },
        ],
      });
    }
    function build() {
      const r = data;
      const menuItems = [];
      if (can("requests.hold")) {
        if (r.status === "open")
          menuItems.push(
            ["Put on hold", () => statusDialog("hold")],
            ["Cancel request", () => statusDialog("cancel")],
          );
        if (r.status === "on_hold")
          menuItems.push(
            ["Resume", () => statusDialog("resume")],
            ["Cancel request", () => statusDialog("cancel")],
          );
        if (r.status === "closed" || r.status === "cancelled")
          menuItems.push(["Reopen", () => statusDialog("reopen")]);
      }
      if (can("requests.delete"))
        menuItems.push([
          "Delete permanently",
          async () => {
            if (
              await confirmDialog(
                "Delete this request?",
                `${r.pr_no} and all its files and history will be removed. This cannot be undone.`,
                "Delete",
                "danger",
              )
            ) {
              await api.del("/requests/" + id).catch(errToast);
              toast("Request deleted");
              location.hash = "#/requests";
            }
          },
        ]);
      const moreBtn = h("div", { style: { position: "relative" } });
      if (menuItems.length) {
        const b = h(
          "button",
          {
            class: "btn",
            "aria-haspopup": "menu",
            onclick: (e) => {
              e.stopPropagation();
              const ex = moreBtn.querySelector(".menu");
              if (ex) return ex.remove();
              const m = h(
                "div",
                { class: "menu", role: "menu" },
                menuItems.map(([l, fn]) =>
                  h(
                    "button",
                    {
                      role: "menuitem",
                      onclick: () => {
                        m.remove();
                        fn();
                      },
                    },
                    l,
                  ),
                ),
              );
              moreBtn.append(m);
              setTimeout(
                () =>
                  document.addEventListener("click", () => m.remove(), {
                    once: true,
                  }),
                0,
              );
            },
          },
          "More",
        );
        moreBtn.append(b);
      }
      const banners = [];
      if (r.status === "on_hold")
        banners.push(
          h(
            "div",
            { class: "banner warn" },
            icon("pause", 18),
            h(
              "div",
              null,
              h("b", null, "On hold. "),
              r.status_reason,
              " The delay clocks are stopped.",
            ),
          ),
        );
      if (r.status === "cancelled")
        banners.push(
          h(
            "div",
            { class: "banner" },
            icon("x", 18),
            h("div", null, h("b", null, "Cancelled. "), r.status_reason),
          ),
        );
      if (r.status === "closed")
        banners.push(
          h(
            "div",
            { class: "banner ok" },
            icon("check", 18),
            h(
              "div",
              null,
              h("b", null, "Closed. "),
              `All steps complete${r.closed_date ? " on " + fmtDate(r.closed_date, true) : ""}.${r.e2e_tat != null ? ` Delivered in ${r.e2e_tat} working days from the request.` : ""}`,
            ),
          ),
        );
      if (r.flags.late)
        banners.push(
          h(
            "div",
            { class: "banner bad" },
            icon("alert", 18),
            h(
              "div",
              null,
              h("b", null, "Past the required date. "),
              `Needed by ${fmtDate(r.req_delivery_date, true)} and not delivered yet.`,
            ),
          ),
        );
      else if (r.flags.at_risk)
        banners.push(
          h(
            "div",
            { class: "banner warn" },
            icon("alert", 18),
            h(
              "div",
              null,
              h("b", null, "At risk. "),
              `Expected dispatch ${fmtDate(r.expected_dispatch, true)} is after the required date ${fmtDate(r.req_delivery_date, true)}.`,
            ),
          ),
        );
      if (r.status === "open" && !r.ops_poc_id)
        banners.push(
          h(
            "div",
            { class: "banner warn" },
            icon("user", 18),
            h(
              "div",
              { class: "grow" },
              h("b", null, "No Procurement owner yet. "),
            ),
            can("requests.edit") || can("requests.edit_all")
              ? h(
                  "button",
                  {
                    class: "btn sm",
                    onclick: () =>
                      act(
                        () =>
                          api.put("/requests/" + id, {
                            ops_poc_id: S2.user.id,
                          }),
                        "Assigned to you",
                      ),
                  },
                  "Assign to me",
                )
              : null,
          ),
        );
      const tabs = [
        ["details", "Details", null],
        ["quotes", "Vendors & quotes", r.quote_count],
        ["files", "Files", r.attachment_count],
        ["issues", "Issues", r.issue_count],
        ["comments", "Comments", r.comment_count],
        ["history", "History", null],
      ];
      let cur = tabMemory[id] || "details";
      const tabBar = h("div", { class: "tabs", role: "tablist" });
      const pane = h("div", { class: "card-b" });
      const panes = {
        details: detailsTab,
        quotes: quotesTab,
        files: filesTab,
        issues: issuesTab,
        comments: commentsTab,
        history: historyTab,
      };
      const draw = () => {
        clear(tabBar).append(
          ...tabs.map(([k, l, n]) =>
            h(
              "button",
              {
                class: "tab" + (cur === k ? " on" : ""),
                role: "tab",
                "aria-selected": cur === k,
                onclick: () => {
                  cur = k;
                  tabMemory[id] = k;
                  draw();
                },
              },
              l,
              n ? h("span", { class: "n" }, n) : null,
            ),
          ),
        );
        clear(pane).append(panes[cur]());
      };
      draw();
      const cs = r.current_step;
      return h(
        "div",
        { class: "stack" },
        h(
          "div",
          null,
          h("a", { href: "#/requests", class: "small" }, "\u2190 All requests"),
        ),
        h(
          "div",
          { class: "page-head", style: { marginBottom: 0 } },
          h(
            "div",
            null,
            h(
              "div",
              { class: "row wrap" },
              h("h1", null, r.pr_no),
              statusBadge(r),
              flagBadges(r),
              r.is_demo ? badge("Sample data") : null,
            ),
            h(
              "p",
              {
                style: {
                  color: "var(--ink)",
                  fontSize: "1.05rem",
                  marginTop: "4px",
                },
              },
              h("b", null, r.requirement),
              h(
                "span",
                { class: "muted" },
                ` \xB7 ${r.location || "No location"}${r.quantity ? " \xB7 Qty " + r.quantity : ""}`,
              ),
            ),
          ),
          h(
            "div",
            { class: "row gap-s wrap" },
            r.can_edit && r.status !== "cancelled"
              ? h(
                  "button",
                  { class: "btn", onclick: editDialog },
                  icon("edit", 16),
                  "Edit",
                )
              : null,
            can("requests.create")
              ? h(
                  "button",
                  {
                    class: "btn",
                    onclick: async () => {
                      try {
                        const n = await api.post(`/requests/${id}/clone`);
                        toast(`Repeat order ${n.pr_no} created`);
                        location.hash = "#/requests/" + n.id;
                      } catch (e) {
                        errToast(e);
                      }
                    },
                  },
                  icon("copy", 16),
                  "Repeat order",
                )
              : null,
            moreBtn,
          ),
        ),
        ...banners,
        h(
          "div",
          { class: "facts" },
          h(
            "div",
            { class: "fact" },
            h("div", { class: "l" }, "Now at"),
            h(
              "div",
              { class: "v" },
              cs
                ? h(
                    "span",
                    { class: "party", "data-party": cs.owner_party },
                    partyDot(cs.owner_party),
                    cs.name,
                  )
                : r.status === "closed"
                  ? "Completed"
                  : "\u2014",
            ),
          ),
          h(
            "div",
            { class: "fact" },
            h("div", { class: "l" }, "Age"),
            h("div", { class: "v" }, `${r.age} working days`),
          ),
          h(
            "div",
            { class: "fact" },
            h("div", { class: "l" }, "Required by"),
            h("div", { class: "v" }, fmtDate(r.req_delivery_date, true)),
          ),
          h(
            "div",
            { class: "fact" },
            h(
              "div",
              { class: "l" },
              r.actual_dispatch ? "Dispatched" : "Expected dispatch",
            ),
            h(
              "div",
              { class: "v" },
              r.actual_dispatch
                ? fmtDate(r.actual_dispatch, true)
                : r.expected_dispatch
                  ? fmtDate(r.expected_dispatch, true)
                  : "After artwork approval",
            ),
            r.lead_days
              ? h(
                  "div",
                  { class: "tiny muted" },
                  `Standard lead ${r.lead_days} working days`,
                )
              : null,
          ),
          h(
            "div",
            { class: "fact" },
            h("div", { class: "l" }, "Vendor"),
            h("div", { class: "v" }, r.vendor_name || "\u2014"),
            fin && r.amount != null
              ? h(
                  "div",
                  { class: "tiny muted" },
                  `${fmtMoney(r.amount)}${r.rate != null ? " at " + fmtMoney(r.rate) : ""}`,
                )
              : null,
          ),
          h(
            "div",
            { class: "fact" },
            h("div", { class: "l" }, "People"),
            h(
              "div",
              { class: "v small" },
              `${r.marketing_poc_name || "\u2014"} (Mktg)`,
            ),
            h(
              "div",
              { class: "small" },
              `${r.ops_poc_name || "Not assigned"} (Ops)`,
            ),
          ),
        ),
        h(
          "div",
          { class: "grid g-detail" },
          h(
            "div",
            { class: "card" },
            h(
              "div",
              { class: "card-h" },
              h("h2", null, "Progress"),
              h("span", { class: "small muted" }, `${r.progress}% complete`),
            ),
            h(
              "div",
              { class: "card-b" },
              strip(
                r.steps.map((s) => ({
                  ...s,
                  active: s.is_active,
                  overdue: s.is_active && s.overdue_days > 0,
                })),
                true,
              ),
              h(
                "div",
                { class: "steps", style: { marginTop: "10px" } },
                r.steps.map(stepRow),
              ),
            ),
          ),
          h("div", { class: "card" }, tabBar, pane),
        ),
      );
    }
    await load();
    return host;
  }
  var tabMemory, safeLink;
  var init_request = __esm({
    "../../../home/claude/ebo-web/web/js/pages/request.js"() {
      init_ui();
      init_api();
      init_state();
      init_newrequest();
      tabMemory = {};
      safeLink = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/vendors.js
  var vendors_exports = {};
  __export(vendors_exports, {
    default: () => vendors_default,
  });
  async function vendors_default() {
    const fin = S2.meta.can_see_financials;
    const host = h("div", { class: "stack" });
    let rows2 = [];
    let showInactive = false;
    async function load() {
      rows2 = (await api.get("/vendors")).rows;
      draw();
    }
    function vendorDialog(v) {
      const f = {
        name: input({ value: v ? v.name : "" }),
        contact_person: input({ value: v ? v.contact_person : "" }),
        phone: input({ value: v ? v.phone : "" }),
        email: input({ type: "email", value: v ? v.email : "" }),
        gstin: input({ value: v ? v.gstin : "" }),
        payment_terms: input({
          value: v ? v.payment_terms : "",
          placeholder: "e.g. 30 days from invoice",
        }),
        address: textarea({ rows: 2, value: v ? v.address : "" }),
        notes: textarea({ rows: 2, value: v ? v.notes : "" }),
      };
      const emp = checkbox(
          "Empanelled vendor (approved panel)",
          v ? v.empanelled : true,
        ),
        act = checkbox("Active", v ? v.active : true);
      modal({
        title: v ? "Edit vendor" : "Add vendor",
        wide: true,
        body: h(
          "div",
          { class: "form-grid" },
          h(
            "div",
            { class: "span2" },
            field("Vendor name", f.name, null, true),
          ),
          field("Contact person", f.contact_person),
          field("Phone", f.phone),
          field("Email", f.email),
          field("GSTIN", f.gstin),
          field("Payment terms", f.payment_terms),
          h("div", { class: "full" }, field("Address", f.address)),
          h("div", { class: "full" }, field("Notes", f.notes)),
          emp,
          act,
        ),
        actions: [
          { label: "Cancel" },
          {
            label: "Save vendor",
            kind: "primary",
            onClick: async (close) => {
              const body = Object.fromEntries(
                Object.entries(f).map(([k, c]) => [k, c.value]),
              );
              body.empanelled = emp.querySelector("input").checked;
              body.active = act.querySelector("input").checked;
              if (v) await api.put("/vendors/" + v.id, body);
              else await api.post("/vendors", body);
              close();
              toast("Vendor saved");
              await loadMeta();
              await load();
            },
          },
        ],
      });
    }
    async function detail(v) {
      const d = await api.get("/vendors/" + v.id);
      const col = select(
        [
          ["", "Any collateral"],
          ...S2.meta.collaterals
            .filter((c) => c.active)
            .map((c) => [c.id, c.name]),
        ],
        "",
      );
      const desc = input({
          placeholder: "Specification, e.g. 90 gsm matt, A5",
        }),
        rate = input({
          type: "number",
          min: 0,
          step: "0.01",
          placeholder: "Rate",
        }),
        unit = input({ value: "per piece" });
      const body = h(
        "div",
        { class: "stack" },
        h(
          "dl",
          { class: "dl" },
          h("dt", null, "Contact"),
          h(
            "dd",
            null,
            [d.vendor.contact_person, d.vendor.phone, d.vendor.email]
              .filter(Boolean)
              .join(" \xB7 ") || "\u2014",
          ),
          h("dt", null, "GSTIN"),
          h("dd", null, d.vendor.gstin || "\u2014"),
          h("dt", null, "Payment terms"),
          h("dd", null, d.vendor.payment_terms || "\u2014"),
          h("dt", null, "Address"),
          h("dd", null, d.vendor.address || "\u2014"),
          h("dt", null, "Notes"),
          h("dd", null, d.vendor.notes || "\u2014"),
        ),
        d.can_see_rates
          ? h(
              "div",
              { class: "stack-s stack" },
              h("h3", null, "Rate card"),
              h(
                "div",
                { class: "small muted" },
                "Agreed rates. Used to flag quotes that come in higher and to speed up repeat orders.",
              ),
              d.rates.length
                ? h(
                    "table",
                    { class: "t" },
                    h(
                      "thead",
                      null,
                      h(
                        "tr",
                        null,
                        h("th", null, "Collateral"),
                        h("th", null, "Specification"),
                        h("th", { class: "right" }, "Rate"),
                        h("th"),
                      ),
                    ),
                    h(
                      "tbody",
                      null,
                      d.rates.map((r) =>
                        h(
                          "tr",
                          null,
                          h("td", null, r.collateral_name || "Any"),
                          h("td", null, r.description || "\u2014"),
                          h(
                            "td",
                            { class: "right num" },
                            `${fmtMoney(r.rate)} ${r.unit}`,
                          ),
                          h(
                            "td",
                            { class: "right" },
                            can("vendors.manage")
                              ? h(
                                  "button",
                                  {
                                    class: "btn sm ghost",
                                    "aria-label": "Remove rate",
                                    onclick: async () => {
                                      await api.del(
                                        `/vendors/${v.id}/rates/${r.id}`,
                                      );
                                      toast("Removed");
                                      close();
                                      detail(v);
                                    },
                                  },
                                  icon("x", 14),
                                )
                              : null,
                          ),
                        ),
                      ),
                    ),
                  )
                : h("div", { class: "small muted" }, "No rates saved yet."),
              can("vendors.manage")
                ? h(
                    "div",
                    { class: "row wrap" },
                    col,
                    desc,
                    rate,
                    unit,
                    h(
                      "button",
                      {
                        class: "btn",
                        onclick: async () => {
                          try {
                            await api.post(`/vendors/${v.id}/rates`, {
                              collateral_id: col.value,
                              description: desc.value,
                              rate: rate.value,
                              unit: unit.value,
                            });
                            toast("Rate added");
                            close();
                            detail(v);
                          } catch (e) {
                            errToast(e);
                          }
                        },
                      },
                      "Add rate",
                    ),
                  )
                : null,
            )
          : null,
        h(
          "div",
          { class: "stack-s stack" },
          h("h3", null, "Recent orders"),
          d.orders.length
            ? h(
                "table",
                { class: "t" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "PR"),
                    h("th", null, "Requirement"),
                    h("th", null, "Raised"),
                    h("th", null, "Status"),
                    fin ? h("th", { class: "right" }, "Amount") : null,
                  ),
                ),
                h(
                  "tbody",
                  null,
                  d.orders.map((o) =>
                    h(
                      "tr",
                      {
                        class: "click",
                        onclick: () => {
                          close();
                          location.hash = "#/requests/" + o.id;
                        },
                      },
                      h(
                        "td",
                        { class: "pr" },
                        o.pr_no.split("/").slice(-2).join("/"),
                      ),
                      h(
                        "td",
                        null,
                        o.requirement,
                        h("div", { class: "tiny muted" }, o.location),
                      ),
                      h("td", null, fmtDate(o.raised_date)),
                      h("td", null, o.status.replace("_", " ")),
                      fin
                        ? h("td", { class: "right num" }, fmtMoney(o.amount))
                        : null,
                    ),
                  ),
                ),
              )
            : h("div", { class: "small muted" }, "No orders yet."),
        ),
      );
      const close = modal({
        title: d.vendor.name,
        wide: true,
        body,
        actions: [
          can("vendors.manage")
            ? {
                label: "Edit details",
                onClick: (c) => {
                  c();
                  vendorDialog(d.vendor);
                },
              }
            : null,
          { label: "Close" },
        ].filter(Boolean),
      });
    }
    function draw() {
      const list2 = rows2.filter((r) => showInactive || r.active);
      clear(host).append(
        h(
          "div",
          { class: "page-head" },
          h(
            "div",
            null,
            h("h1", null, "Vendors"),
            h(
              "p",
              null,
              "The empanelled vendor panel, with how each one actually performs.",
            ),
          ),
          h(
            "div",
            { class: "row gap-s" },
            checkbox("Show inactive", showInactive, {
              onchange: (e) => {
                showInactive = e.target.checked;
                draw();
              },
            }),
            can("vendors.manage")
              ? h(
                  "button",
                  { class: "btn primary", onclick: () => vendorDialog() },
                  icon("plus", 16),
                  "Add vendor",
                )
              : null,
          ),
        ),
        h(
          "div",
          { class: "card" },
          list2.length
            ? h(
                "div",
                { class: "table-wrap" },
                h(
                  "table",
                  { class: "t" },
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      h("th", null, "Vendor"),
                      h("th", null, "Contact"),
                      h("th", { class: "right" }, "Orders"),
                      h("th", { class: "right" }, "Avg production"),
                      h("th", { class: "right" }, "On-time dispatch"),
                      h("th", { class: "right" }, "Days with vendor"),
                      h("th", { class: "right" }, "Issues"),
                      fin ? h("th", { class: "right" }, "Spend") : null,
                    ),
                  ),
                  h(
                    "tbody",
                    null,
                    list2.map((v) =>
                      h(
                        "tr",
                        {
                          class: "click",
                          tabindex: 0,
                          onclick: () => detail(v),
                          onkeydown: (e) => {
                            if (e.key === "Enter") detail(v);
                          },
                        },
                        h(
                          "td",
                          null,
                          h("b", null, v.name),
                          " ",
                          !v.empanelled
                            ? badge("Not empanelled", "warn")
                            : null,
                          !v.active ? badge("Inactive") : null,
                        ),
                        h(
                          "td",
                          { class: "small" },
                          v.contact_person || "\u2014",
                          v.phone
                            ? h("div", { class: "muted" }, v.phone)
                            : null,
                        ),
                        h("td", { class: "right num" }, v.orders),
                        h("td", { class: "right num" }, days(v.avg_production)),
                        h("td", { class: "right num" }, pctTxt(v.on_time)),
                        h(
                          "td",
                          { class: "right num" },
                          days(v.avg_vendor_days),
                        ),
                        h("td", { class: "right num" }, v.issues),
                        fin
                          ? h("td", { class: "right num" }, fmtMoney(v.spend))
                          : null,
                      ),
                    ),
                  ),
                ),
              )
            : empty(
                "No vendors yet",
                "Add the vendors you buy from.",
                can("vendors.manage")
                  ? h(
                      "button",
                      { class: "btn primary", onclick: () => vendorDialog() },
                      "Add vendor",
                    )
                  : null,
              ),
        ),
      );
    }
    await load();
    return host;
  }
  var init_vendors = __esm({
    "../../../home/claude/ebo-web/web/js/pages/vendors.js"() {
      init_ui();
      init_api();
      init_state();
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/reports.js
  var reports_exports = {};
  __export(reports_exports, {
    default: () => reports_default,
  });
  async function reports_default() {
    if (!can("reports.export"))
      return h(
        "div",
        { class: "banner bad" },
        "Your role cannot export reports.",
      );
    const { reports } = await api.get("/reports");
    const meta = S2.meta;
    const f = {
      from: "",
      to: "",
      location: "",
      collateral_id: "",
      vendor_id: "",
    };
    const bind = (ctl, key) => {
      ctl.addEventListener("change", () => {
        f[key] = ctl.value;
      });
      return ctl;
    };
    const filters = h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "card-b" },
        h(
          "div",
          { class: "form-grid" },
          field("Raised from", bind(input({ type: "date" }), "from")),
          field("Raised to", bind(input({ type: "date" }), "to")),
          field(
            "Location",
            bind(
              select(
                [
                  ["", "All locations"],
                  ...meta.locations
                    .filter((l) => l.active)
                    .map((l) => [l.value, l.value]),
                ],
                "",
              ),
              "location",
            ),
          ),
          field(
            "Collateral",
            bind(
              select(
                [
                  ["", "All collaterals"],
                  ...meta.collaterals
                    .filter((c) => c.active)
                    .map((c) => [c.id, c.name]),
                ],
                "",
              ),
              "collateral_id",
            ),
          ),
          field(
            "Vendor",
            bind(
              select(
                [
                  ["", "All vendors"],
                  ...meta.vendors
                    .filter((v) => v.active)
                    .map((v) => [v.id, v.name]),
                ],
                "",
              ),
              "vendor_id",
            ),
          ),
        ),
      ),
    );
    return h(
      "div",
      { class: "stack stack-l" },
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          null,
          h("h1", null, "Reports"),
          h(
            "p",
            null,
            "Download Excel or CSV. The filters below apply to every report. You only see what your role allows.",
          ),
        ),
      ),
      filters,
      h(
        "div",
        { class: "grid g2" },
        reports.map((r) =>
          h(
            "div",
            { class: "card" },
            h(
              "div",
              { class: "card-b stack" },
              h(
                "div",
                null,
                h("h2", null, r.title),
                h(
                  "p",
                  { class: "small muted", style: { marginTop: "4px" } },
                  r.desc,
                ),
              ),
              h(
                "div",
                { class: "row gap-s" },
                h(
                  "button",
                  {
                    class: "btn primary",
                    onclick: () =>
                      download(
                        `/export/${r.key}` + qs({ ...f, format: "xlsx" }),
                      ).catch(errToast),
                  },
                  icon("download", 16),
                  "Excel",
                ),
                r.key !== "summary"
                  ? h(
                      "button",
                      {
                        class: "btn",
                        onclick: () =>
                          download(
                            `/export/${r.key}` + qs({ ...f, format: "csv" }),
                          ).catch(errToast),
                      },
                      "CSV",
                    )
                  : null,
              ),
            ),
          ),
        ),
      ),
    );
  }
  var init_reports = __esm({
    "../../../home/claude/ebo-web/web/js/pages/reports.js"() {
      init_ui();
      init_api();
      init_state();
    },
  });

  // ../../../home/claude/ebo-web/web/js/pages/admin.js
  var admin_exports = {};
  __export(admin_exports, {
    default: () => admin_default,
  });
  async function admin_default({ query, params }) {
    const allowed = TABS.filter((t) => can(t[2]));
    if (!S2.user.is_owner)
      return h(
        "div",
        { class: "banner bad" },
        "Only the primary owner can access Admin Console.",
      );
    if (!allowed.length)
      return h(
        "div",
        { class: "banner bad" },
        "Your role has no admin access.",
      );
    let tab =
      params[0] && allowed.some((t) => t[0] === params[0])
        ? params[0]
        : allowed[0][0];
    let D = await api.get("/admin/overview").catch(() => null);
    const host = h("div", { class: "stack" });
    const pane = h("div", { class: "stack stack-l" });
    const tabBar = h("div", { class: "tabs", role: "tablist" });
    const reload = async () => {
      await loadMeta();
      D = await api.get("/admin/overview");
      drawPane();
    };
    const run = async (fn, msg) => {
      try {
        const r = await fn();
        if (msg) toast(r && r.message ? r.message : msg);
        await reload();
        return r;
      } catch (e) {
        errToast(e);
      }
    };
    const roleName = (id) =>
      (D.roles.find((r) => r.id === id) || {}).name || "\u2014";
    function usersPane() {
      return [
        h(
          "div",
          null,
          h("h2", null, "Supabase Auth users"),
          h(
            "p",
            { class: "muted" },
            "Create accounts and set passwords in Supabase Auth. Refresh to sync users, then assign a role here. Unassigned users have no dashboard access.",
          ),
        ),
        h("button", { class: "btn", onclick: reload }, "Refresh users"),
        h(
          "div",
          { class: "card table-wrap" },
          h(
            "table",
            { class: "t" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                ...["Email", "Name", "Role", "Access", "Action"].map((x) =>
                  h("th", null, x),
                ),
              ),
            ),
            h(
              "tbody",
              null,
              D.users.map((u) => {
                const role = select(
                  [["", "Unassigned"], ...D.roles.map((r) => [r.id, r.name])],
                  u.role_id || "",
                );
                const active = checkbox("Enabled", u.active);
                const owner = u.is_owner;
                return h(
                  "tr",
                  null,
                  h("td", null, u.email),
                  h("td", null, u.name),
                  h("td", null, owner ? "Primary owner" : role),
                  h("td", null, owner ? "Protected" : active),
                  h(
                    "td",
                    null,
                    owner
                      ? null
                      : h(
                          "button",
                          {
                            class: "btn sm",
                            onclick: () =>
                              run(
                                () =>
                                  api.put("/admin/users/" + u.id, {
                                    role_id: role.value
                                      ? Number(role.value)
                                      : null,
                                    active: cb(active),
                                  }),
                                "Access updated",
                              ),
                          },
                          "Save",
                        ),
                  ),
                );
              }),
            ),
          ),
        ),
      ];
    }
    let selRole = null;
    function rolesPane() {
      if (!selRole || !D.roles.find((r2) => r2.id === selRole))
        selRole = D.roles[1] ? D.roles[1].id : D.roles[0].id;
      const r = D.roles.find((x) => x.id === selRole);
      const perms = new Set(r.permissions);
      const name = input({ value: r.name, disabled: r.is_system }),
        desc = input({ value: r.description, disabled: r.is_system });
      const poc = select(
        [
          ["", "Not in a POC list"],
          ["marketing", "Marketing POC list"],
          ["ops", "Procurement POC list"],
        ],
        r.poc_type || "",
        { disabled: r.is_system },
      );
      const list2 = h(
        "div",
        { class: "stack-s stack" },
        D.roles.map((x) =>
          h(
            "button",
            {
              class: "chip" + (x.id === selRole ? " on" : ""),
              style: { justifyContent: "space-between", borderRadius: "8px" },
              onclick: () => {
                selRole = x.id;
                drawPane();
              },
            },
            x.name,
            h(
              "span",
              { class: "small muted" },
              `${x.user_count} user${x.user_count === 1 ? "" : "s"}`,
            ),
          ),
        ),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              const n = input({ placeholder: "e.g. Finance reviewer" });
              modal({
                title: "Add role",
                body: field(
                  "Role name",
                  n,
                  "You set what it can do next.",
                  true,
                ),
                actions: [
                  { label: "Cancel" },
                  {
                    label: "Add role",
                    kind: "primary",
                    onClick: async (close) => {
                      const res = await api.post("/admin/roles", {
                        name: n.value,
                        permissions: ["dashboard.view", "requests.view_all"],
                      });
                      close();
                      selRole = res.id;
                      await reload();
                    },
                  },
                ],
              });
            },
          },
          icon("plus", 16),
          "Add role",
        ),
      );
      const matrix = r.is_system
        ? h(
            "div",
            { class: "banner" },
            "The Admin role always has full access and cannot be edited.",
          )
        : h(
            "div",
            { class: "stack" },
            D.permissions.map((g) =>
              h(
                "div",
                null,
                h("h3", { style: { marginBottom: "6px" } }, g.group),
                h(
                  "div",
                  { class: "perm-grid" },
                  g.items.map(([k, l]) =>
                    checkbox(l, perms.has(k), {
                      onchange: (e) => {
                        if (e.target.checked) perms.add(k);
                        else perms.delete(k);
                      },
                    }),
                  ),
                ),
              ),
            ),
          );
      return [
        h(
          "div",
          null,
          h("h2", null, "Roles and access"),
          h(
            "p",
            { class: "small muted" },
            "Tick what each role can do. Changes apply the next time the person loads a page.",
          ),
        ),
        h(
          "div",
          {
            class: "grid",
            style: {
              gridTemplateColumns: "240px minmax(0, 1fr)",
              alignItems: "start",
            },
          },
          list2,
          h(
            "div",
            { class: "card" },
            h(
              "div",
              { class: "card-b stack" },
              h(
                "div",
                { class: "form-grid" },
                field("Role name", name),
                field("Description", desc),
                field(
                  "Shows in dropdowns",
                  poc,
                  "Who can be picked as Marketing or Procurement POC on a request.",
                ),
              ),
              matrix,
              r.is_system
                ? null
                : h(
                    "div",
                    {
                      class: "row sticky-actions",
                      style: { justifyContent: "space-between" },
                    },
                    h(
                      "button",
                      {
                        class: "btn danger",
                        onclick: async () => {
                          if (
                            await confirmDialog(
                              "Delete this role?",
                              r.name,
                              "Delete",
                              "danger",
                            )
                          )
                            run(
                              () => api.del("/admin/roles/" + r.id),
                              "Role deleted",
                            );
                        },
                      },
                      "Delete role",
                    ),
                    h(
                      "button",
                      {
                        class: "btn primary",
                        onclick: () =>
                          run(
                            () =>
                              api.put("/admin/roles/" + r.id, {
                                name: name.value,
                                description: desc.value,
                                poc_type: poc.value,
                                permissions: [...perms],
                              }),
                            "Role saved",
                          ),
                      },
                      "Save role",
                    ),
                  ),
            ),
          ),
        ),
      ];
    }
    function stepDialog(s) {
      const isNew = !s;
      const v = s || {
        name: "",
        description: "",
        owner_party: "Procurement",
        update_roles: [],
        esc1_roles: [],
        esc2_roles: [],
        sla_mode: "fixed",
        sla_days: null,
        esc1_grace_days: 0,
        esc2_after_days: 2,
        active: 1,
        parallel_with_prev: 0,
        starts_lead_time: 0,
        ends_lead_time: 0,
        is_delivery: 0,
        req_quotes: 0,
        req_vendor: 0,
        req_attachment: 0,
        auto_done: 0,
      };
      const upd = new Set(v.update_roles),
        e1 = new Set(v.esc1_roles),
        e2 = new Set(v.esc2_roles);
      const f = {
        name: input({ value: v.name }),
        description: textarea({ rows: 2, value: v.description }),
        owner: select(S2.meta.parties, v.owner_party),
        mode: select(
          [
            ["fixed", "Fixed number of working days"],
            ["lead_time", "Standard lead time of the collateral"],
          ],
          v.sla_mode,
        ),
        sla: input({
          type: "number",
          min: 0,
          value: v.sla_days ?? "",
          placeholder: "None",
        }),
        grace: input({ type: "number", min: 0, value: v.esc1_grace_days }),
        after: input({ type: "number", min: 0, value: v.esc2_after_days }),
      };
      const flags = [
        [
          "parallel_with_prev",
          "Runs in parallel with the step above (either can finish first)",
        ],
        ["active", "Step is in use"],
        ["starts_lead_time", "Starts the lead-time countdown when done"],
        ["ends_lead_time", "Ends the lead-time countdown (dispatch)"],
        ["is_delivery", "Marks delivery (used for on-time delivery)"],
        ["req_quotes", "Needs the vendor shortlist filled first"],
        ["req_vendor", "Needs a selected vendor and rate"],
        ["req_attachment", "Needs a file attached (e.g. QC photos)"],
        ["auto_done", "Completes automatically when the request is raised"],
      ];
      const fl = Object.fromEntries(
        flags.map(([k, l]) => [k, checkbox(l, !!v[k])]),
      );
      modal({
        title: isNew ? "Add step" : `Edit step: ${v.name}`,
        wide: true,
        body: h(
          "div",
          { class: "stack" },
          h(
            "div",
            { class: "form-grid", style: { gridTemplateColumns: "1fr 1fr" } },
            field("Step name", f.name, null, true),
            field(
              "Owner",
              f.owner,
              "Colours the step and decides who gets the alert.",
            ),
            h(
              "div",
              { class: "full" },
              field("What happens in this step", f.description),
            ),
          ),
          h(
            "div",
            null,
            h("div", { class: "label" }, "Who can mark this step done"),
            roleBoxes(
              D.roles.filter((r) => !r.is_system),
              upd,
            ),
          ),
          h("hr", { class: "sep" }),
          h("h3", null, "Target time and escalation"),
          h(
            "div",
            { class: "form-grid", style: { gridTemplateColumns: "1fr 1fr" } },
            field("Target is", f.mode),
            field(
              "Working days",
              f.sla,
              "Used for fixed targets. Leave empty for no target.",
            ),
            field("Escalate to lead after (working days past target)", f.grace),
            field("Escalate to heads after (more days)", f.after),
          ),
          h(
            "div",
            null,
            h("div", { class: "label" }, "First escalation goes to"),
            roleBoxes(
              D.roles.filter((r) => !r.is_system),
              e1,
            ),
          ),
          h(
            "div",
            null,
            h("div", { class: "label" }, "Second escalation goes to"),
            roleBoxes(
              D.roles.filter((r) => !r.is_system),
              e2,
            ),
          ),
          h("hr", { class: "sep" }),
          h("h3", null, "Rules"),
          h("div", { class: "perm-grid" }, Object.values(fl)),
        ),
        actions: [
          { label: "Cancel" },
          {
            label: isNew ? "Add step" : "Save step",
            kind: "primary",
            onClick: async (close) => {
              const body = {
                name: f.name.value,
                description: f.description.value,
                owner_party: f.owner.value,
                update_roles: [...upd],
                sla_mode: f.mode.value,
                sla_days: f.sla.value,
                esc1_grace_days: f.grace.value,
                esc2_after_days: f.after.value,
                esc1_roles: [...e1],
                esc2_roles: [...e2],
              };
              for (const [k] of flags) body[k] = cb(fl[k]);
              if (isNew) await api.post("/admin/steps", body);
              else await api.put("/admin/steps/" + s.id, body);
              close();
              toast("Step saved");
              await reload();
            },
          },
        ],
      });
    }
    function workflowPane() {
      const steps = D.steps;
      const move = async (i, d) => {
        const ids = steps.map((s) => s.id);
        const j = i + d;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        run(() => api.post("/admin/steps/reorder", { ids }), "Order saved");
      };
      return [
        h(
          "div",
          { class: "row between wrap" },
          h(
            "div",
            null,
            h("h2", null, "Workflow steps"),
            h(
              "p",
              { class: "small muted" },
              "The path every request follows. Change the order, owners, targets and rules. Changes apply to all open requests straight away.",
            ),
          ),
          h(
            "button",
            { class: "btn primary", onclick: () => stepDialog() },
            icon("plus", 16),
            "Add step",
          ),
        ),
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "table-wrap" },
            h(
              "table",
              { class: "t" },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  h("th"),
                  h("th", null, "Step"),
                  h("th", null, "Owner"),
                  h("th", null, "Who updates"),
                  h("th", null, "Target"),
                  h("th", null, "Rules"),
                  h("th"),
                ),
              ),
              h(
                "tbody",
                null,
                steps.map((s, i) =>
                  h(
                    "tr",
                    { style: s.active ? null : { opacity: 0.55 } },
                    h(
                      "td",
                      { class: "nowrap" },
                      h(
                        "button",
                        {
                          class: "btn sm ghost",
                          "aria-label": "Move up",
                          disabled: i === 0,
                          onclick: () => move(i, -1),
                        },
                        icon("up", 14),
                      ),
                      h(
                        "button",
                        {
                          class: "btn sm ghost",
                          "aria-label": "Move down",
                          disabled: i === steps.length - 1,
                          onclick: () => move(i, 1),
                        },
                        icon("down", 14),
                      ),
                    ),
                    h(
                      "td",
                      { class: "wrap" },
                      h("b", null, s.name),
                      s.parallel_with_prev
                        ? h(
                            "div",
                            { class: "tiny muted" },
                            "In parallel with the step above",
                          )
                        : null,
                      !s.active ? badge("Switched off") : null,
                    ),
                    h("td", null, party(s.owner_party)),
                    h(
                      "td",
                      { class: "small wrap" },
                      s.update_roles.map(roleName).join(", ") ||
                        h("span", { class: "muted" }, "Managers only"),
                    ),
                    h(
                      "td",
                      { class: "small" },
                      s.sla_mode === "lead_time"
                        ? "Collateral lead time"
                        : s.sla_days != null
                          ? `${s.sla_days} working day${s.sla_days === 1 ? "" : "s"}`
                          : "\u2014",
                    ),
                    h(
                      "td",
                      { class: "small wrap" },
                      [
                        s.starts_lead_time ? "Starts lead time" : "",
                        s.ends_lead_time ? "Ends lead time" : "",
                        s.is_delivery ? "Delivery" : "",
                        s.req_quotes ? "Needs shortlist" : "",
                        s.req_vendor ? "Needs vendor" : "",
                        s.req_attachment ? "Needs file" : "",
                        s.auto_done ? "Auto" : "",
                      ]
                        .filter(Boolean)
                        .join(" \xB7 "),
                    ),
                    h(
                      "td",
                      { class: "right nowrap" },
                      h(
                        "button",
                        { class: "btn sm", onclick: () => stepDialog(s) },
                        "Edit",
                      ),
                      " ",
                      h(
                        "button",
                        {
                          class: "btn sm ghost",
                          "aria-label": "Delete step",
                          onclick: async () => {
                            if (
                              await confirmDialog(
                                "Remove this step?",
                                `${s.name}. If requests already used it, it is switched off and their history stays.`,
                                "Remove",
                                "danger",
                              )
                            )
                              run(
                                () => api.del("/admin/steps/" + s.id),
                                "Step removed",
                              );
                          },
                        },
                        icon("trash", 14),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        h(
          "div",
          { class: "banner" },
          icon("clock", 18),
          h(
            "div",
            null,
            "Targets use working days: Sundays and the holidays set under Settings and calendar are skipped.",
          ),
        ),
      ];
    }
    function leadPane() {
      const dlg = (c) => {
        const f = {
          name: input({ value: c ? c.name : "" }),
          lead: input({ type: "number", min: 1, value: c ? c.lead_days : "" }),
          max: input({
            type: "number",
            min: 1,
            value: c && c.lead_days_max ? c.lead_days_max : "",
            placeholder: "Optional",
          }),
          notes: input({ value: c ? c.notes : "" }),
        };
        const act = checkbox("In use", c ? c.active : true);
        modal({
          title: c ? "Edit collateral" : "Add collateral",
          body: h(
            "div",
            { class: "form-grid", style: { gridTemplateColumns: "1fr 1fr" } },
            h(
              "div",
              { class: "full" },
              field("Collateral", f.name, null, true),
            ),
            field(
              "Standard lead time (working days)",
              f.lead,
              "From final artwork approval to dispatch.",
              true,
            ),
            field("Up to (if it is a range)", f.max),
            h("div", { class: "full" }, field("Notes", f.notes)),
            c ? act : null,
          ),
          actions: [
            { label: "Cancel" },
            {
              label: "Save",
              kind: "primary",
              onClick: async (close) => {
                const b = {
                  name: f.name.value,
                  lead_days: f.lead.value,
                  lead_days_max: f.max.value,
                  notes: f.notes.value,
                };
                if (c) {
                  b.active = cb(act);
                  await api.put("/admin/collaterals/" + c.id, b);
                } else await api.post("/admin/collaterals", b);
                close();
                toast("Saved");
                await reload();
              },
            },
          ],
        });
      };
      return [
        h(
          "div",
          { class: "row between wrap" },
          h(
            "div",
            null,
            h("h2", null, "Lead times"),
            h(
              "p",
              { class: "small muted" },
              "Standard production time per collateral (SOP 10.3). Drives the expected dispatch date and the production target.",
            ),
          ),
          h(
            "button",
            { class: "btn primary", onclick: () => dlg() },
            icon("plus", 16),
            "Add collateral",
          ),
        ),
        h(
          "div",
          { class: "card" },
          h(
            "table",
            { class: "t" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                h("th", null, "Collateral"),
                h("th", { class: "right" }, "Lead time (working days)"),
                h("th", null, "Notes"),
                h("th"),
              ),
            ),
            h(
              "tbody",
              null,
              D.collaterals.map((c) =>
                h(
                  "tr",
                  { style: c.active ? null : { opacity: 0.55 } },
                  h(
                    "td",
                    null,
                    h("b", null, c.name),
                    !c.active ? [" ", badge("Not in use")] : null,
                  ),
                  h(
                    "td",
                    { class: "right num" },
                    c.lead_days_max
                      ? `${c.lead_days}\u2013${c.lead_days_max}`
                      : c.lead_days,
                  ),
                  h("td", { class: "small" }, c.notes),
                  h(
                    "td",
                    { class: "right nowrap" },
                    h(
                      "button",
                      { class: "btn sm", onclick: () => dlg(c) },
                      "Edit",
                    ),
                    " ",
                    h(
                      "button",
                      {
                        class: "btn sm ghost",
                        "aria-label": "Delete",
                        onclick: async () => {
                          if (
                            await confirmDialog(
                              "Remove this collateral?",
                              c.name,
                              "Remove",
                              "danger",
                            )
                          )
                            run(
                              () => api.del("/admin/collaterals/" + c.id),
                              "Removed",
                            );
                        },
                      },
                      icon("trash", 14),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ];
    }
    function listsPane() {
      return [
        h(
          "div",
          null,
          h("h2", null, "Lists"),
          h(
            "p",
            { class: "small muted" },
            "The choices people see in dropdowns. Anything already used on a request is switched off rather than deleted, so history stays intact.",
          ),
        ),
        h(
          "div",
          { class: "grid g2" },
          LIST_TYPES.map(([type, title, hint]) => {
            const items = D.lookups.filter((l) => l.type === type);
            const add = input({
              placeholder: "Add new",
              "aria-label": `Add to ${title}`,
              onkeydown: (e) => {
                if (e.key === "Enter") addBtn.click();
              },
            });
            const addBtn = h(
              "button",
              {
                class: "btn",
                onclick: async () => {
                  if (!add.value.trim()) return;
                  await run(
                    () =>
                      api.post("/admin/lookups", { type, value: add.value }),
                    "Added",
                  );
                },
              },
              "Add",
            );
            const edit = (l) => {
              const val = input({ value: l.value }),
                act = checkbox("In use", l.active);
              const m = l.meta || {};
              const mq = input({
                  type: "number",
                  min: 1,
                  value: m.min_quotes || 1,
                }),
                rr = checkbox("Needs a business reason", m.requires_reason),
                ur = checkbox("Counts as urgent in reports", m.urgent),
                md = input({ value: m.description || "" });
              modal({
                title: `Edit ${l.value}`,
                body: h(
                  "div",
                  { class: "stack" },
                  field("Name", val),
                  type === "request_type"
                    ? [
                        field(
                          "Vendors to compare",
                          mq,
                          "Number of vendors that must be on the shortlist.",
                        ),
                        rr,
                        ur,
                        field("Help text", md),
                      ]
                    : null,
                  act,
                ),
                actions: [
                  { label: "Cancel" },
                  {
                    label: "Save",
                    kind: "primary",
                    onClick: async (close) => {
                      await api.put("/admin/lookups/" + l.id, {
                        value: val.value,
                        active: cb(act),
                        meta:
                          type === "request_type"
                            ? {
                                min_quotes: mq.value,
                                requires_reason: cb(rr),
                                urgent: cb(ur),
                                description: md.value,
                              }
                            : void 0,
                      });
                      close();
                      toast("Saved");
                      await reload();
                    },
                  },
                ],
              });
            };
            return h(
              "div",
              { class: "card" },
              h(
                "div",
                { class: "card-h" },
                h(
                  "div",
                  null,
                  h("h3", null, title),
                  h("div", { class: "small muted" }, hint),
                ),
              ),
              h(
                "div",
                { class: "card-b stack-s stack" },
                items.map((l) =>
                  h(
                    "div",
                    {
                      class: "row",
                      style: l.active ? null : { opacity: 0.55 },
                    },
                    h(
                      "div",
                      { class: "grow" },
                      l.value,
                      type === "party" ? [" ", party(l.value)] : null,
                      type === "request_type"
                        ? h(
                            "span",
                            { class: "tiny muted" },
                            ` \xB7 ${l.meta.min_quotes || 1} vendor${(l.meta.min_quotes || 1) > 1 ? "s" : ""}${l.meta.urgent ? " \xB7 urgent" : ""}`,
                          )
                        : null,
                      !l.active
                        ? h("span", { class: "tiny muted" }, " (not in use)")
                        : null,
                    ),
                    h(
                      "button",
                      { class: "btn sm ghost", onclick: () => edit(l) },
                      "Edit",
                    ),
                    h(
                      "button",
                      {
                        class: "btn sm ghost",
                        "aria-label": "Delete",
                        onclick: async () => {
                          if (
                            await confirmDialog(
                              "Remove from the list?",
                              l.value,
                              "Remove",
                              "danger",
                            )
                          )
                            run(
                              () => api.del("/admin/lookups/" + l.id),
                              "Removed",
                            );
                        },
                      },
                      icon("trash", 14),
                    ),
                  ),
                ),
                h("div", { class: "row" }, add, addBtn),
              ),
            );
          }),
        ),
      ];
    }
    function fieldsPane() {
      const dlg = (fd) => {
        const f = {
          label: input({ value: fd ? fd.label : "" }),
          type: select(
            [
              ["text", "Short text"],
              ["textarea", "Long text"],
              ["number", "Number"],
              ["date", "Date"],
              ["select", "Dropdown"],
              ["checkbox", "Yes / no"],
            ],
            fd ? fd.type : "text",
            { disabled: !!fd },
          ),
          options: textarea({
            rows: 3,
            value: fd ? fd.options.join("\n") : "",
            placeholder: "One choice per line",
          }),
        };
        const req = checkbox(
            "Required when raising a request",
            fd ? fd.required : false,
          ),
          lst = checkbox(
            "Show as a column in the Excel register",
            fd ? fd.show_in_list : true,
          ),
          act = checkbox("In use", fd ? fd.active : true);
        modal({
          title: fd ? "Edit field" : "Add field",
          body: h(
            "div",
            { class: "stack" },
            field(
              "Label",
              f.label,
              "What people see on the request form.",
              true,
            ),
            field("Type", f.type),
            field("Choices", f.options, "Only for dropdowns."),
            req,
            lst,
            fd ? act : null,
          ),
          actions: [
            { label: "Cancel" },
            {
              label: "Save field",
              kind: "primary",
              onClick: async (close) => {
                const b = {
                  label: f.label.value,
                  type: f.type.value,
                  options: f.options.value,
                  required: cb(req),
                  show_in_list: cb(lst),
                };
                if (fd) {
                  b.active = cb(act);
                  await api.put("/admin/fields/" + fd.id, b);
                } else await api.post("/admin/fields", b);
                close();
                toast("Saved");
                await reload();
              },
            },
          ],
        });
      };
      return [
        h(
          "div",
          { class: "row between wrap" },
          h(
            "div",
            null,
            h("h2", null, "Extra fields"),
            h(
              "p",
              { class: "small muted" },
              "Add your own questions to the request form, such as cost centre or campaign. They show on the request and in exports.",
            ),
          ),
          h(
            "button",
            { class: "btn primary", onclick: () => dlg() },
            icon("plus", 16),
            "Add field",
          ),
        ),
        h(
          "div",
          { class: "card" },
          D.custom_fields.length
            ? h(
                "table",
                { class: "t" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "Label"),
                    h("th", null, "Type"),
                    h("th", null, "Required"),
                    h("th"),
                  ),
                ),
                h(
                  "tbody",
                  null,
                  D.custom_fields.map((fd) =>
                    h(
                      "tr",
                      { style: fd.active ? null : { opacity: 0.55 } },
                      h(
                        "td",
                        null,
                        h("b", null, fd.label),
                        fd.type === "select"
                          ? h(
                              "div",
                              { class: "tiny muted" },
                              fd.options.join(", "),
                            )
                          : null,
                      ),
                      h("td", null, fd.type),
                      h("td", null, fd.required ? "Yes" : "No"),
                      h(
                        "td",
                        { class: "right nowrap" },
                        h(
                          "button",
                          { class: "btn sm", onclick: () => dlg(fd) },
                          "Edit",
                        ),
                        " ",
                        h(
                          "button",
                          {
                            class: "btn sm ghost",
                            "aria-label": "Hide field",
                            onclick: async () => {
                              if (
                                await confirmDialog(
                                  "Hide this field?",
                                  "Values already saved on requests are kept.",
                                  "Hide",
                                  "danger",
                                )
                              )
                                run(
                                  () => api.del("/admin/fields/" + fd.id),
                                  "Field hidden",
                                );
                            },
                          },
                          icon("trash", 14),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : empty(
                "No extra fields yet",
                "Add one if your team tracks something the form does not ask.",
              ),
        ),
      ];
    }
    function settingsPane() {
      const s = D.settings;
      const f = {
        app: input({ value: s.app_name }),
        company: input({ value: s.company_name }),
        prefix: input({ value: s.pr_prefix }),
        fy: select(
          [
            [1, "January"],
            [2, "February"],
            [3, "March"],
            [4, "April"],
            [5, "May"],
            [6, "June"],
            [7, "July"],
            [8, "August"],
            [9, "September"],
            [10, "October"],
            [11, "November"],
            [12, "December"],
          ],
          s.fy_start_month,
        ),
        tz: input({ value: s.timezone }),
        cur: input({ value: s.currency_symbol, style: { width: "80px" } }),
        thr: input({
          type: "number",
          min: 1,
          max: 100,
          value: s.urgent_monthly_review_threshold,
        }),
        sess: input({
          type: "number",
          min: 1,
          max: 168,
          value: s.session_hours,
        }),
        minpw: input({ type: "number", min: 6, value: s.min_password_length }),
      };
      const off = new Set(s.weekly_off);
      const auto = checkbox(
        "Close a request automatically when every step is done",
        s.auto_close_when_complete,
      );
      const hd = input({ type: "date" }),
        hn = input({ placeholder: "Holiday name" });
      return [
        h("div", null, h("h2", null, "Settings and calendar")),
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-b stack" },
            h("h3", null, "General"),
            h(
              "div",
              { class: "form-grid" },
              field("Tool name", f.app),
              field("Company name", f.company),
              field(
                "PR number prefix",
                f.prefix,
                `Numbers look like ${s.pr_prefix}/26-27/001`,
              ),
              field("Financial year starts in", f.fy),
              field("Time zone", f.tz, "For example Asia/Kolkata."),
              field("Currency symbol", f.cur),
              field(
                "Urgent review flag from (% of a requester's requests)",
                f.thr,
              ),
            ),
            h("h3", null, "Working week"),
            h(
              "div",
              { class: "chips" },
              DAYS.map((d, i) => {
                const c = h(
                  "button",
                  {
                    type: "button",
                    class: "chip" + (off.has(i) ? " on" : ""),
                    "aria-pressed": off.has(i),
                    onclick: () => {
                      if (off.has(i)) off.delete(i);
                      else off.add(i);
                      c.classList.toggle("on");
                      c.setAttribute("aria-pressed", off.has(i));
                    },
                  },
                  d,
                );
                return c;
              }),
            ),
            h(
              "div",
              { class: "small muted" },
              "Highlighted days are days off. They are skipped when counting working days.",
            ),
            h("h3", null, "Security"),
            h(
              "div",
              { class: "form-grid" },
              field("Stay signed in for (hours)", f.sess),
              field("Minimum password length", f.minpw),
            ),
            auto,
            h(
              "div",
              { class: "row", style: { justifyContent: "flex-end" } },
              h(
                "button",
                {
                  class: "btn primary",
                  onclick: () =>
                    run(
                      () =>
                        api.put("/admin/settings", {
                          app_name: f.app.value,
                          company_name: f.company.value,
                          pr_prefix: f.prefix.value,
                          fy_start_month: f.fy.value,
                          timezone: f.tz.value,
                          currency_symbol: f.cur.value,
                          urgent_monthly_review_threshold: f.thr.value,
                          session_hours: f.sess.value,
                          min_password_length: f.minpw.value,
                          weekly_off: [...off],
                          auto_close_when_complete: cb(auto),
                        }),
                      "Settings saved",
                    ),
                },
                "Save settings",
              ),
            ),
          ),
        ),
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-b stack" },
            h(
              "div",
              null,
              h("h3", null, "Holidays"),
              h(
                "p",
                { class: "small muted" },
                "Days when vendors and offices are closed. They are not counted as working days.",
              ),
            ),
            h(
              "div",
              { class: "row wrap" },
              hd,
              hn,
              h(
                "button",
                {
                  class: "btn",
                  onclick: () =>
                    run(
                      () =>
                        api.post("/admin/holidays", {
                          date: hd.value,
                          name: hn.value,
                        }),
                      "Holiday added",
                    ),
                },
                "Add holiday",
              ),
            ),
            D.holidays.length
              ? h(
                  "div",
                  { class: "chips" },
                  D.holidays.map((x) =>
                    h(
                      "span",
                      { class: "chip", style: { cursor: "default" } },
                      `${fmtDate(x.date, true)}${x.name ? " \xB7 " + x.name : ""}`,
                      h(
                        "button",
                        {
                          class: "btn ghost sm",
                          style: { padding: "0 4px" },
                          "aria-label": "Remove holiday",
                          onclick: () =>
                            run(
                              () => api.del("/admin/holidays/" + x.date),
                              "Removed",
                            ),
                        },
                        "\xD7",
                      ),
                    ),
                  ),
                )
              : h("div", { class: "small muted" }, "No holidays added yet."),
          ),
        ),
      ];
    }
    function dataPane() {
      const file = input({ type: "file", accept: ".xlsx" });
      const out = h("div", { class: "stack" });
      return [
        h(
          "div",
          null,
          h("h2", null, "Data"),
          h(
            "p",
            { class: "small muted" },
            `${D.request_count} real request${D.request_count === 1 ? "" : "s"} in the tool${D.demo_count ? `, plus ${D.demo_count} sample` : ""}.`,
          ),
        ),
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-b stack" },
            h("h3", null, "Import from the Excel tracker"),
            h(
              "p",
              { class: "small muted" },
              'Use the same layout as your current sheet (header row with "PR No." in column A). Requests that are already here are skipped. Accounts are managed only in Supabase Auth.',
            ),
            h(
              "div",
              { class: "row wrap" },
              file,
              h(
                "button",
                {
                  class: "btn primary",
                  onclick: async () => {
                    if (!file.files[0])
                      return toast("Choose the Excel file first.", "bad");
                    try {
                      const grid = await readTrackerGrid(file.files[0]);
                      const r = await api.post("/admin/import", { rows: grid });
                      const rep = r.report;
                      await reload();
                      const lines = rep.users_created.map(
                        (u) => `${u.name} (${u.username}): ${u.password}`,
                      );
                      modal({
                        title: `${rep.created} request${rep.created === 1 ? "" : "s"} imported`,
                        body: h(
                          "div",
                          { class: "stack" },
                          h("div", null, `${rep.skipped.length} skipped.`),
                          rep.users_created.length
                            ? h(
                                "div",
                                { class: "banner warn" },
                                h(
                                  "div",
                                  null,
                                  h(
                                    "b",
                                    null,
                                    "New users were created. Copy these temporary passwords now. They are shown only once:",
                                  ),
                                  lines.map((l) =>
                                    h(
                                      "div",
                                      {
                                        class: "small",
                                        style: { userSelect: "all" },
                                      },
                                      l,
                                    ),
                                  ),
                                ),
                              )
                            : null,
                          [...rep.warnings, ...rep.skipped].map((w) =>
                            h("div", { class: "small muted" }, w),
                          ),
                        ),
                        actions: [{ label: "Done", kind: "primary" }],
                      });
                    } catch (e) {
                      errToast(e);
                    }
                  },
                },
                icon("upload", 16),
                "Import",
              ),
            ),
            out,
          ),
        ),
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-b stack" },
            h("h3", null, "Backup"),
            h(
              "p",
              { class: "small muted" },
              "Downloads all requests, steps, vendors, users and settings as one file you can keep safe. Uploaded files are not included. Configure database backups separately in Supabase.",
            ),
            h(
              "div",
              null,
              h(
                "button",
                {
                  class: "btn",
                  onclick: () => download("/admin/backup").catch(errToast),
                },
                icon("download", 16),
                "Download data backup",
              ),
            ),
          ),
        ),
      ];
    }
    let auditRows = null;
    function auditPane() {
      const body = h("div", { class: "card" }, spinner());
      api
        .get("/admin/audit?limit=300")
        .then((r) => {
          clear(body).append(
            h(
              "div",
              { class: "table-wrap" },
              h(
                "table",
                { class: "t" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "When"),
                    h("th", null, "Who"),
                    h("th", null, "Action"),
                    h("th", null, "Request"),
                    h("th", null, "Detail"),
                  ),
                ),
                h(
                  "tbody",
                  null,
                  r.rows.map((a) =>
                    h(
                      "tr",
                      null,
                      h(
                        "td",
                        { class: "nowrap small" },
                        fmtDateTime(a.created_at),
                      ),
                      h("td", null, a.user_name || "System"),
                      h("td", null, a.action.replace(/_/g, " ")),
                      h("td", null, a.pr_no || "\u2014"),
                      h(
                        "td",
                        { class: "small wrap" },
                        typeof a.detail === "string"
                          ? a.detail
                          : JSON.stringify(a.detail),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        })
        .catch((e) =>
          clear(body).append(h("div", { class: "banner bad" }, e.message)),
        );
      return [
        h(
          "div",
          null,
          h("h2", null, "Audit log"),
          h(
            "p",
            { class: "small muted" },
            "The latest 300 actions across the tool: sign-ins, edits, step changes and admin changes.",
          ),
        ),
        body,
      ];
    }
    const panes = {
      users: usersPane,
      roles: rolesPane,
      workflow: workflowPane,
      leadtimes: leadPane,
      lists: listsPane,
      fields: fieldsPane,
      settings: settingsPane,
      data: dataPane,
      audit: auditPane,
    };
    function drawPane() {
      clear(tabBar).append(
        ...allowed.map(([k, l]) =>
          h(
            "button",
            {
              class: "tab" + (tab === k ? " on" : ""),
              role: "tab",
              "aria-selected": tab === k,
              onclick: () => {
                tab = k;
                history.replaceState(null, "", "#/admin/" + k);
                drawPane();
              },
            },
            l,
          ),
        ),
      );
      clear(pane).append(...panes[tab]().flat());
    }
    host.append(
      h(
        "div",
        { class: "page-head", style: { marginBottom: 0 } },
        h(
          "div",
          null,
          h("h1", null, "Admin console"),
          h(
            "p",
            null,
            "Shape the tool to how your team works: people, access, steps, targets and lists.",
          ),
        ),
      ),
      h("div", { class: "card" }, tabBar),
      pane,
    );
    if (D) drawPane();
    else
      host.append(
        h("div", { class: "banner bad" }, "Could not load admin data."),
      );
    return host;
  }
  var TABS, LIST_TYPES, DAYS, roleBoxes, cb;
  var init_admin = __esm({
    "../../../home/claude/ebo-web/web/js/pages/admin.js"() {
      init_ui();
      init_api();
      init_state();
      TABS = [
        ["users", "Users", "admin.users"],
        ["roles", "Roles and access", "admin.roles"],
        ["workflow", "Workflow steps", "admin.config"],
        ["leadtimes", "Lead times", "admin.config"],
        ["lists", "Lists", "admin.config"],
        ["fields", "Extra fields", "admin.config"],
        ["settings", "Settings and calendar", "admin.config"],
        ["data", "Data", "admin.import"],
        ["audit", "Audit log", "audit.view"],
      ];
      LIST_TYPES = [
        [
          "location",
          "Locations",
          "EBOs, kiosks, warehouses that raise requests",
        ],
        ["request_type", "Request types", "How a request is sourced"],
        ["issue_type", "Issue types", "Mistakes and delays you want to track"],
        [
          "cancel_reason",
          "Cancellation reasons",
          "Shown when a request is cancelled",
        ],
        [
          "party",
          "Owners (parties)",
          "Who can own a step. Each has its own colour in the tracker",
        ],
      ];
      DAYS = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      roleBoxes = (roles, sel) =>
        h(
          "div",
          { class: "chips" },
          roles.map((r) => {
            const on = sel.has(r.id);
            const c = h(
              "button",
              {
                type: "button",
                class: "chip" + (on ? " on" : ""),
                "aria-pressed": on,
                onclick: () => {
                  if (sel.has(r.id)) sel.delete(r.id);
                  else sel.add(r.id);
                  c.classList.toggle("on");
                  c.setAttribute("aria-pressed", sel.has(r.id));
                },
              },
              r.name,
            );
            return c;
          }),
        );
      cb = (el) => el.querySelector("input").checked;
    },
  });

  // snap.json
  // ../../../home/claude/ebo-web/web/js/app.js
  init_ui();
  init_api();
  init_state();
  var root = document.getElementById("root");
  var pages = {
    dashboard: () =>
      Promise.resolve().then(() => (init_dashboard(), dashboard_exports)),
    tasks: () => Promise.resolve().then(() => (init_tasks(), tasks_exports)),
    requests: () =>
      Promise.resolve().then(() => (init_requests(), requests_exports)),
    request: () =>
      Promise.resolve().then(() => (init_request(), request_exports)),
    new: () =>
      Promise.resolve().then(() => (init_newrequest(), newrequest_exports)),
    vendors: () =>
      Promise.resolve().then(() => (init_vendors(), vendors_exports)),
    reports: () =>
      Promise.resolve().then(() => (init_reports(), reports_exports)),
    admin: () => Promise.resolve().then(() => (init_admin(), admin_exports)),
  };
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }
  try {
    applyTheme(localStorage.getItem("ebo-theme"));
  } catch (e) {}
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem("ebo-theme", next);
    } catch (e) {}
    route();
  }
  function navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    return {
      parts: path.split("/").filter(Boolean),
      query: Object.fromEntries(new URLSearchParams(query)),
    };
  }
  var routeToken = 0;
  async function route() {
    if (!S2.user) return showLogin();
    if (S2.user.must_change_pw) return showForcedPassword();
    const { parts, query } = parseHash();
    const first = parts[0] || landing();
    const pageEl = $("#page");
    if (!pageEl) return renderShell();
    const token = ++routeToken;
    let key = first,
      params = parts.slice(1);
    if (first === "requests" && parts[1]) key = "request";
    if (!pages[key]) {
      key = landing();
      params = [];
    }
    document
      .querySelectorAll(".nav a")
      .forEach((a) =>
        a.classList.toggle(
          "active",
          a.dataset.nav ===
            (key === "request" ? "requests" : key === "new" ? "requests" : key),
        ),
      );
    document.querySelector(".side")?.classList.remove("open");
    clear(pageEl).append(
      h(
        "div",
        { class: "stack" },
        h("div", { class: "skeleton", style: { minHeight: "56px" } }),
        h("div", { class: "skeleton", style: { minHeight: "220px" } }),
      ),
    );
    try {
      const mod = await pages[key]();
      const node = await mod.default({
        params,
        query,
        navigate,
        refresh: route,
      });
      if (token !== routeToken) return;
      clear(pageEl).append(node);
      window.scrollTo(0, 0);
      document.title = `${(S2.meta && S2.meta.settings.app_name) || "BPRO"}`;
    } catch (e) {
      if (token !== routeToken) return;
      clear(pageEl).append(
        h(
          "div",
          { class: "banner bad" },
          h(
            "div",
            null,
            h("b", null, "This page could not load. "),
            e.message || "Unknown error",
          ),
        ),
      );
    }
  }
  function landing() {
    if (can("dashboard.view") && !S2.user.poc_type) return "dashboard";
    return "tasks";
  }
  window.addEventListener("hashchange", route);
  function navItem(key, label, ic, extra) {
    return h(
      "a",
      { href: "#/" + key, "data-nav": key },
      icon(ic),
      label,
      extra || null,
    );
  }
  var notifTimer;
  function renderShell() {
    clear(root);
    const m = S2.meta.settings;
    const tasksBadge = h("span", { class: "count hidden", id: "task-count" });
    const side = h(
      "aside",
      { class: "side", "aria-label": "Main navigation" },
      h(
        "div",
        { class: "brand" },
        h("div", { class: "brand-mark" }, icon("stamp", 20)),
        h(
          "div",
          null,
          h("b", null, m.app_name),
          h("span", null, m.company_name),
        ),
      ),
      h(
        "nav",
        { class: "nav" },
        can("dashboard.view")
          ? navItem("dashboard", "Dashboard", "dash")
          : null,
        navItem("tasks", "My tasks", "task", tasksBadge),
        navItem("requests", "Requests", "list"),
        canAny("vendors.view", "vendors.manage")
          ? navItem("vendors", "Vendors", "truck")
          : null,
        can("reports.export") ? navItem("reports", "Reports", "file") : null,
        canAny(
          "admin.users",
          "admin.roles",
          "admin.config",
          "admin.import",
          "audit.view",
        )
          ? [h("hr"), navItem("admin", "Admin console", "gear")]
          : null,
      ),
      h(
        "div",
        { class: "side-foot" },
        `Signed in as ${S2.user.name}`,
        h("br"),
        S2.user.role_name,
      ),
    );
    const search = h("input", {
      class: "input",
      type: "search",
      placeholder: "Search PR no., item, vendor, location",
      "aria-label": "Search requests",
      onkeydown: (e) => {
        if (e.key === "Enter" && e.target.value.trim()) {
          navigate("#/requests?q=" + encodeURIComponent(e.target.value.trim()));
          e.target.value = "";
        }
      },
    });
    const bell = h(
      "button",
      {
        class: "btn icon-btn",
        "aria-label": "Notifications",
        onclick: openNotifications,
      },
      icon("bell"),
      h("span", { class: "badge-dot hidden", id: "bell-count" }),
    );
    const userBtn = h(
      "button",
      {
        class: "btn",
        onclick: (e) => {
          e.stopPropagation();
          toggleUserMenu(userBtn);
        },
      },
      icon("user", 16),
      h("span", { class: "lbl" }, S2.user.name.split(" ")[0]),
    );
    const top = h(
      "header",
      { class: "top" },
      h(
        "button",
        {
          class: "btn icon-btn menu-btn",
          "aria-label": "Menu",
          onclick: () => side.classList.toggle("open"),
        },
        icon("menu"),
      ),
      h("div", { class: "search" }, icon("search", 16), search),
      h("div", { class: "grow" }),
      can("requests.create")
        ? h(
            "a",
            { class: "btn primary", href: "#/new" },
            icon("plus", 16),
            h("span", { class: "lbl" }, "New request"),
          )
        : null,
      bell,
      h(
        "button",
        {
          class: "btn icon-btn",
          "aria-label": "Switch light or dark theme",
          onclick: toggleTheme,
        },
        icon(
          document.documentElement.dataset.theme === "dark" ||
            (!document.documentElement.dataset.theme &&
              matchMedia("(prefers-color-scheme: dark)").matches)
            ? "sun"
            : "moon",
        ),
      ),
      h(
        "div",
        { style: { position: "relative" }, id: "user-menu-host" },
        userBtn,
      ),
    );
    root.append(
      h(
        "div",
        { class: "app" },
        side,
        h(
          "div",
          { class: "main" },
          top,
          h("main", { class: "page", id: "page" }),
        ),
      ),
    );
    document.addEventListener("click", () => $("#user-menu")?.remove());
    pollNotifications();
    clearInterval(notifTimer);
    notifTimer = setInterval(pollNotifications, 6e4);
    route();
  }
  function toggleUserMenu(btn) {
    const ex = $("#user-menu");
    if (ex) return ex.remove();
    btn.parentElement.append(
      h(
        "div",
        { class: "menu", id: "user-menu", onclick: (e) => e.stopPropagation() },
        h(
          "div",
          { style: { padding: "8px 10px" } },
          h("b", null, S2.user.name),
          h(
            "div",
            { class: "small muted" },
            `${S2.user.role_name} \xB7 ${S2.user.username}`,
          ),
        ),
        h("hr"),
        h(
          "button",
          {
            onclick: () => {
              $("#user-menu")?.remove();
              changePasswordDialog(false);
            },
          },
          icon("gear", 16),
          "Change password",
        ),
        h("button", { onclick: signOut }, icon("logout", 16), "Sign out"),
      ),
    );
  }
  async function signOut() {
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    S2.user = null;
    S2.meta = null;
    clearInterval(notifTimer);
    location.hash = "";
    showLogin();
  }
  async function pollNotifications() {
    try {
      const n = await api.get("/auth/notifications");
      const b = $("#bell-count");
      if (b) {
        b.textContent = n.unread > 9 ? "9+" : n.unread;
        b.classList.toggle("hidden", !n.unread);
      }
      const t = await api.get("/tasks");
      const mine = t.tasks.filter((x) => x.role === "action").length;
      const tc = $("#task-count");
      if (tc) {
        tc.textContent = mine;
        tc.classList.toggle("hidden", !mine);
      }
    } catch (e) {}
  }
  async function openNotifications() {
    const data = await api.get("/auth/notifications").catch((e) => {
      errToast(e);
      return null;
    });
    if (!data) return;
    const close = () => {
      drawer.remove();
      back.remove();
    };
    const back = h("div", {
      style: { position: "fixed", inset: 0, zIndex: 65 },
      onclick: close,
    });
    const list2 = h(
      "div",
      { class: "drawer-b" },
      data.rows.length
        ? data.rows.map((n) =>
            h(
              "div",
              {
                class: `notif ${n.kind} ${n.read_at ? "" : "unread"}`,
                onclick: async () => {
                  await api
                    .post("/auth/notifications/read", { id: n.id })
                    .catch(() => {});
                  close();
                  if (n.request_id) navigate("#/requests/" + n.request_id);
                  pollNotifications();
                },
              },
              h(
                "div",
                { class: "ic" },
                icon(
                  n.kind === "task"
                    ? "task"
                    : n.kind === "comment"
                      ? "file"
                      : "alert",
                  15,
                ),
              ),
              h(
                "div",
                { class: "grow" },
                h("div", { style: { fontWeight: 620 } }, n.title),
                n.body ? h("div", { class: "small ink2" }, n.body) : null,
                h("div", { class: "tiny muted" }, timeAgo(n.created_at)),
              ),
            ),
          )
        : h(
            "div",
            { class: "empty" },
            h("b", null, "Nothing new"),
            "Alerts for your turn, delays and escalations show up here.",
          ),
    );
    const drawer = h(
      "aside",
      { class: "drawer", role: "dialog", "aria-label": "Notifications" },
      h(
        "div",
        { class: "drawer-h" },
        h("h2", null, "Notifications"),
        h(
          "div",
          { class: "row gap-s" },
          h(
            "button",
            {
              class: "btn sm",
              onclick: async () => {
                await api.post("/auth/notifications/read", {});
                close();
                pollNotifications();
              },
            },
            "Mark all read",
          ),
          h(
            "button",
            {
              class: "btn ghost icon-btn",
              "aria-label": "Close",
              onclick: close,
            },
            icon("x"),
          ),
        ),
      ),
      list2,
    );
    document.body.append(back, drawer);
  }
  function changePasswordDialog(forced) {
    const cur = input({ type: "password", autocomplete: "current-password" }),
      nw = input({ type: "password", autocomplete: "new-password" }),
      nw2 = input({ type: "password", autocomplete: "new-password" });
    modal({
      title: forced ? "Set your own password" : "Change password",
      body: h(
        "div",
        { class: "stack" },
        forced
          ? h(
              "div",
              { class: "banner warn" },
              "You signed in with a temporary password. Choose your own to continue.",
            )
          : null,
        field("Current password", cur, null, true),
        field("New password", nw, "At least 12 characters.", true),
        field("Repeat new password", nw2, null, true),
      ),
      actions: [
        forced
          ? {
              label: "Sign out",
              onClick: () => {
                signOut();
              },
            }
          : { label: "Cancel" },
        {
          label: "Save password",
          kind: "primary",
          onClick: async (close) => {
            if (nw.value !== nw2.value) {
              toast("The two new passwords do not match.", "bad");
              return false;
            }
            await api.post("/auth/change-password", {
              current: cur.value,
              next: nw.value,
            });
            S2.user.must_change_pw = false;
            toast("Password changed");
            close();
            if (forced) boot();
          },
        },
      ],
    });
  }
  function showForcedPassword() {
    clear(root).append(
      h(
        "div",
        { class: "login-form", style: { minHeight: "100vh" } },
        h("div", { class: "muted" }, "Setting up your account\u2026"),
      ),
    );
    changePasswordDialog(true);
  }
  function showLogin() {
    clearInterval(notifTimer);
    const u = input({
        autocomplete: "username",
        autofocus: true,
        type: "email",
        "aria-label": "Email",
      }),
      p = input({
        type: "password",
        autocomplete: "current-password",
        "aria-label": "Password",
      });
    const err2 = h("div", { class: "banner bad hidden", role: "alert" });
    const sample = [
      "Marketing",
      "Procurement",
      "Marketing",
      "Procurement",
      "Vendor",
      "Vendor",
      "Vendor",
      "Procurement",
      "Procurement",
      "Store",
      "Procurement",
      "Procurement",
    ];
    const demoSteps = sample.map((party2, i) => ({
      party: party2,
      name: "",
      status: i < 6 ? "done" : i === 6 ? "active" : "pending",
      active: i === 6,
    }));
    const form = h(
      "form",
      {
        class: "login-card stack",
        onsubmit: async (e) => {
          e.preventDefault();
          err2.classList.add("hidden");
          try {
            const r = await api.post("/auth/login", {
              username: u.value.trim(),
              password: p.value,
            });
            S2.user = r.user;
            boot();
          } catch (ex) {
            err2.textContent = ex.message;
            err2.classList.remove("hidden");
            p.value = "";
            p.focus();
          }
        },
      },
      ...["a", "b", "c", "d"].map((c) => h("i", { class: "crop " + c })),
      h(
        "div",
        null,
        h("h1", { style: { fontSize: "1.3rem" } }, "Sign in"),
        h(
          "p",
          { class: "muted small", style: { marginTop: "4px" } },
          "Use your Supabase Auth email and password.",
        ),
      ),
      err2,
      field("Email", u),
      field("Password", p),
      h("button", { class: "btn primary", type: "submit" }, "Sign in"),
    );
    clear(root).append(
      h(
        "div",
        { class: "login" },
        h(
          "div",
          { class: "login-art" },
          h(
            "div",
            { class: "brand" },
            h("div", { class: "brand-mark" }, icon("stamp", 20)),
            h(
              "div",
              null,
              h("b", null, "BPRO"),
              h("span", null, "Bombay Hemp Company"),
            ),
          ),
          h(
            "div",
            null,
            h("h1", null, "Every print order, one clear path."),
            h(
              "p",
              null,
              "From the marketing requirement to the paid invoice. Each step has an owner, a date and a clock.",
            ),
            strip(demoSteps, true),
          ),
          h(
            "div",
            { class: "small", style: { color: "var(--side-dim)" } },
            "Marketing, Operations and vendors, on one shared record.",
          ),
        ),
        h("div", { class: "login-form" }, form),
      ),
    );
  }
  async function boot() {
    try {
      if (!S2.user) {
        if (getToken()) {
          const me = await api.get("/auth/me").catch((e) => {
            if (e.status === 0) throw e;
            return { user: null };
          });
          S2.user = me.user;
        }
        if (!S2.user) {
          const st = await api.get("/auth/status");
          if (!st.configured)
            return showOffline(
              new ApiError(
                "Supabase setup is pending. Configure the server environment and apply migrations.",
                503,
              ),
            );
          return showLogin();
        }
      }
      if (S2.user.must_change_pw) return showForcedPassword();
      await loadMeta();
      renderShell();
    } catch (e) {
      if (e.status === 0 || e.status >= 500) showOffline(e);
      else showLogin();
    }
  }
  function showOffline(e) {
    clear(root).append(
      h(
        "div",
        { class: "login-form", style: { minHeight: "100vh" } },
        h(
          "div",
          { class: "login-card stack" },
          h("h1", { style: { fontSize: "1.2rem" } }, "Cannot reach the server"),
          h("p", { class: "muted small" }, e.message),
          h(
            "p",
            { class: "muted small" },
            "If you are the person setting this up, check that the API address in config.js is correct and that the function is deployed.",
          ),
          h(
            "button",
            { class: "btn primary", onclick: () => boot() },
            "Try again",
          ),
        ),
      ),
    );
  }
  setUnauthorizedHandler(() => {
    if (S2.user) {
      S2.user = null;
      toast("Your session ended. Please sign in again.", "bad");
      showLogin();
    }
  });
  boot();
})();
