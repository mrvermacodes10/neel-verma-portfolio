import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <div className="label text-stone">404</div>
      <h1 className="mt-4 font-display text-4xl">Page not found</h1>
      <Link href="/" className="label link-static mt-8 self-start text-ink">Back to the portfolio</Link>
    </main>
  );
}
