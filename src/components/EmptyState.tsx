import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/**
 * Empty / informational state. The art is the brand's three-panel strip with
 * the middle panel holding the icon, so every empty screen reads as Toonify.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "neutral",
  role,
}: {
  icon: IconName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  role?: "status" | "alert";
}) {
  return (
    <div role={role} className="mx-auto flex max-w-sm flex-col items-center px-4 py-14 text-center">
      <div aria-hidden className="flex w-16 flex-col gap-1.5">
        <span className="h-4 rounded-md border border-dashed border-line-strong/60" />
        <span
          className={`flex h-14 items-center justify-center rounded-lg ${
            tone === "danger" ? "bg-danger/12 text-danger" : "bg-accent-soft text-accent-text"
          }`}
        >
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <span className="h-4 rounded-md border border-dashed border-line-strong/60" />
      </div>
      <p className="mt-5 text-base font-semibold text-fg">{title}</p>
      {body && <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const buttonPrimary =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-fg hover:brightness-105 disabled:opacity-40";
export const buttonSecondary =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-strong/70 bg-card px-4 text-sm font-semibold text-fg hover:bg-surface-2 disabled:opacity-40";
