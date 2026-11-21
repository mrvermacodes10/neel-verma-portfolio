"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as api from "@/lib/admin";
import type { Layout, Project, ProjectImage } from "@/lib/types";
import { Button, ConfirmButton, Field, ImageSlot, Spinner, Toggle, inputCls, usePreviews, useToast } from "./ui";
import { SectionTitle } from "./Dashboard";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const LAYOUTS: { value: Layout; label: string; hint: string }[] = [
  { value: "full", label: "Full width", hint: "Edge-to-edge cover" },
  { value: "left", label: "Image left", hint: "Text on the right" },
  { value: "right", label: "Image right", hint: "Text on the left" },
];

export function ProjectEditor({ id }: { id: string }) {
  const toast = useToast();
  const router = useRouter();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [form, setForm] = useState({ name: "", description: "", url: "", github_url: "", layout: "full" as Layout });
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverLocal, setCoverLocal] = useState<string | null>(null);
  const [galleryBusy, setGalleryBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ key: string; url: string }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const previews = usePreviews([project?.cover_path, ...(project?.project_images.map((i) => i.path) ?? [])], api.signedUrls);

  useEffect(() => {
    api
      .loadProject(id)
      .then((p) => {
        setProject(p);
        if (p) setForm({ name: p.name, description: p.description, url: p.url ?? "", github_url: p.github_url ?? "", layout: p.layout });
      })
      .catch((e) => {
        toast(errMsg(e), "error");
        setProject(null);
      });
  }, [id, toast]);

  if (project === undefined)
    return (
      <div className="flex items-center gap-3 py-20 text-stone">
        <Spinner /> <span className="label">Loading</span>
      </div>
    );
  if (project === null)
    return (
      <div className="py-20">
        <p className="text-stone">This project doesn’t exist (it may have been deleted).</p>
        <Link href="/admin" className="label link-static mt-6 inline-block text-ink">← All projects</Link>
      </div>
    );

  const dirty =
    form.name !== project.name || form.description !== project.description || form.url !== (project.url ?? "") || form.github_url !== (project.github_url ?? "") || form.layout !== project.layout;
  const images = project.project_images;

  const save = async () => {
    if (!form.name.trim()) return toast("The project needs a name.", "error");
    let url: string | null, github: string | null;
    try {
      url = api.normaliseUrl(form.url);
      github = api.normaliseUrl(form.github_url);
    } catch (e) {
      return toast(errMsg(e), "error");
    }
    setSaving(true);
    try {
      const fields = { name: form.name.trim(), description: form.description.trim(), url, github_url: github, layout: form.layout };
      await api.updateProject(project.id, fields);
      setProject({ ...project, ...fields });
      setForm({ ...form, name: fields.name, description: fields.description, url: url ?? "", github_url: github ?? "" });
      api.refreshPublicSite();
      toast("Changes saved");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const setPublished = async (published: boolean) => {
    try {
      await api.updateProject(project.id, { published });
      setProject({ ...project, published });
      api.refreshPublicSite();
      toast(published ? "Published — it’s on your homepage" : "Moved to drafts");
    } catch (e) {
      toast(errMsg(e), "error");
    }
  };

  const uploadCover = async ([file]: File[]) => {
    setCoverBusy(true);
    setCoverLocal(URL.createObjectURL(file));
    try {
      const img = await api.setCover(project, file);
      setProject({ ...project, cover_path: img.path, cover_width: img.width, cover_height: img.height, cover_blur: img.blur });
      api.refreshPublicSite();
      toast("Cover image saved");
    } catch (e) {
      setCoverLocal(null);
      toast(errMsg(e), "error");
    } finally {
      setCoverBusy(false);
    }
  };
  const removeCover = async () => {
    setCoverBusy(true);
    try {
      await api.removeCover(project);
      setCoverLocal(null);
      setProject({ ...project, cover_path: null, cover_width: null, cover_height: null, cover_blur: null });
      api.refreshPublicSite();
      toast("Cover image removed");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setCoverBusy(false);
    }
  };

  const addScreens = async (files: File[]) => {
    const local = files.map((f, i) => ({ key: `${Date.now()}-${i}`, url: URL.createObjectURL(f) }));
    setPending((p) => [...p, ...local]);
    let list = images.slice();
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const nextPos = list.length ? Math.max(...list.map((x) => x.position)) + 1 : 0;
        const row = await api.addScreenshot(project.id, files[i], nextPos);
        list = [...list, row];
        ok++;
        setProject((p) => (p ? { ...p, project_images: list } : p));
      } catch (e) {
        toast(errMsg(e), "error");
      } finally {
        setPending((p) => p.filter((x) => x.key !== local[i].key));
      }
    }
    if (ok) {
      api.refreshPublicSite();
      toast(ok === 1 ? "Screenshot added" : `${ok} screenshots added`);
    }
  };
  const moveScreen = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const a = images[i], b = images[j];
    const swapped = images.slice();
    swapped[i] = { ...b, position: a.position };
    swapped[j] = { ...a, position: b.position };
    if (a.position === b.position) swapped.forEach((x, k) => (x.position = k)); // repair duplicate positions
    setProject({ ...project, project_images: swapped });
    setGalleryBusy("order");
    try {
      await Promise.all(swapped.map((x) => api.updateScreenshot(x.id, { position: x.position })));
      api.refreshPublicSite();
    } catch (e) {
      setProject({ ...project, project_images: images });
      toast(errMsg(e), "error");
    } finally {
      setGalleryBusy(null);
    }
  };
  const removeScreen = async (img: ProjectImage) => {
    setGalleryBusy(img.id);
    try {
      await api.deleteScreenshot(img);
      setProject({ ...project, project_images: images.filter((x) => x.id !== img.id) });
      api.refreshPublicSite();
      toast("Screenshot removed");
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setGalleryBusy(null);
    }
  };
  const saveAlt = async (img: ProjectImage, alt: string) => {
    if (alt === img.alt) return;
    try {
      await api.updateScreenshot(img.id, { alt });
      setProject({ ...project, project_images: images.map((x) => (x.id === img.id ? { ...x, alt } : x)) });
      api.refreshPublicSite();
    } catch (e) {
      toast(errMsg(e), "error");
    }
  };
  const destroy = async () => {
    setDeleting(true);
    try {
      await api.deleteProject(project);
      api.refreshPublicSite();
      router.push("/admin");
    } catch (e) {
      toast(errMsg(e), "error");
      setDeleting(false);
    }
  };

  return (
    <div>
      <Link href="/admin" className="label link-line text-stone hover:text-ink">← All projects</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <h1 className="font-display text-4xl sm:text-5xl">{project.name || "Untitled project"}</h1>
        <div className="flex items-center gap-4">
          <Toggle checked={project.published} onChange={setPublished} label="Published" />
          <ConfirmButton onConfirm={destroy} busy={deleting} confirmText="Delete project & images">Delete</ConfirmButton>
        </div>
      </div>

      {/* Details */}
      <section className="mt-10 grid gap-6">
        <Field label="Project name">
          <input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Short description">
          <textarea value={form.description} rows={4} maxLength={1500} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-y leading-relaxed`} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Website URL" hint="Leave empty to hide the “Visit website” link.">
            <input value={form.url} inputMode="url" placeholder="https://…" onChange={(e) => setForm({ ...form, url: e.target.value })} className={inputCls} />
          </Field>
          <Field label="GitHub URL" hint="Optional.">
            <input value={form.github_url} inputMode="url" placeholder="https://github.com/…" onChange={(e) => setForm({ ...form, github_url: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div>
          <span className="label mb-2 block text-stone">Layout on the homepage</span>
          <div className="grid grid-cols-3 border border-line">
            {LAYOUTS.map((l) => (
              <button key={l.value} type="button" onClick={() => setForm({ ...form, layout: l.value })}
                className={`border-r border-line px-2 py-3 text-left last:border-r-0 sm:px-4 ${form.layout === l.value ? "bg-ink text-paper" : "hover:bg-haze"}`}>
                <LayoutIcon layout={l.value} active={form.layout === l.value} />
                <span className="label mt-2 block">{l.label}</span>
                <span className={`hidden text-xs sm:block ${form.layout === l.value ? "text-paper/70" : "text-stone"}`}>{l.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Cover */}
      <section className="mt-16">
        <SectionTitle title="Cover image" note="The main image for this project. Uploads are resized, converted to WebP and saved immediately." />
        <div className="mt-6">
          <ImageSlot src={coverLocal ?? (project.cover_path ? previews[project.cover_path] ?? null : null)} label="cover image" busy={coverBusy} onFiles={uploadCover} onRemove={project.cover_path ? removeCover : undefined} fit="contain" />
        </div>
      </section>

      {/* Gallery */}
      <section className="mt-16">
        <SectionTitle title="Additional screenshots" note="Optional. Shown below the cover, in this order." />
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="flex flex-col">
              <div className="relative aspect-[4/3] overflow-hidden border border-line bg-haze">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {previews[img.path] ? <img src={previews[img.path]} alt={img.alt} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Spinner className="text-mist" /></span>}
                {galleryBusy === img.id && <div className="absolute inset-0 flex items-center justify-center bg-paper/70"><Spinner /></div>}
                <span className="label absolute left-2 top-2 bg-paper px-1.5 py-0.5 text-ink">{i + 1}</span>
              </div>
              <input defaultValue={img.alt} placeholder="Describe this image (alt text)" onBlur={(e) => saveAlt(img, e.target.value.trim())} className={`${inputCls} mt-2 !py-1.5 !text-xs`} aria-label={`Alt text for screenshot ${i + 1}`} />
              <div className="mt-2 flex items-center gap-1">
                <button aria-label="Move earlier" disabled={i === 0 || !!galleryBusy} onClick={() => moveScreen(i, -1)} className="px-2 py-1 text-stone hover:text-ink disabled:opacity-20">←</button>
                <button aria-label="Move later" disabled={i === images.length - 1 || !!galleryBusy} onClick={() => moveScreen(i, 1)} className="px-2 py-1 text-stone hover:text-ink disabled:opacity-20">→</button>
                <button onClick={() => removeScreen(img)} disabled={!!galleryBusy} className="label link-static ml-auto text-danger disabled:opacity-40">Remove</button>
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key}>
              <div className="relative aspect-[4/3] overflow-hidden border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center gap-2"><Spinner /><span className="label">Uploading</span></div>
              </div>
            </li>
          ))}
          <li>
            <ImageSlot src={null} label="screenshots" ratio="4 / 3" multiple compact onFiles={addScreens} />
          </li>
        </ul>
      </section>

      {/* Sticky save bar */}
      <div className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur-[2px] transition-transform duration-300 ${dirty ? "visible translate-y-0" : "invisible translate-y-full"}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="text-sm text-stone">Unsaved changes</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setForm({ name: project.name, description: project.description, url: project.url ?? "", github_url: project.github_url ?? "", layout: project.layout })}>Discard</Button>
            <Button onClick={save} busy={saving}>Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LayoutIcon({ layout, active }: { layout: Layout; active: boolean }) {
  const fill = active ? "bg-paper" : "bg-ink";
  const line = active ? "bg-paper/50" : "bg-mist";
  return (
    <span className="flex h-7 w-12 gap-1" aria-hidden>
      {layout === "full" ? (
        <span className={`h-full w-full ${fill}`} />
      ) : (
        <>
          <span className={`h-full w-2/3 ${fill} ${layout === "right" ? "order-2" : ""}`} />
          <span className="flex w-1/3 flex-col justify-center gap-1">
            <span className={`h-0.5 w-full ${line}`} />
            <span className={`h-0.5 w-2/3 ${line}`} />
          </span>
        </>
      )}
    </span>
  );
}
