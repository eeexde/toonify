"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Secondary text, e.g. a scanlation group. */
  hint?: string;
  disabled?: boolean;
}

const GAP = 6;
const MAX_LIST = 320;

/**
 * Brand-styled replacement for a native <select>: a trigger button and a listbox rendered in a
 * portal (so scroll containers never clip it), opening below or above the trigger, whichever fits.
 * Keyboard: Enter/Space/ArrowDown open; arrows, Home/End and typeahead move; Enter selects; Escape closes.
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
  triggerClassName = "",
  renderValue,
  align = "start",
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  triggerClassName?: string;
  renderValue?: (o: DropdownOption<T> | undefined) => ReactNode;
  align?: "start" | "center" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const enabledFrom = useCallback(
    (start: number, step: 1 | -1) => {
      for (let i = start; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
      return -1;
    },
    [options],
  );

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 200), vw - 16);
    const desired = align === "end" ? r.right - width : align === "center" ? r.left + r.width / 2 - width / 2 : r.left;
    const left = Math.min(Math.max(8, desired), vw - width - 8);
    const below = vh - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    if (below >= Math.min(MAX_LIST, 200) || below >= above) setPos({ left, width, top: r.bottom + GAP, maxHeight: Math.min(MAX_LIST, below) });
    else setPos({ left, width, bottom: vh - r.top + GAP, maxHeight: Math.min(MAX_LIST, above) });
  }, [align]);

  const openList = (at?: number) => {
    place();
    setActive(at ?? (selectedIndex >= 0 ? selectedIndex : enabledFrom(0, 1)));
    setOpen(true);
  };

  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    close();
    if (o.value !== value) onChange(o.value);
  };

  // Keep the list attached to the trigger while open; close on outside press.
  useLayoutEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, place]);

  // Focus the list and keep the active option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList(e.key === "ArrowUp" ? enabledFrom(options.length - 1, -1) : undefined);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const move = (i: number) => {
      e.preventDefault();
      if (i >= 0) setActive(i);
    };
    switch (e.key) {
      case "ArrowDown":
        return move(enabledFrom(active + 1, 1));
      case "ArrowUp":
        return move(enabledFrom(active - 1, -1));
      case "Home":
        return move(enabledFrom(0, 1));
      case "End":
        return move(enabledFrom(options.length - 1, -1));
      case "PageDown":
        return move(enabledFrom(Math.min(active + 8, options.length - 1), -1));
      case "PageUp":
        return move(enabledFrom(Math.max(active - 8, 0), 1));
      case "Enter":
      case " ":
        e.preventDefault();
        return choose(active);
      case "Escape":
        e.preventDefault();
        return close();
      case "Tab":
        return close(false);
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
          const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  const listId = `${id}-list`;
  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={`press flex w-full min-w-0 items-center gap-2 ${triggerClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{renderValue ? renderValue(selected) : selected?.label}</span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
            onKeyDown={onListKey}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
            className="fixed z-[60] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-card p-1.5 text-fg shadow-card outline-none motion-safe:animate-[fade_120ms_ease-out]"
          >
            {options.map((o, i) => {
              const isSel = i === selectedIndex;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={o.disabled || undefined}
                  onPointerMove={() => !o.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-xl px-3 text-sm ${
                    o.disabled ? "cursor-not-allowed opacity-40" : ""
                  } ${isActive && !o.disabled ? "bg-surface-2" : ""} ${isSel ? "font-bold text-accent-text" : "font-medium"}`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {o.label}
                    {o.hint && <span className={`ml-1.5 text-xs font-medium ${isSel ? "text-accent-text/80" : "text-muted"}`}>{o.hint}</span>}
                  </span>
                  {isSel && <Icon name="check" className="h-4 w-4 shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
