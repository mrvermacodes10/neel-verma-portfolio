// End-to-end check of your Supabase setup: auth, Row Level Security, storage policies and the
// draft → published flow. It creates a temporary project + image and deletes them afterwards.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:supabase
//
// Optional: OTHER_EMAIL / OTHER_PASSWORD for a second (non-admin) user to prove they can't edit.
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const { ADMIN_EMAIL, ADMIN_PASSWORD, OTHER_EMAIL, OTHER_PASSWORD } = process.env;
if (!URL_ || !KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL and ADMIN_PASSWORD.");
  process.exit(2);
}
const BUCKET = "portfolio";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(URL_, KEY, opts);
const admin = createClient(URL_, KEY, opts);

let failures = 0;
const ok = (cond, msg, extra = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}${!cond && extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};
// 1×1 PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
const pngBlob = () => new Blob([PNG], { type: "image/png" });

let projectId = null;
const uploaded = [];
try {
  console.log("Public visitor");
  const prof = await anon.from("profile").select("name").eq("id", 1).maybeSingle();
  ok(!prof.error && prof.data, "can read the profile", prof.error?.message);
  const pub = await anon.from("projects").select("id, name, published");
  ok(!pub.error && pub.data.every((p) => p.published), `sees only published projects (${pub.data?.length ?? 0})`, pub.error?.message);
  const ins = await anon.from("projects").insert({ name: "hack" }).select();
  ok(!!ins.error, "cannot create projects");
  const up = await anon.storage.from(BUCKET).upload(`profile/hack-${Date.now()}.png`, pngBlob(), { contentType: "image/png" });
  ok(!!up.error, "cannot upload images");
  const su = await anon.auth.signUp({ email: `signup-test-${Date.now()}@example.com`, password: "Sup3r-secret-pass!" });
  ok(!!su.error, "public sign-ups are disabled", "sign-up succeeded — turn off “Allow new users to sign up” in Authentication settings");

  console.log("Admin");
  const login = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  ok(!login.error, "can sign in", login.error?.message);
  if (login.error) throw new Error("Admin sign-in failed — check ADMIN_EMAIL / ADMIN_PASSWORD");
  const isAdmin = await admin.rpc("is_admin");
  ok(isAdmin.data === true, "is listed in public.admins", "run supabase/make-admin.sql with your email");

  const created = await admin.from("projects").insert({ name: "__verify__ temporary", description: "Temporary — created by verify-supabase", position: 9999, published: false }).select("id").single();
  ok(!created.error, "can create a draft project", created.error?.message);
  projectId = created.data.id;
  const cover = `projects/${projectId}/verify-cover.png`;
  const shot = `projects/${projectId}/verify-shot.png`;
  for (const path of [cover, shot]) {
    const r = await admin.storage.from(BUCKET).upload(path, pngBlob(), { contentType: "image/png", cacheControl: "31536000" });
    ok(!r.error, `can upload ${path.split("/").pop()}`, r.error?.message);
    if (!r.error) uploaded.push(path);
  }
  const upd = await admin.from("projects").update({ cover_path: cover, cover_width: 1, cover_height: 1 }).eq("id", projectId).select("id").single();
  ok(!upd.error, "can set the cover image", upd.error?.message);
  const img = await admin.from("project_images").insert({ project_id: projectId, path: shot, width: 1, height: 1, position: 0 }).select().single();
  ok(!img.error, "can add a screenshot", img.error?.message);
  const signed = await admin.storage.from(BUCKET).createSignedUrls([cover], 60);
  ok(!signed.error && signed.data[0]?.signedUrl, "admin can preview draft images (signed URL)", signed.error?.message);
  if (signed.data?.[0]?.signedUrl) ok((await fetch(signed.data[0].signedUrl)).ok, "signed preview URL loads");

  console.log("Drafts stay private");
  const seeDraft = await anon.from("projects").select("id").eq("id", projectId);
  ok(!seeDraft.error && seeDraft.data.length === 0, "visitors can't see the draft project");
  const seeImgs = await anon.from("project_images").select("id").eq("project_id", projectId);
  ok(!seeImgs.error && seeImgs.data.length === 0, "visitors can't see the draft's screenshots");
  const dl = await anon.storage.from(BUCKET).download(cover);
  ok(!!dl.error, "visitors can't download the draft's images");

  if (OTHER_EMAIL && OTHER_PASSWORD) {
    console.log("Signed-in non-admin");
    const other = createClient(URL_, KEY, opts);
    const l = await other.auth.signInWithPassword({ email: OTHER_EMAIL, password: OTHER_PASSWORD });
    ok(!l.error, "second user can sign in", l.error?.message);
    const e1 = await other.from("projects").update({ name: "hack" }).eq("id", projectId).select();
    ok(!!e1.error || e1.data.length === 0, "cannot edit projects");
    const e2 = await other.storage.from(BUCKET).upload(`projects/${projectId}/hack.png`, pngBlob(), { contentType: "image/png" });
    ok(!!e2.error, "cannot upload images");
    const e3 = await other.storage.from(BUCKET).download(cover);
    ok(!!e3.error, "cannot read draft images");
  }

  console.log("Publishing");
  const pubR = await admin.from("projects").update({ published: true }).eq("id", projectId).select("id").single();
  ok(!pubR.error, "admin can publish", pubR.error?.message);
  const seen = await anon.from("projects").select("id, project_images(id)").eq("id", projectId).maybeSingle();
  ok(!seen.error && seen.data?.project_images?.length === 1, "visitors now see the project and its screenshot", seen.error?.message);
  const dl2 = await anon.storage.from(BUCKET).download(cover);
  ok(!dl2.error && dl2.data?.size > 0, "visitors can now load its images", dl2.error?.message);
  const order = await admin.from("projects").update({ position: 9998 }).eq("id", projectId).select("position").single();
  ok(order.data?.position === 9998, "admin can reorder projects");
} catch (e) {
  failures++;
  console.error("  ✗", e.message);
} finally {
  console.log("Cleaning up");
  if (uploaded.length) {
    const rm = await admin.storage.from(BUCKET).remove(uploaded);
    ok(!rm.error && rm.data.length === uploaded.length, `removed ${uploaded.length} test image(s)`, rm.error?.message);
  }
  if (projectId) {
    const del = await admin.from("projects").delete().eq("id", projectId).select("id");
    ok(!del.error && del.data.length === 1, "deleted the temporary project (screenshot rows cascade)", del.error?.message);
    const gone = await anon.storage.from(BUCKET).download(`projects/${projectId}/verify-cover.png`);
    ok(!!gone.error, "deleted images are no longer served");
  }
  await admin.auth.signOut();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll Supabase checks passed");
process.exit(failures ? 1 : 0);
