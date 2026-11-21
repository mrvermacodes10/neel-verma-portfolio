import "server-only";
import { createPublicClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import type { Profile, Project } from "./types";

export type PortfolioResult =
  | { ok: true; profile: Profile | null; projects: Project[] }
  | { ok: false; reason: "not-configured" | "error"; message?: string };

/** Everything the public homepage needs, fetched as an anonymous visitor (drafts are invisible). */
export async function getPortfolio(): Promise<PortfolioResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: "not-configured" };
  try {
    const supabase = createPublicClient();
    const [profile, projects] = await Promise.all([
      supabase.from("profile").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("projects")
        .select("*, project_images(*)")
        .eq("published", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .order("position", { referencedTable: "project_images", ascending: true }),
    ]);
    if (profile.error) throw profile.error;
    if (projects.error) throw projects.error;
    return { ok: true, profile: profile.data as Profile | null, projects: (projects.data ?? []) as Project[] };
  } catch (e) {
    console.error("getPortfolio failed", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
