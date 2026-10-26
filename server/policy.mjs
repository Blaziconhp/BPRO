import { HttpError } from "./supabase.mjs";
export const assert = (
  condition,
  status = 400,
  message = "Invalid request.",
) => {
  if (!condition) throw new HttpError(status, message);
};
export function identity(auth, profile, owner, roles) {
  const isOwner = owner instanceof Set
    ? owner.has(auth.id)
    : Array.isArray(owner)
      ? owner.includes(auth.id)
      : auth.id === owner;
  assert(
    isOwner || (profile?.active && profile?.role_id),
    403,
    "Your account has not been granted access. Contact the primary owner.",
  );
  const role = roles.find((r) => r.id === profile?.role_id);
  assert(isOwner || role, 403, "Your role no longer exists.");
  return {
    id: auth.id,
    username: auth.email,
    email: auth.email,
    name: profile?.name || auth.email,
    role_id: profile?.role_id,
    role_name: isOwner ? "Co-owner" : role.name,
    is_owner: isOwner,
    is_admin: isOwner,
    must_change_pw: false,
    poc_type: role?.poc_type,
    perms: isOwner
      ? ["*"]
      : role.permissions.filter(
          (p) => !p.startsWith("admin.") && p !== "audit.view" && p !== "*",
        ),
  };
}
export const can = (u, p) => u.is_owner || u.perms.includes(p);
export const need = (u, p) =>
  assert(can(u, p), 403, "Your role does not allow this action.");
export const ownerOnly = (u) =>
  assert(u.is_owner, 403, "Only a co-owner can perform this action.");
export function canRead(u, r) {
  return (
    u.is_owner ||
    can(u, "requests.view_all") ||
    r.created_by === u.id ||
    r.ops_poc_id === u.id ||
    r.marketing_poc_id === u.id
  );
}
export function canEdit(u, r) {
  return (
    u.is_owner ||
    can(u, "requests.edit_all") ||
    (can(u, "requests.edit") &&
      [r.created_by, r.ops_poc_id, r.marketing_poc_id].includes(u.id))
  );
}
const financial = new Set([
  "rate",
  "amount",
  "cost_impact",
  "spend",
  "issue_cost",
  "ratecard_rate",
  "rates",
  "total_spend",
  "cost",
]);
export function redact(value, u) {
  if (can(u, "financials.view") || value === null || typeof value !== "object")
    return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, u));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      financial.has(k) ? null : redact(v, u),
    ]),
  );
}
