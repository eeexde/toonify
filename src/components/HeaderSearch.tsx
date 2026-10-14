"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { browseHref, readBrowse } from "@/lib/query/browse";
import { Icon } from "./icons";

const DEBOUNCE_MS = 350;

/**
 * The one search field. Typing drives Home (`/?q=`): on Home it replaces the URL in place,
 * from any other page it navigates to Home. Filters already in the URL are kept.
 */
export function HeaderSearch() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const onHome = path === "/";
  const urlQ = onHome ? params.get("q") ?? "" : "";
  const [input, setInput] = useState(urlQ);
  const synced = useRef(urlQ);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL changed from outside (back button, a cleared chip, leaving Home): follow it.
  useEffect(() => {
    if (urlQ.trim() !== synced.current.trim()) {
      synced.current = urlQ;
      setInput(urlQ);
    }
  }, [urlQ]);

  const go = (value: string) => {
    const term = value.trim();
    synced.current = term;
    const href = browseHref(term, onHome ? readBrowse(params).filters : {});
    if (onHome) router.replace(href, { scroll: false });
    else router.push(href);
  };

  useEffect(() => {
    if (input.trim() === synced.current.trim()) return;
    const t = setTimeout(() => go(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads the latest params on fire
  }, [input]);

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        go(input);
        inputRef.current?.blur();
      }}
    >
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search titles"
        aria-label="Search titles"
        maxLength={100}
        enterKeyHint="search"
        autoComplete="off"
        className="h-11 w-full appearance-none rounded-full border border-line-strong/50 bg-card pl-10 pr-10 text-[15px] text-fg outline-none transition-colors placeholder:text-muted focus:border-accent focus-visible:outline-none focus:ring-[3px] focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {input && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setInput("");
            go("");
            inputRef.current?.focus();
          }}
          className="press absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-fg"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
