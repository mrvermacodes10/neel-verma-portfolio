// Called by the admin dashboard after a change so the public homepage updates immediately.
import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/supabase/server";

export async function POST() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
  revalidatePath("/");
  return Response.json({ ok: true, at: Date.now() });
}
