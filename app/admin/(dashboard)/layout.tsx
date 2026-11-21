import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/admin/login");
  const { user, isAdmin } = await getAdmin();
  if (!user) redirect("/admin/login");
  return (
    <AdminShell email={user.email ?? ""} authorised={isAdmin}>
      {children}
    </AdminShell>
  );
}
