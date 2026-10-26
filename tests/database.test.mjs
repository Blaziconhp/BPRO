import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222";
test("migrations, Auth synchronization, RLS, owner protection and atomic commits", async (t) => {
  const db = await PGlite.create();
  try {
    // Minimal Supabase-owned schemas for local PostgreSQL tests; not a live Auth/Storage service.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated,service_role;
    create policy existing_broad_policy on storage.objects for all to authenticated using(true) with check(true);`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610230001_bpro.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610260001_static_client_access.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610230002_seed.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      "insert into auth.users(id,email) values($1,'owner@test.example'),($2,'member@test.example')",
      [owner, member],
    );
    await t.test("Auth users get unassigned disabled profiles", async () => {
      const p = await db.query(
        "select * from public.bpro_profiles where id=$1",
        [member],
      );
      assert.equal(p.rows[0].role_id, null);
      assert.equal(p.rows[0].active, false);
    });
    await t.test("Auth email updates synchronize server-side", async () => {
      await db.query(
        "update auth.users set email='changed@test.example' where id=$1",
        [member],
      );
      assert.equal(
        (
          await db.query("select email from public.bpro_profiles where id=$1", [
            member,
          ])
        ).rows[0].email,
        "changed@test.example",
      );
    });
    await db.exec(
      (
        await readFile(
          new URL("../supabase/bootstrap-owner.sql", import.meta.url),
          "utf8",
        )
      ).replace("00000000-0000-0000-0000-000000000000", owner),
    );
    await t.test("second owner rejected by singleton constraint", async () =>
      assert.rejects(
        db.query("insert into public.bpro_owner(user_id) values($1)", [member]),
      ),
    );
    await t.test(
      "owner cannot be changed, disabled, deleted or removed from Auth",
      async () => {
        for (const sql of [
          "update public.bpro_owner set user_id=$1",
          "delete from public.bpro_owner where user_id=$1",
          "update public.bpro_profiles set active=false where id=$1",
          "update public.bpro_profiles set role_id=8 where id=$1",
          "delete from auth.users where id=$1",
        ])
          await assert.rejects(db.query(sql, [owner]));
      },
    );
    await t.test(
      "owner role assignment validates roles and writes audit",
      async () => {
        await db.query("select public.bpro_assign_role($1,8,true,$2)", [
          member,
          owner,
        ]);
        assert.equal(
          (
            await db.query(
              "select role_id from public.bpro_profiles where id=$1",
              [member],
            )
          ).rows[0].role_id,
          8,
        );
        await assert.rejects(
          db.query("select public.bpro_assign_role($1,9999,true,$2)", [
            member,
            owner,
          ]),
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.bpro_audit where action='role_assigned'",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test("direct Supabase RPCs derive owner identity and sync Auth users", async () => {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
      const context = (await db.query("select public.bpro_direct_context() context")).rows[0].context;
      assert.equal(context.is_owner, true);
      const users = await db.query("select * from public.bpro_direct_list_users()");
      assert.equal(users.rows.length, 2);
      assert.equal(users.rows.find((u) => u.id === owner).is_owner, true);
      await db.query("select public.bpro_assign_role_direct($1,8,true)", [member]);
      await db.exec("reset role");
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${member}',false);`);
      const memberContext = (await db.query("select public.bpro_direct_context() context")).rows[0].context;
      assert.equal(memberContext.is_owner, false);
      await assert.rejects(db.query("select * from public.bpro_direct_list_users()"));
      assert.equal(typeof (await db.query("select public.bpro_direct_read_state() payload")).rows[0].payload.overview, "object");
      const snapshot = (await db.query("select public.bpro_direct_read_snapshot() snapshot")).rows[0].snapshot;
      assert.equal(snapshot.revision, 0);
      assert.equal(typeof snapshot.payload.req, "object");
      await assert.rejects(db.query("select public.bpro_assign_role_direct($1,1,true)", [member]));
      // A regular assigned user can save an unchanged redacted snapshot, but cannot forge admin data.
      const unchanged = snapshot.payload;
      const saved = await db.query("select public.bpro_direct_commit($1,$2,'no_change') result", [snapshot.revision, JSON.stringify(unchanged)]);
      assert.equal(saved.rows[0].result.saved, true);
      const forged = structuredClone(unchanged);
      forged.overview.roles[0].name = "Forged role";
      await assert.rejects(db.query("select public.bpro_direct_commit($1,$2,'forged')", [1, JSON.stringify(forged)]), /configuration/);

      // The signed-in owner can make configuration changes without supplying an actor ID.
      await db.exec("reset role");
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
      const ownerPayload = (await db.query("select (public.bpro_direct_read_snapshot())->'payload' payload")).rows[0].payload;
      ownerPayload.overview.settings.company_name = "Production BPRO";
      const ownerSave = await db.query("select public.bpro_direct_commit(1,$1,'owner_config') result", [JSON.stringify(ownerPayload)]);
      assert.equal(ownerSave.rows[0].result.saved, true);
      await db.exec("reset role");
    });
    await t.test(
      "CAS prevents lost updates and atomically records audit",
      async () => {
        const snapshot = (await db.query("select public.bpro_direct_read_snapshot() snapshot")).rows[0].snapshot;
        const payload = snapshot.payload;
        const revision = Number(snapshot.revision);
        let x = await db.query(
          "select public.bpro_commit($1,$2,$3,'test') saved",
          [revision, JSON.stringify(payload), owner],
        );
        assert.equal(x.rows[0].saved, true);
        x = await db.query("select public.bpro_commit($1,$2,$3,'stale') saved", [
          revision,
          JSON.stringify(payload),
          owner,
        ]);
        assert.equal(x.rows[0].saved, false);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.bpro_audit where action='test'",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "RLS hides other profiles and all browser access to state and privileged RPCs",
      async () => {
        await db.exec(
          `set role authenticated; select set_config('request.jwt.claim.sub','${member}',false);`,
        );
        assert.equal(
          (await db.query("select count(*)::int n from public.bpro_profiles"))
            .rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select count(*)::int n from public.bpro_owner"))
            .rows[0].n,
          0,
        );
        await assert.rejects(db.query("select * from public.bpro_state"));
        await assert.rejects(
          db.query("select public.bpro_commit(1,'{}',$1,'hacked')", [owner]),
        );
        await assert.rejects(
          db.query("select public.bpro_assign_role($1,1,true,$2)", [
            member,
            owner,
          ]),
        );
        await assert.rejects(
          db.query("update public.bpro_profiles set role_id=1"),
        );
        await db.exec("reset role");
      },
    );
    await t.test(
      "restrictive storage policy blocks an existing permissive policy",
      async () => {
        await db.exec("set role authenticated");
        await assert.rejects(
          db.query(
            "insert into storage.objects values('33333333-3333-4333-8333-333333333333','bpro-files','attack')",
          ),
        );
        await db.exec("reset role");
        await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
        await db.query(
          "insert into storage.objects values('44444444-4444-4444-8444-444444444444','bpro-files','123/owner.pdf')",
        );
        await db.exec("reset role");
      },
    );
  } finally {
    await db.close();
  }
});
