import { readFile } from "node:fs/promises";
import { identity } from "../server/policy.mjs";
export const seed = JSON.parse(
  await readFile(new URL("../server/seed.json", import.meta.url), "utf8"),
);
export const OWNER = "11111111-1111-4111-8111-111111111111";
export const MEMBER = "22222222-2222-4222-8222-222222222222";
export const state = () => structuredClone(seed);
export const user = (role = 8, id = MEMBER) =>
  identity(
    { id, email: "member@example.test" },
    { id, active: true, role_id: role },
    OWNER,
    seed.overview.roles,
  );
export const owner = () =>
  identity(
    { id: OWNER, email: "owner@example.test" },
    null,
    OWNER,
    seed.overview.roles,
  );
export const requestBody = () => ({
  locations: ["BOHECO Andheri"],
  collateral_id: 1,
  request_type_id: 9,
  requirement: "Print signs",
  quantity: "10",
  raised_date: "2026-10-20",
});
export function fakeDB() {
  const db = {
    configured: true,
    stored: { revision: 0, payload: state() },
    profilesList: [
      {
        id: OWNER,
        email: "owner@example.test",
        name: "Owner",
        role_id: 1,
        active: true,
      },
      {
        id: MEMBER,
        email: "member@example.test",
        name: "Member",
        role_id: 8,
        active: true,
      },
    ],
    owner: async () => OWNER,
    profiles: async () => structuredClone(db.profilesList),
    state: async () => structuredClone(db.stored),
    current: async (token) => {
      if (!["owner", "member", "refreshed"].includes(token)) {
        const e = new Error("Please sign in.");
        e.status = 401;
        throw e;
      }
      return {
        id: token === "owner" ? OWNER : MEMBER,
        email: token === "owner" ? "owner@example.test" : "member@example.test",
      };
    },
    listAuthUsers: async () => db.profilesList,
    commit: async (revision, payload) => {
      if (revision !== db.stored.revision) {
        const e = new Error("Conflict");
        e.status = 409;
        throw e;
      }
      db.stored = { revision: revision + 1, payload: structuredClone(payload) };
    },
    request: async (path, opts) => {
      if (path.includes("grant_type=password"))
        return {
          user: { id: MEMBER, email: "member@example.test" },
          access_token: "member",
          refresh_token: "refresh",
          expires_in: 3600,
        };
      if (path.includes("grant_type=refresh_token"))
        return {
          user: { id: MEMBER, email: "member@example.test" },
          access_token: "refreshed",
          refresh_token: "refresh2",
          expires_in: 3600,
        };
      if (path.includes("assign_role")) return null;
      return [];
    },
  };
  return db;
}
