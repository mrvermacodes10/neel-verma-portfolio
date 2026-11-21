"use client";
import { useEffect, useState } from "react";

export function Header({ name, hasEmail }: { name: string; hasEmail: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-40 bg-paper/95 backdrop-blur-[2px] transition-[border-color] duration-500 ${scrolled ? "border-b border-line" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-5 sm:h-16 sm:px-8 lg:px-12">
        <a href="#top" className="label !text-[12px] !tracking-[0.28em] text-ink">{name}</a>
        <nav className="flex items-center gap-6 sm:gap-10">
          <a href="#about" className="label link-line text-ink">About</a>
          <a href="#work" className="label link-line text-ink">Work</a>
          {hasEmail && <a href="#contact" className="label link-line text-ink">Contact</a>}
        </nav>
      </div>
    </header>
  );
}
