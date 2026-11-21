"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <div className="label text-stone">Neel Verma</div>
      <h1 className="mt-4 font-display text-4xl">Back shortly</h1>
      <p className="mt-4 leading-relaxed text-graphite">The portfolio couldn’t be loaded just now.</p>
      <button onClick={reset} className="label link-static mt-8 self-start text-ink">Try again</button>
    </main>
  );
}
