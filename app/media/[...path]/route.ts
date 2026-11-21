// Serves portfolio images from the private Supabase bucket as an anonymous visitor.
// Storage RLS decides what is readable: the profile photo and images of published projects only.
// File names are unique per upload, so responses can be cached by the CDN and by next/image.
import { createPublicClient } from "@/lib/supabase/server";
import { BUCKET, isSupabaseConfigured } from "@/lib/supabase/config";
import { isValidObjectPath } from "@/lib/paths";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", avif: "image/avif" };

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join("/");
  if (!isSupabaseConfigured || !isValidObjectPath(path)) return new Response("Not found", { status: 404 });
  const { data, error } = await createPublicClient().storage.from(BUCKET).download(path);
  if (error || !data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  const ext = path.split(".").pop()!.toLowerCase();
  return new Response(data.stream(), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
