import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-14 border-t border-line pt-6 text-center text-xs leading-relaxed text-muted">
      Data provided by{" "}
      <a href="https://mangadex.org" target="_blank" rel="noreferrer" className="font-semibold text-fg underline decoration-line-strong underline-offset-2 hover:decoration-accent">
        MangaDex
      </a>
      . Chapters are credited to their scanlation groups.
      <br className="sm:hidden" /> Toonify is free and has no ads.{" "}
      <Link href="/about" className="font-semibold text-fg underline decoration-line-strong underline-offset-2 hover:decoration-accent">
        About &amp; legal
      </Link>
    </footer>
  );
}
