// Runs supabase/schema.sql inside a real Postgres engine (PGlite) with minimal stand-ins for
// Supabase's auth and storage schemas, then checks every Row Level Security rule as the
// anon, signed-in non-admin and admin roles.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";

// Minimal Supabase environment: roles, auth.users/auth.uid(), storage.buckets/objects.
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
-- Like Supabase: anon/authenticated get full table privileges by default; RLS is the real barrier.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;
/** Passes when the statement is refused either by privileges/RLS errors or by RLS filtering every row. */
async function denied(p: Promise<unknown[]>) {
  try {
    expect(await p).toEqual([]);
  } catch (e) {
    if (e && typeof e === "object" && "message" in e && /expected/i.test(String((e as Error).message))) throw e;
  }
}

let db: PGlite;

/** Run SQL as a given Supabase role (anon / authenticated user). Returns rows or throws. */
async function as<T = Record<string, unknown>>(who: "anon" | { user: string }, sql: string, params: unknown[] = []): Promise<T[]> {
  const role = who === "anon" ? "anon" : "authenticated";
  const sub = who === "anon" ? "" : who.user;
  await db.exec(`reset role; set request.jwt.claim.sub = '${sub}'; set role ${role};`);
  try {
    const r = await db.query<T>(sql, params);
    return r.rows;
  } finally {
    await db.exec("reset role;");
  }
}
const asAdmin = (sql: string, p: unknown[] = []) => as({ user: ADMIN }, sql, p);
const asStranger = (sql: string, p: unknown[] = []) => as({ user: STRANGER }, sql, p);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(SCHEMA);
  await db.exec(`insert into auth.users (id, email) values ('${ADMIN}', 'neel@example.com'), ('${STRANGER}', 'someone@example.com');`);
  await db.exec(readFileSync(new URL("./make-admin.sql", import.meta.url), "utf8").replace("you@example.com", "neel@example.com"));
}, 60_000);

describe("schema & seed", () => {
  it("is safe to run twice and seeds the six projects once", async () => {
    await db.exec(SCHEMA);
    const rows = (await db.query<{ name: string; url: string | null; position: number }>("select name, url, position from public.projects order by position")).rows;
    expect(rows.map((r) => r.name)).toEqual(["Touchline", "Ball Knowledge", "OIStexas", "My Planner", "OIS LTFB", "Lunchtime Football"]);
    expect(rows.filter((r) => r.url).map((r) => r.url)).toEqual(["https://ois-ltfb-8g91.vercel.app/", "https://lunchtime-football.vercel.app/"]);
    expect((await db.query("select count(*)::int as n from public.profile")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select public from storage.buckets where id = 'portfolio'")).rows[0]).toEqual({ public: false });
  });
  it("rejects bad URLs and layouts", async () => {
    await expect(asAdmin("insert into public.projects (name, url) values ('x', 'javascript:alert(1)')")).rejects.toThrow();
    await expect(asAdmin("insert into public.projects (name, layout) values ('x', 'sideways')")).rejects.toThrow();
    await expect(db.query("insert into public.profile (id) values (2)")).rejects.toThrow();
  });
});

describe("public visitors (anon)", () => {
  it("can read the profile and published projects only", async () => {
    await db.exec("update public.projects set published = false where name = 'My Planner'");
    const rows = await as<{ name: string }>("anon", "select name from public.projects");
    expect(rows.map((r) => r.name)).not.toContain("My Planner");
    expect(rows.length).toBe(5);
    expect((await as("anon", "select name from public.profile")).length).toBe(1);
    await db.exec("update public.projects set published = true where name = 'My Planner'");
  });
  it("cannot write anything", async () => {
    await expect(as("anon", "insert into public.projects (name) values ('hack')")).rejects.toThrow();
    await denied(as("anon", "update public.projects set name = 'hack' returning id"));
    await denied(as("anon", "delete from public.projects returning id"));
    await denied(as("anon", "update public.profile set name = 'hack' returning id"));
    await denied(as("anon", "update storage.objects set name = 'x' returning id"));
    await expect(as("anon", "insert into storage.objects (bucket_id, name) values ('portfolio', 'profile/x.webp')")).rejects.toThrow();
    await denied(as("anon", "select * from public.admins"));
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.projects where name = 'hack'")).rows[0].n).toBe(0);
  });
});

describe("signed-in user who is not an admin", () => {
  it("cannot change content or storage", async () => {
    await expect(asStranger("insert into public.projects (name) values ('hack')")).rejects.toThrow();
    await denied(asStranger("update public.projects set name = 'hack' returning id"));
    await denied(asStranger("delete from public.project_images returning id"));
    await denied(asStranger("update public.profile set intro = 'hack' returning id"));
    await denied(asStranger("delete from storage.objects returning id"));
    await denied(asStranger("select * from public.admins"));
    await expect(asStranger("insert into storage.objects (bucket_id, name) values ('portfolio', 'profile/x.webp')")).rejects.toThrow();
    await expect(asStranger("insert into public.admins (user_id) values ($1)", [STRANGER])).rejects.toThrow();
    expect(await asStranger("select public.is_admin() as a")).toEqual([{ a: false }]);
  });
});

describe("admin", () => {
  let draftId: string;
  it("is recognised as admin", async () => {
    expect(await asAdmin("select public.is_admin() as a")).toEqual([{ a: true }]);
  });
  it("creates a draft that visitors cannot see — including its images", async () => {
    const [p] = (await asAdmin("insert into public.projects (name, description, position) values ('Secret', 'wip', 7) returning id")) as { id: string }[];
    draftId = p.id;
    await asAdmin("insert into public.project_images (project_id, path, position) values ($1, $2, 0)", [draftId, `projects/${draftId}/a.webp`]);
    await asAdmin("insert into storage.objects (bucket_id, name) values ('portfolio', $1), ('portfolio', $2)", [`projects/${draftId}/cover.webp`, `projects/${draftId}/a.webp`]);
    await asAdmin("insert into storage.objects (bucket_id, name) values ('portfolio', 'profile/me.webp')");
    expect(await as("anon", "select id from public.projects where id = $1", [draftId])).toEqual([]);
    expect(await as("anon", "select id from public.project_images where project_id = $1", [draftId])).toEqual([]);
    expect(await as("anon", "select name from storage.objects where name like $1", [`projects/${draftId}/%`])).toEqual([]);
    expect(await asStranger("select name from storage.objects where name like $1", [`projects/${draftId}/%`])).toEqual([]);
    expect((await as("anon", "select name from storage.objects where name = 'profile/me.webp'")).length).toBe(1);
    expect((await asAdmin("select id from public.projects where id = $1", [draftId])).length).toBe(1);
  });
  it("publishing makes the project and its images public", async () => {
    await asAdmin("update public.projects set published = true where id = $1", [draftId]);
    expect((await as("anon", "select id from public.projects where id = $1", [draftId])).length).toBe(1);
    expect((await as("anon", "select id from public.project_images where project_id = $1", [draftId])).length).toBe(1);
    expect((await as("anon", "select name from storage.objects where name like $1", [`projects/${draftId}/%`])).length).toBe(2);
  });
  it("reorders, edits and updates timestamps", async () => {
    const before = (await db.query<{ updated_at: Date }>("select updated_at from public.projects where id = $1", [draftId])).rows[0].updated_at;
    await new Promise((r) => setTimeout(r, 10));
    await asAdmin("update public.projects set position = 0, name = 'Renamed' where id = $1", [draftId]);
    const after = (await db.query<{ updated_at: Date; name: string }>("select updated_at, name from public.projects where id = $1", [draftId])).rows[0];
    expect(after.name).toBe("Renamed");
    expect(after.updated_at.getTime()).toBeGreaterThan(before.getTime());
    const first = await as<{ name: string }>("anon", "select name from public.projects order by position limit 1");
    expect(first[0].name).toBe("Renamed");
  });
  it("deleting a project removes its screenshot rows; admin can delete storage objects", async () => {
    await asAdmin("delete from public.projects where id = $1", [draftId]);
    expect((await db.query("select id from public.project_images where project_id = $1", [draftId])).rows).toEqual([]);
    const removed = await asAdmin("delete from storage.objects where name like $1 returning name", [`projects/${draftId}/%`]);
    expect(removed.length).toBe(2);
  });
  it("updates the profile", async () => {
    const rows = await asAdmin("update public.profile set intro = 'Hello', photo_path = 'profile/me.webp' where id = 1 returning intro");
    expect(rows).toEqual([{ intro: "Hello" }]);
  });
});
