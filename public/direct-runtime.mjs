import * as domain from './domain.mjs';
import * as policy from './policy.mjs';

const cfg = window.EBO_CONFIG || {};
const base = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
const publishable = cfg.supabasePublishableKey || '';
const sessionKey = 'bpro_supabase_session';
let session = null;
let state = null;
let revision = 0;
let currentUser = null;

class DirectError extends Error {
  constructor(message, status = 400, code = '') { super(message); this.status = status; this.code = code; }
}
function restoreSession() {
  try { session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); }
  catch { session = null; }
}
function persist() {
  if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
  else sessionStorage.removeItem(sessionKey);
}
async function request(path, { method = 'GET', body, token = session?.access_token, raw = false, headers = {} } = {}) {
  if (!base || !publishable) throw new DirectError('Supabase is not configured for this site.', 503);
  const res = await fetch(base + path, {
    method,
    headers: {
      apikey: publishable,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
  }).catch(() => { throw new DirectError('Supabase cannot be reached right now.', 502); });
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const status = path.includes('/token?grant_type=password') ? 401 : res.status;
    const message = status === 401 && path.includes('/token') ? 'Sign-in failed. Check the email and password.' : (data?.message || data?.msg || data?.error_description || data?.error || `Supabase request failed (${res.status}).`);
    throw new DirectError(message, status, data?.code || '');
  }
  return data;
}
async function rpc(name, args = {}) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });
}
async function hydrate() {
  if (!session?.access_token) throw new DirectError('Sign in to continue.', 401);
  try {
    await request('/auth/v1/user');
  } catch (e) {
    if (e.status !== 401 || !session.refresh_token) { clear(); throw e; }
    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, token: null });
    session = refreshed; persist();
  }
  const [ctx, snapshot] = await Promise.all([rpc('bpro_direct_context'), rpc('bpro_direct_read_snapshot')]);
  const role = snapshot.payload?.overview?.roles?.find(x => x.id === ctx.role_id);
  const perms = ctx.is_owner ? ['*'] : (ctx.permissions || []).filter(p => !p.startsWith('admin.') && p !== 'audit.view' && p !== '*');
  currentUser = {
    id: ctx.id, username: ctx.email, email: ctx.email, name: ctx.name || ctx.email,
    role_id: ctx.role_id, role_name: ctx.role_name, is_owner: ctx.is_owner,
    is_admin: !!ctx.is_owner, must_change_pw: false, poc_type: role?.poc_type || null, perms,
  };
  state = snapshot.payload;
  revision = Number(snapshot.revision || 0);
  return currentUser;
}
function clear() { session = null; state = null; currentUser = null; revision = 0; persist(); }
function ensureLoaded() { return state && currentUser ? Promise.resolve() : hydrate(); }
function cloneState() { return structuredClone(state); }
function qs(url) { return new URL(url, location.origin); }
function authProfileRows(users, roles) {
  return users.map(p => ({ ...p, username: p.email, name: p.name || p.email, role_name: p.role_name || roles.find(r => r.id === p.role_id)?.name || 'Unassigned' }));
}
function canReadRequest(u, r) { return policy.canRead(u, r); }
async function directCall(method, url, body) {
  const u = qs(url), path = u.pathname;
  if (path === '/auth/status' && method === 'GET') return { needs_setup: false, configured: !!(base && publishable), app_name: 'BPRO', company_name: 'Bombay Hemp Company' };
  if (path === '/auth/login' && method === 'POST') {
    const s = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: body.username, password: body.password }, token: null });
    session = s; persist();
    return { user: await hydrate() };
  }
  if (path === '/auth/logout' && method === 'POST') {
    if (session?.access_token) await request('/auth/v1/logout?scope=local', { method: 'POST' }).catch(() => {});
    clear(); return { ok: true };
  }
  await ensureLoaded();
  const S = state, user = currentUser;
  if (path === '/auth/me' && method === 'GET') return { user };
  if (path === '/auth/change-password' && method === 'POST') {
    if (!body?.current || typeof body.next !== 'string' || body.next.length < 12) throw new DirectError('Use your current password and a new password with at least 12 characters.', 400);
    await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: user.email, password: body.current } });
    await request('/auth/v1/user', { method: 'PUT', body: { password: body.next } });
    return { ok: true };
  }
  if (path === '/auth/notifications' && method === 'GET') {
    const rows = domain.visible(S, user).flatMap(r => r.current_steps.filter(s => s.esc_level && (s.esc_level === 2 ? s.esc2_roles : s.esc1_roles)?.includes(user.role_id)).map(s => ({ id: `${r.id}-${s.id}`, title: `${r.pr_no}: ${s.name}`, body: `${s.overdue_days} working days overdue`, request_id: r.id, created_at: r.updated_at, read_at: null })));
    return { unread: rows.length, rows };
  }
  if (path === '/auth/notifications/read' && method === 'POST') return { ok: true, message: 'Alerts clear when the overdue step is resolved.' };
  if (method === 'GET') {
    let m;
    if (path === '/meta') return domain.meta(S, user);
    if (path === '/requests') return domain.list(S, user, u.searchParams);
    if ((m = path.match(/^\/requests\/(\d+)$/))) {
      const r = S.req[m[1]]; if (!r || !canReadRequest(user, r)) throw new DirectError('Request not found.', 404);
      return domain.decorate(r, user);
    }
    if (path === '/dashboard') return domain.dashboard(S, user, u.searchParams);
    if (path === '/tasks') return { tasks: domain.visible(S, user).flatMap(r => r.current_steps.filter(s => policy.can(user, 'steps.override') || (policy.can(user, 'steps.update') && s.update_roles.includes(user.role_id))).map(s => ({ ...s, role: 'action', step_id: s.id, request_id: r.id, pr_no: r.pr_no, requirement: r.requirement, location: r.location, step_name: s.name, party: s.owner_party, req_delivery_date: r.req_delivery_date, ops_poc_name: r.ops_poc_name, marketing_poc_name: r.marketing_poc_name, can_update: true }))) };
    if (path === '/vendors') { policy.need(user, 'vendors.view'); return { rows: S.vendors.rows.map(v => ({ ...v, ...domain.dashboard(S, { ...user, perms: [...user.perms, 'dashboard.view'] }).vendors.find(x => x.id === v.id) })) }; }
    if ((m = path.match(/^\/vendors\/(\d+)$/))) {
      policy.need(user, 'vendors.view'); const vendor = S.vendors.rows.find(v => v.id === Number(m[1])); if (!vendor) throw new DirectError('Vendor not found.', 404);
      return { vendor, rates: vendor.rates || [], orders: domain.visible(S, user).filter(r => r.vendor_id === vendor.id), can_see_rates: policy.can(user, 'financials.view') };
    }
    if (path === '/reports') { policy.need(user, 'reports.export'); return S.reports; }
    if (path.startsWith('/export/')) return domain.report(S, user, path.slice(8), u.searchParams);
    if (path === '/admin/overview') {
      policy.ownerOnly(user); const users = await rpc('bpro_direct_list_users');
      const rows = authProfileRows(users || [], S.overview.roles);
      const roles = S.overview.roles.map(r => ({ ...r, user_count: rows.filter(p => p.role_id === r.id).length }));
      return { ...S.overview, roles, request_count: Object.keys(S.req).length, demo_count: 0, users: rows };
    }
    if (path === '/admin/backup') { policy.ownerOnly(user); return { ...S, profiles: await rpc('bpro_direct_list_users') }; }
    if (path === '/admin/audit') { policy.ownerOnly(user); return { rows: await rpc('bpro_direct_list_audit', { row_limit: Number(u.searchParams.get('limit')) || 300 }) }; }
    if ((m = path.match(/^\/attachments\/(\d+)$/))) {
      const r = Object.values(S.req).find(x => x.attachments.some(a => a.id === Number(m[1])));
      if (!r || !canReadRequest(user, r)) throw new DirectError('File not found.', 404);
      const a = r.attachments.find(x => x.id === Number(m[1]));
      return { __attachment: true, object_path: a.object_path, name: a.orig_name };
    }
    throw new DirectError('Route not found.', 404);
  }
  if (path.startsWith('/admin/')) policy.ownerOnly(user);
  const userRoute = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/i);
  if (userRoute && method === 'PUT') {
    await rpc('bpro_assign_role_direct', { target_id: userRoute[1], new_role: body.role_id, enabled: body.active });
    await hydrate(); return { ok: true };
  }
  if (path === '/admin/import' && method === 'POST') {
    policy.ownerOnly(user);
    const before = cloneState(); const grid = body.rows || []; const header = grid.findIndex(r => String(r?.[0] || '').toLowerCase().replace(/[^a-z]/g, '') === 'prno');
    if (header < 0) throw new DirectError('The tracker must have PR No. in column A.', 400);
    const hs = grid[header].map(h => String(h || '').toLowerCase().replace(/[^a-z]/g, ''));
    const col = (r, ...names) => { const i = hs.findIndex(h => names.includes(h)); return i < 0 ? '' : r[i]; };
    const report = { found: 0, created: 0, skipped: [], warnings: [], users_created: [] };
    for (const row of grid.slice(header + 1)) {
      if (!row?.[0]) continue; report.found++; const pr = String(row[0]);
      if (Object.values(S.req).some(r => r.pr_no === pr)) { report.skipped.push(pr + ': already exists'); continue; }
      const collateral = S.overview.collaterals.find(c => c.name.toLowerCase() === String(col(row, 'collateral', 'collateraltype')).toLowerCase());
      if (!collateral) { report.skipped.push(pr + ': collateral not recognized'); continue; }
      try { const created = domain.create(S, user, { locations: [String(col(row, 'location', 'store'))], collateral_id: collateral.id, request_type_id: S.overview.lookups.find(x => x.type === 'request_type' && x.active).id, requirement: String(col(row, 'requirement', 'description')), quantity: String(col(row, 'quantity', 'qty')), raised_date: /^\d{4}-\d{2}-\d{2}/.test(String(col(row, 'raiseddate', 'date'))) ? String(col(row, 'raiseddate', 'date')).slice(0,10) : domain.dateNow() }); S.req[created.created[0].id].pr_no = pr; report.created++; }
      catch (e) { report.skipped.push(`${pr}: ${e.message}`); }
    }
    report.warnings.push('Only PR number, date, location, collateral, requirement and quantity are imported. Review workflow dates and assignments after import. No Auth users are created.');
    await save(before, S, 'tracker_imported'); return { ok: true, report };
  }
  if (path.startsWith('/admin/demo/')) throw new DirectError('Sample data is disabled.', 400);
  const before = cloneState();
  if (method === 'DELETE' && path.match(/^\/attachments\/(\d+)$/)) {
    policy.ownerOnly(user); const id = Number(path.split('/').at(-1)); let target;
    for (const r of Object.values(S.req)) { const i = r.attachments.findIndex(a => a.id === id); if (i >= 0) { target = r.attachments.splice(i, 1)[0]; break; } }
    if (!target) throw new DirectError('Attachment not found.', 404);
    await save(before, S, 'attachment_deleted');
    await request('/storage/v1/object/bpro-files', { method: 'DELETE', body: { prefixes: [target.object_path] } }).catch(() => {});
    return { ok: true };
  }
  const result = domain.mutate(S, user, method, path, body || {});
  await save(before, S, `${method} ${path}`);
  return result;
}
async function save(before, next, action) {
  const result = await rpc('bpro_direct_commit', { expected_revision: revision, new_payload: next, action_name: action });
  if (!result?.saved) { state = before; await hydrate(); throw new DirectError('Someone else saved changes at the same time. Refresh and try again.', 409); }
  await hydrate();
}
async function upload(url, formData) {
  await ensureLoaded(); policy.ownerOnly(currentUser);
  const match = url.match(/^\/requests\/(\d+)\/attachments$/); if (!match) throw new DirectError('Upload route not found.', 404);
  const r = state.req[match[1]]; if (!r) throw new DirectError('Request not found.', 404);
  const u = qs(url + (url.includes('?') ? '&' : '?') + [...formData.entries()].filter(([k]) => k !== 'files').map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'));
  const files = formData.getAll('files'); if (!files.length) throw new DirectError('Choose a file.');
  for (const file of files) {
    if (!file.size || file.size > 6 * 1024 * 1024) throw new DirectError(`${file.name} must be between 1 byte and 6 MB.`);
    const ext = file.name.split('.').at(-1).toLowerCase(); if (!['pdf','png','jpg','jpeg','webp','xlsx','csv','txt'].includes(ext)) throw new DirectError('Use a PDF, image, spreadsheet, CSV or text file.');
    const path = `${r.id}/${crypto.randomUUID()}.${ext}`;
    await request(`/storage/v1/object/bpro-files/${path}`, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } });
    const before = cloneState();
    const next = cloneState();
    next.sequence = (next.sequence || 1000) + 1;
    next.req[match[1]].attachments.push({ id: next.sequence, object_path: path, orig_name: file.name, mime: 'application/octet-stream', size: file.size, kind: u.searchParams.get('kind') || 'other', step_id: Number(u.searchParams.get('step_id')) || null, created_at: new Date().toISOString(), uploaded_by: currentUser.id, uploaded_by_name: currentUser.name });
    try { await save(before, next, 'attachment_uploaded'); }
    catch (e) { await request('/storage/v1/object/bpro-files', { method: 'DELETE', body: { prefixes: [path] } }).catch(() => {}); throw e; }
  }
  return { ok: true, count: files.length };
}
async function attachment(url) {
  const meta = await directCall('GET', url);
  if (!meta?.__attachment) throw new DirectError('File could not be read.', 404);
  const response = await request(`/storage/v1/object/authenticated/bpro-files/${meta.object_path}`, { raw: true });
  return { blob: await response.blob(), name: meta.name };
}
restoreSession();
export const directApi = {
  call: directCall,
  upload,
  async attachment(url) { return attachment(url); },
  async fetchAttachment(url) { return attachment(url); },
  get errorClass() { return DirectError; },
};
