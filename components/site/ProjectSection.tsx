import type { Project } from "@/lib/types";
import { Picture } from "./Picture";
import { Reveal } from "./Reveal";

const pad = (n: number) => String(n).padStart(2, "0");
const host = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function Links({ project }: { project: Project }) {
  if (!project.url && !project.github_url) return null;
  return (
    <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
      {project.url && (
        <a href={project.url} target="_blank" rel="noopener noreferrer" className="label link-static text-ink">
          Visit website <span aria-hidden>↗</span>
        </a>
      )}
      {project.github_url && (
        <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="label link-static text-ink">
          GitHub <span aria-hidden>↗</span>
        </a>
      )}
    </div>
  );
}

function Meta({ project, index }: { project: Project; index: number }) {
  return (
    <div>
      <div className="label flex items-center gap-4 text-stone">
        <span>{pad(index)}</span>
        <span className="h-px w-10 bg-mist" />
        {project.url && <span className="normal-case tracking-[0.04em]">{host(project.url)}</span>}
      </div>
      <h3 className="mt-5 font-display text-[clamp(2.4rem,5.4vw,5.2rem)] leading-[0.95] tracking-[-0.01em]">{project.name}</h3>
      {project.description && <p className="mt-6 max-w-[46ch] whitespace-pre-line text-[15px] leading-[1.75] text-graphite sm:text-base">{project.description}</p>}
      <Links project={project} />
    </div>
  );
}

function Gallery({ project }: { project: Project }) {
  const imgs = project.project_images;
  if (!imgs.length) return null;
  const cols = imgs.length === 1 ? "sm:grid-cols-1" : imgs.length === 2 || imgs.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div className={`mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 ${cols}`}>
      {imgs.map((img, i) => (
        <Reveal key={img.id} delay={(i % 3) * 90}>
          <Picture path={img.path} width={img.width} height={img.height} blur={img.blur} alt={img.alt || `${project.name} screenshot ${i + 1}`} sizes={imgs.length === 1 ? "100vw" : "(min-width: 640px) 33vw, 100vw"} />
        </Reveal>
      ))}
    </div>
  );
}

export function ProjectSection({ project, index }: { project: Project; index: number }) {
  const cover = (sizes: string, priority = false) => (
    <Picture path={project.cover_path} width={project.cover_width} height={project.cover_height} blur={project.cover_blur} alt={`${project.name} — cover image`} sizes={sizes} priority={priority} />
  );

  return (
    <article id={`project-${index}`} className="scroll-mt-20 border-t border-line pt-10 sm:pt-14">
      {project.layout === "full" ? (
        <>
          <Reveal className="grid gap-8 px-5 sm:px-8 lg:grid-cols-12 lg:px-12">
            <div className="lg:col-span-7">
              <Meta project={project} index={index} />
            </div>
          </Reveal>
          <Reveal className="mt-10 sm:mt-14">{cover("100vw")}</Reveal>
          <div className="px-5 sm:px-8 lg:px-12">
            <Gallery project={project} />
          </div>
        </>
      ) : (
        <div className="px-5 sm:px-8 lg:px-12">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            <Reveal className={`lg:col-span-8 ${project.layout === "right" ? "lg:order-2" : ""}`}>{cover("(min-width: 1024px) 66vw, 100vw")}</Reveal>
            <Reveal className={`lg:sticky lg:top-28 lg:col-span-4 ${project.layout === "right" ? "lg:order-1" : ""}`} delay={120}>
              <Meta project={project} index={index} />
            </Reveal>
          </div>
          <Gallery project={project} />
        </div>
      )}
      <div className="h-20 sm:h-28" />
    </article>
  );
}
