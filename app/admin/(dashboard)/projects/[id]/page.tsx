import { notFound } from "next/navigation";
import { ProjectEditor } from "@/components/admin/ProjectEditor";

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <ProjectEditor id={id} />;
}
