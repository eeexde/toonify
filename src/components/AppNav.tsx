"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { HeaderSearch } from "./HeaderSearch";
import { Icon, type IconName } from "./icons";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const isReader = (path: string) => path.startsWith("/read/");

/** The brand mark: three stacked panels of a vertical strip, the top one lit. */
export function Wordmark({ className = "", textClassName = "text-[1.7rem]" }: { className?: string; textClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 16 24" className="h-6 w-4" aria-hidden focusable="false">
        <rect x="1" y="1" width="14" height="7" rx="2" fill="var(--accent)" />
        <rect x="1" y="9.5" width="14" height="6" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="1" y="17" width="14" height="6" rx="2" fill="currentColor" opacity="0.3" />
      </svg>
      <span className={`display uppercase leading-none ${textClassName}`}>Toonify</span>
    </span>
  );
}

export function MainFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (isReader(path)) return <main id="main">{children}</main>;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12 md:pt-8">
      {children}
    </main>
  );
}

export function AppNav() {
  const path = usePathname();
  if (isReader(path)) return null;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-chrome pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:gap-1 md:px-6">
          <Link href="/" aria-label="Toonify home" className="press shrink-0 rounded-lg md:mr-6">
            <Wordmark textClassName="text-[1.45rem] md:text-[1.7rem]" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active(t.href) ? "page" : undefined}
                className={`press flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium ${
                  active(t.href) ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <Icon name={t.icon} className="h-[18px] w-[18px]" />
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="min-w-0 flex-1 md:ml-auto md:max-w-sm">
            <Suspense fallback={<div className="h-11 rounded-full border border-line-strong/50 bg-card" />}>
              <HeaderSearch />
            </Suspense>
          </div>
        </div>
      </header>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-chrome pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-3">
          {TABS.map((t) => {
            const on = active(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`press flex flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide ${on ? "text-accent-text" : "text-muted"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${on ? "bg-accent-soft" : ""}`}>
                  <Icon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.8} />
                </span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
