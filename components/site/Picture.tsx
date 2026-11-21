import Image from "next/image";
import { mediaUrl } from "@/lib/paths";

interface Props {
  path: string | null;
  width: number | null;
  height: number | null;
  blur?: string | null;
  alt: string;
  sizes: string;
  /** Aspect ratio used for the empty placeholder (and to crop when `crop` is set). */
  ratio?: string;
  crop?: boolean;
  priority?: boolean;
  label?: string;
  className?: string;
}

/** A large editorial image — or a clean placeholder frame when nothing has been uploaded yet. */
export function Picture({ path, width, height, blur, alt, sizes, ratio = "16 / 10", crop = false, priority, label = "Image coming soon", className = "" }: Props) {
  if (!path || !width || !height) {
    return (
      <div className={`relative flex w-full items-center justify-center bg-haze ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={`${alt} — ${label}`}>
        <span className="label text-mist">{label}</span>
      </div>
    );
  }
  if (crop) {
    return (
      <div className={`zoom relative w-full overflow-hidden bg-haze ${className}`} style={{ aspectRatio: ratio }}>
        <Image src={mediaUrl(path)} alt={alt} fill sizes={sizes} priority={priority} placeholder={blur ? "blur" : "empty"} blurDataURL={blur ?? undefined} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={`zoom overflow-hidden bg-haze ${className}`}>
      <Image src={mediaUrl(path)} alt={alt} width={width} height={height} sizes={sizes} priority={priority} placeholder={blur ? "blur" : "empty"} blurDataURL={blur ?? undefined} className="h-auto w-full" />
    </div>
  );
}
