import { getPortfolio } from "@/lib/data";
import { Header } from "@/components/site/Header";
import { Picture } from "@/components/site/Picture";
import { ProjectSection } from "@/components/site/ProjectSection";
import { Reveal } from "@/components/site/Reveal";

// Rebuilt on demand when the admin saves (see /api/revalidate), and at most hourly otherwise.
export const revalidate = 3600;

const pad = (n: number) => String(n).padStart(2, "0");

export default async function Home() {
  const data = await getPortfolio();
  // On a transient error, throw: Next keeps serving the last good version and shows app/error.tsx otherwise.
  if (!data.ok && data.reason === "error") throw new Error(data.message ?? "Could not load portfolio");
  if (!data.ok) return <Unavailable />;

  const profile = data.profile;
  const name = profile?.name || "Neel Verma";
  const [first, ...rest] = name.split(" ");
  const projects = data.projects;
  const year = new Date().getFullYear();

  return (
    <div id="top">
      <Header name={name} hasEmail={!!profile?.email} />

      <main>
        {/* ABOUT ME */}
        <section id="about" className="mx-auto max-w-[1600px] scroll-mt-16 px-5 pb-20 pt-24 sm:px-8 sm:pb-28 sm:pt-32 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col justify-between lg:col-span-7">
              <Reveal>
                <div className="label text-stone">About me</div>
                <h1 className="mt-6 font-display text-[clamp(4.2rem,13vw,13.5rem)] uppercase leading-[0.84] tracking-[-0.02em]">
                  {first}
                  {rest.length > 0 && (
                    <>
                      <br />
                      {rest.join(" ")}
                    </>
                  )}
                </h1>
              </Reveal>
              <Reveal delay={150} className="mt-12 grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:mt-20">
                <div className="label text-stone">Student &amp; developer</div>
                <p className="max-w-[44ch] whitespace-pre-line text-[17px] leading-[1.7] text-graphite sm:text-lg">{profile?.intro}</p>
              </Reveal>
            </div>
            <Reveal className="lg:col-span-5" delay={80}>
              <Picture
                path={profile?.photo_path ?? null}
                width={profile?.photo_width ?? null}
                height={profile?.photo_height ?? null}
                blur={profile?.photo_blur}
                alt={`Portrait of ${name}`}
                sizes="(min-width: 1024px) 40vw, 100vw"
                ratio="4 / 5"
                crop
                priority
                label="Portrait coming soon"
              />
            </Reveal>
          </div>
        </section>

        {/* SELECTED WORK */}
        <section id="work" className="scroll-mt-16">
          <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
            <Reveal className="flex items-baseline justify-between border-t border-ink pt-6">
              <h2 className="label text-ink">Selected work</h2>
              <span className="label text-stone">({pad(projects.length)})</span>
            </Reveal>
            {projects.length > 0 ? (
              <ol className="mt-8 mb-20 sm:mb-28">
                {projects.map((p, i) => (
                  <Reveal as="li" key={p.id} delay={i * 50}>
                    <a href={`#project-${i + 1}`} className="group flex items-baseline gap-6 border-b border-line py-4 transition-colors hover:text-stone sm:gap-10 sm:py-5">
                      <span className="label w-8 shrink-0 text-stone">{pad(i + 1)}</span>
                      <span className="font-display text-2xl leading-none sm:text-4xl">{p.name}</span>
                      <span className="ml-auto hidden max-w-[40ch] truncate text-sm text-stone md:block">{p.description.split("\n")[0]}</span>
                      <span aria-hidden className="translate-x-0 text-stone transition-transform duration-500 group-hover:translate-x-1">→</span>
                    </a>
                  </Reveal>
                ))}
              </ol>
            ) : (
              <p className="py-24 text-center text-stone">New work is on its way.</p>
            )}
          </div>
          <div className="mx-auto max-w-[1600px]">
            {projects.map((p, i) => (
              <ProjectSection key={p.id} project={p} index={i + 1} />
            ))}
          </div>
        </section>
      </main>

      <footer id="contact" className="mx-auto max-w-[1600px] scroll-mt-16 px-5 pb-12 sm:px-8 lg:px-12">
        <div className="border-t border-ink pt-10">
          {profile?.email && (
            <Reveal className="mb-16">
              <div className="label text-stone">Contact</div>
              <a href={`mailto:${profile.email}`} className="link-line mt-4 inline-block font-display text-[clamp(1.8rem,5vw,4rem)] leading-tight">{profile.email}</a>
            </Reveal>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="label text-stone">© {year} {name}</span>
            <a href="#top" className="label link-line text-ink">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <div className="label text-stone">Neel Verma</div>
      <h1 className="mt-4 font-display text-4xl">Setup required</h1>
      <p className="mt-4 leading-relaxed text-graphite">
        This site isn’t connected to Supabase yet. Add <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to the environment, then redeploy. See the README.
      </p>
    </main>
  );
}
