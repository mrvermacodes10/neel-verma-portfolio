"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// ---------- buttons & fields ----------
export function Button({
  children, onClick, variant = "primary", disabled, busy, type = "button", className = "", title,
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; busy?: boolean; type?: "button" | "submit"; className?: string; title?: string }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-graphite",
    secondary: "border border-ink text-ink hover:bg-ink hover:text-paper",
    ghost: "text-ink hover:bg-haze",
    danger: "border border-danger text-danger hover:bg-danger hover:text-paper",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} title={title}
      className={`label inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-r-transparent [animation:spin_.7s_linear_infinite] ${className}`} aria-hidden />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block text-stone">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-stone">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-mist focus:border-ink";

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5 disabled:opacity-40">
      <span className={`relative h-5 w-9 border transition-colors ${checked ? "border-ink bg-ink" : "border-mist bg-paper"}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] transition-all duration-300 ${checked ? "left-[18px] bg-paper" : "left-[2px] bg-mist"}`} />
      </span>
      <span className={`label ${checked ? "text-ink" : "text-stone"}`}>{checked ? "Published" : "Draft"}</span>
    </button>
  );
}

/** Two-step destructive button: first click arms it, second click confirms. */
export function ConfirmButton({ children, confirmText = "Confirm delete", onConfirm, busy, className = "" }: { children: ReactNode; confirmText?: string; onConfirm: () => void; busy?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button variant={armed ? "danger" : "ghost"} busy={busy} className={className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmText : children}
    </Button>
  );
}

// ---------- toasts ----------
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = next.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`anim-fade-in pointer-events-auto max-w-md px-4 py-3 text-sm shadow-[0_8px_30px_rgba(0,0,0,.12)] ${t.kind === "error" ? "bg-danger text-paper" : "bg-ink text-paper"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- image slot ----------
/** An image slot that always exists: shows an upload placeholder until an image is added. */
export function ImageSlot({
  src, label, ratio = "16 / 10", busy, onFiles, onRemove, multiple = false, compact = false, fit = "cover",
}: { src: string | null; label: string; ratio?: string; busy?: boolean; onFiles: (files: File[]) => void; onRemove?: () => void; multiple?: boolean; compact?: boolean; fit?: "cover" | "contain" }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const pick = () => !busy && input.current?.click();
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div className="w-full">
      <div
        className={`relative w-full overflow-hidden border ${drag ? "border-ink bg-haze" : src ? "border-line" : "border-dashed border-mist bg-haze/60"} transition-colors`}
        style={{ aspectRatio: ratio }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed preview URLs / blob URLs
          <img src={src} alt={label} className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
        ) : (
          <button type="button" onClick={pick} className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone hover:text-ink" aria-label={`Upload ${label}`}>
            <span className="text-2xl font-light leading-none">+</span>
            <span className="label">{compact ? "Add" : `Upload ${label}`}</span>
            {!compact && <span className="text-xs text-mist">Click or drop {multiple ? "images" : "an image"} here</span>}
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-paper/75 text-ink">
            <Spinner /> <span className="label">Uploading</span>
          </div>
        )}
      </div>
      {src && (
        <div className="mt-2 flex gap-4">
          <button type="button" onClick={pick} disabled={busy} className="label link-static text-ink disabled:opacity-40">Replace</button>
          {onRemove && <button type="button" onClick={onRemove} disabled={busy} className="label link-static text-danger disabled:opacity-40">Remove</button>}
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" multiple={multiple} className="hidden" onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/** Resolves preview URLs for storage paths (signed URLs, cached per path). */
export function usePreviews(paths: (string | null | undefined)[], load: (p: string[]) => Promise<Record<string, string>>) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).join("|");
  useEffect(() => {
    const missing = (paths.filter(Boolean) as string[]).filter((p) => !urls[p]);
    if (!missing.length) return;
    let alive = true;
    load(missing).then((u) => alive && setUrls((prev) => ({ ...prev, ...u }))).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
