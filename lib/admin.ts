"use client";
// Admin data helpers. Every call runs as the signed-in user, so Supabase RLS enforces permissions.
import { supabaseBrowser } from "./supabase/browser";
import { BUCKET } from "./supabase/config";
import { optimiseImage } from "./images";
import { newObjectName } from "./paths";
import type { Layout, Profile, Project, ProjectImage } from "./types";

const db = () => supabaseBrowser();
const storage = () => supabaseBrowser().storage.from(BUCKET);

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------- reads ----------
export async function loadProfile(): Promise<Profile> {
  return check(await db().from("profile").select("*").eq("id", 1).single()) as Profile;
}
export async function loadProjects(): Promise<Project[]> {
  const rows = check(
    await db().from("projects").select("*, project_images(*)").order("position").order("created_at").order("position", { referencedTable: "project_images" }),
  );
  return (rows ?? []) as Project[];
}
export async function loadProject(id: string): Promise<Project | null> {
  const row = check(await db().from("projects").select("*, project_images(*)").eq("id", id).order("position", { referencedTable: "project_images" }).maybeSingle());
  return (row as Project) ?? null;
}

// ---------- storage ----------
async function upload(folder: string, file: File, maxDimension: number) {
  const img = await optimiseImage(file, maxDimension);
  const path = `${folder}/${newObjectName(img.ext)}`;
  check(await storage().upload(path, img.blob, { contentType: img.blob.type, cacheControl: "31536000", upsert: false }));
  return { path, width: img.width, height: img.height, blur: img.blur };
}
async function removeObjects(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[];
  if (list.length) {
    const { error } = await storage().remove(list);
    if (error) console.warn("Could not remove old files", error.message);
  }
}
/** Short-lived signed URLs so the admin can preview drafts (the public /media route can't). */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await storage().createSignedUrls(paths, 60 * 60);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

// ---------- profile ----------
export async function saveProfile(fields: Pick<Profile, "name" | "intro" | "email">) {
  check(await db().from("profile").update(fields).eq("id", 1).select().single());
}
export async function setProfilePhoto(file: File, previous: string | null) {
  const img = await upload("profile", file, 2000);
  try {
    check(await db().from("profile").update({ photo_path: img.path, photo_width: img.width, photo_height: img.height, photo_blur: img.blur }).eq("id", 1).select().single());
  } catch (e) {
    await removeObjects([img.path]);
    throw e;
  }
  await removeObjects([previous]);
  return img;
}
export async function removeProfilePhoto(previous: string | null) {
  check(await db().from("profile").update({ photo_path: null, photo_width: null, photo_height: null, photo_blur: null }).eq("id", 1).select().single());
  await removeObjects([previous]);
}

// ---------- projects ----------
export async function createProject(position: number, layout: Layout): Promise<string> {
  const row = check(await db().from("projects").insert({ name: "Untitled project", position, layout, published: false }).select("id").single()) as { id: string };
  return row.id;
}
export async function updateProject(id: string, fields: Partial<Pick<Project, "name" | "description" | "url" | "github_url" | "layout" | "published" | "position">>) {
  check(await db().from("projects").update(fields).eq("id", id).select("id").single());
}
export async function deleteProject(project: Project) {
  // Remove every file in the project's folder (cover, screenshots and any leftovers), then the row.
  const folder = `projects/${project.id}`;
  const { data } = await storage().list(folder, { limit: 1000 });
  await removeObjects([...(data ?? []).map((f) => `${folder}/${f.name}`), project.cover_path, ...project.project_images.map((i) => i.path)]);
  check(await db().from("projects").delete().eq("id", project.id).select("id"));
}
export async function saveOrder(ids: string[]) {
  await Promise.all(ids.map((id, position) => db().from("projects").update({ position: position + 1 }).eq("id", id).then(check)));
}
export async function setCover(project: Project, file: File) {
  const img = await upload(`projects/${project.id}`, file, 2400);
  try {
    check(await db().from("projects").update({ cover_path: img.path, cover_width: img.width, cover_height: img.height, cover_blur: img.blur }).eq("id", project.id).select("id").single());
  } catch (e) {
    await removeObjects([img.path]);
    throw e;
  }
  await removeObjects([project.cover_path]);
  return img;
}
export async function removeCover(project: Project) {
  check(await db().from("projects").update({ cover_path: null, cover_width: null, cover_height: null, cover_blur: null }).eq("id", project.id).select("id").single());
  await removeObjects([project.cover_path]);
}
export async function addScreenshot(projectId: string, file: File, position: number): Promise<ProjectImage> {
  const img = await upload(`projects/${projectId}`, file, 2000);
  try {
    return check(
      await db().from("project_images").insert({ project_id: projectId, path: img.path, width: img.width, height: img.height, blur: img.blur, position }).select().single(),
    ) as ProjectImage;
  } catch (e) {
    await removeObjects([img.path]);
    throw e;
  }
}
export async function updateScreenshot(id: string, fields: Partial<Pick<ProjectImage, "alt" | "position">>) {
  check(await db().from("project_images").update(fields).eq("id", id).select("id").single());
}
export async function deleteScreenshot(img: ProjectImage) {
  check(await db().from("project_images").delete().eq("id", img.id).select("id"));
  await removeObjects([img.path]);
}

// ---------- publish to the live site ----------
let timer: ReturnType<typeof setTimeout> | null = null;
/** Ask the server to rebuild the public homepage (debounced). */
export function refreshPublicSite() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    fetch("/api/revalidate", { method: "POST" }).catch(() => {});
  }, 300);
}

export function normaliseUrl(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) throw new Error();
    return u.toString();
  } catch {
    throw new Error(`“${input}” doesn’t look like a valid web address.`);
  }
}
