"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as api from "@/lib/admin";
import type { Layout, Profile, Project } from "@/lib/types";
import { Button, ConfirmButton, Field, ImageSlot, Spinner, Toggle, inputCls, usePreviews, useToast } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function Dashboard() {
  const toast = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.loadProfile(), api.loadProjects()])
      .then(([p, list]) => {
        setProfile(p);
        setProjects(list);
      })
      .catch((e) => setLoadError(errMsg(e)));
  }, []);

  if (loadError) return <p role="alert" className="text-danger">Couldn’t load your content: {loadError}</p>;
  if (!profile || !projects)
    return (
      <div className="flex items-center gap-3 py-20 text-stone">
        <Spinner /> <span className="label">Loading</span>
      </div>
    );

  return (
    <div className="space-y-20">
      <ProfileEditor profile={profile} onChange={setProfile} />
      <ProjectList
        projects={projects}
        setProjects={setProjects}
        onAdd={async () => {
          try {
            const layouts: Layout[] = ["full", "left", "right"];
            const id = await api.createProject(projects.length + 1, layouts[projects.length % 3]);
            api.refreshPublicSite();
            router.push(`/admin/projects/${id}`);
          } catch (e) {
            toast(errMsg(e), "error");
          }
        }}
      />
    </div>
  );
}

// ---------- Profile ----------
function ProfileEditor({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: profile.name, intro: profile.intro, email: profile.email ?? "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const previews = usePreviews([profile.photo_path], api.signedUrls);
  const dirty = form.name !== profile.name || form.intro !== profile.intro || form.email !== (profile.email ?? "");

  const save = async () => {
    if (!form.name.trim()) return toast("Your name can’t be empty.", "error");
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return toast("That email address doesn’t look right.", "error");
    setSaving(true);
    try {
      const fields = { name: form.name.trim(), intro: form.intro.trim(), email: form.email.trim() || null };
      await api.saveProfile(fields);
      onChange({ ...profile, ...fields });
      api.refreshPublicSite();
      toast("Profile saved");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const upload = async ([file]: File[]) => {
    setUploading(true);
    setLocalPreview(URL.createObjectURL(file));
    try {
      const img = await api.setProfilePhoto(file, profile.photo_path);
      onChange({ ...profile, photo_path: img.path, photo_width: img.width, photo_height: img.height, photo_blur: img.blur });
      api.refreshPublicSite();
      toast("Profile photo updated");
    } catch (e) {
      setLocalPreview(null);
      toast(errMsg(e), "error");
    } finally {
      setUploading(false);
    }
  };
  const remove = async () => {
    setUploading(true);
    try {
      await api.removeProfilePhoto(profile.photo_path);
      setLocalPreview(null);
      onChange({ ...profile, photo_path: null, photo_width: null, photo_height: null, photo_blur: null });
      api.refreshPublicSite();
      toast("Profile photo removed");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setUploading(false);
    }
  };

  const src = localPreview ?? (profile.photo_path ? previews[profile.photo_path] ?? null : null);
  return (
    <section aria-labelledby="profile-h">
      <SectionTitle id="profile-h" title="About me" note="Shown at the top of the homepage" />
      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,240px)_1fr]">
        <div className="max-w-[240px]">
          <ImageSlot src={src} label="profile photo" ratio="4 / 5" busy={uploading} onFiles={upload} onRemove={profile.photo_path ? remove : undefined} />
        </div>
        <div className="space-y-5">
          <Field label="Name">
            <input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Introduction">
            <textarea value={form.intro} rows={5} maxLength={1200} onChange={(e) => setForm({ ...form, intro: e.target.value })} className={`${inputCls} resize-y leading-relaxed`} />
          </Field>
          <Field label="Contact email" hint="Optional. Shown in the footer when filled in.">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="you@example.com" />
          </Field>
          <div className="flex items-center gap-4">
            <Button onClick={save} busy={saving} disabled={!dirty}>Save profile</Button>
            {dirty && <span className="text-xs text-stone">Unsaved changes</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Projects ----------
function ProjectList({ projects, setProjects, onAdd }: { projects: Project[]; setProjects: (p: Project[]) => void; onAdd: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const previews = usePreviews(projects.map((p) => p.cover_path), api.signedUrls);

  const reorder = async (next: Project[]) => {
    const before = projects;
    setProjects(next.map((p, i) => ({ ...p, position: i + 1 })));
    try {
      await api.saveOrder(next.map((p) => p.id));
      api.refreshPublicSite();
    } catch (e) {
      setProjects(before);
      toast(errMsg(e), "error");
    }
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= projects.length) return;
    const next = projects.slice();
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  };
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = projects.slice();
    const from = next.findIndex((p) => p.id === dragId);
    const [item] = next.splice(from, 1);
    next.splice(next.findIndex((p) => p.id === targetId), 0, item);
    setDragId(null);
    reorder(next);
  };
  const publish = async (p: Project, published: boolean) => {
    setBusy(p.id);
    try {
      await api.updateProject(p.id, { published });
      setProjects(projects.map((x) => (x.id === p.id ? { ...x, published } : x)));
      api.refreshPublicSite();
      toast(published ? `“${p.name}” is live` : `“${p.name}” moved to drafts`);
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (p: Project) => {
    setBusy(p.id);
    try {
      await api.deleteProject(p);
      setProjects(projects.filter((x) => x.id !== p.id));
      api.refreshPublicSite();
      toast(`Deleted “${p.name}”`);
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="projects-h">
      <div className="flex items-end justify-between gap-4">
        <SectionTitle id="projects-h" title="Selected work" note="Drag or use the arrows to reorder. Numbers follow this order." />
        <Button onClick={async () => { setAdding(true); await onAdd(); setAdding(false); }} busy={adding} className="shrink-0">+ Add project</Button>
      </div>
      <ol className="mt-6 border-t border-line">
        {projects.map((p, i) => {
          const cover = p.cover_path ? previews[p.cover_path] : null;
          return (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(p.id)}
              onDragEnd={() => setDragId(null)}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line py-4 transition-opacity sm:flex-nowrap ${dragId === p.id ? "opacity-40" : ""}`}
            >
              <div className="flex flex-col">
                <button aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="px-2 py-0.5 text-stone hover:text-ink disabled:opacity-20">↑</button>
                <button aria-label={`Move ${p.name} down`} disabled={i === projects.length - 1} onClick={() => move(i, 1)} className="px-2 py-0.5 text-stone hover:text-ink disabled:opacity-20">↓</button>
              </div>
              <span className="label w-6 text-stone">{pad(i + 1)}</span>
              <Link href={`/admin/projects/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <span className="relative h-12 w-[72px] shrink-0 overflow-hidden border border-line bg-haze">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-mist">No image</span>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-xl leading-tight">{p.name}</span>
                  <span className="block truncate text-xs text-stone">{p.url ? p.url.replace(/^https?:\/\//, "") : "No website link"} · {p.project_images.length} screenshot{p.project_images.length === 1 ? "" : "s"}</span>
                </span>
              </Link>
              <div className="ml-auto flex items-center gap-3 pl-10 sm:pl-0">
                <Toggle checked={p.published} onChange={(v) => publish(p, v)} label={`Publish ${p.name}`} disabled={busy === p.id} />
                <Link href={`/admin/projects/${p.id}`} className="label link-static text-ink">Edit</Link>
                <ConfirmButton onConfirm={() => remove(p)} busy={busy === p.id}>Delete</ConfirmButton>
              </div>
            </li>
          );
        })}
      </ol>
      {projects.length === 0 && <p className="py-12 text-center text-stone">No projects yet — add your first one.</p>}
    </section>
  );
}

export function SectionTitle({ id, title, note }: { id?: string; title: string; note?: string }) {
  return (
    <div>
      <h2 id={id} className="font-display text-3xl sm:text-4xl">{title}</h2>
      {note && <p className="mt-2 text-sm text-stone">{note}</p>}
    </div>
  );
}
