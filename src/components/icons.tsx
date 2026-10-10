import type { SVGProps } from "react";

/** Small inline icon set (24px grid, 1.8 stroke). Decorative by default. */
const PATHS = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6",
  library: "M6 4h3.5v16H6zM11.5 4H15v16h-3.5zM16.8 5.2l3.2-.8 3 13.6-3.2.8",
  settings:
    "M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM19.4 13.4l1.6 1.2-1.8 3.2-1.9-.7a7 7 0 0 1-1.9 1.1L15 20.2h-3.6l-.4-2a7 7 0 0 1-1.9-1.1l-1.9.7-1.8-3.2 1.6-1.2a7 7 0 0 1 0-2.8L5.4 9.4l1.8-3.2 1.9.7A7 7 0 0 1 11 5.8l.4-2H15l.4 2a7 7 0 0 1 1.9 1.1l1.9-.7 1.8 3.2-1.6 1.2a7 7 0 0 1 0 2.6z",
  back: "M15 5 8 12l7 7",
  forward: "M9 5l7 7-7 7",
  check: "M5 12.5 10 17l9-10",
  plus: "M12 5v14M5 12h14",
  sort: "M8 4v16M4.5 7.5 8 4l3.5 3.5M16 20V4M12.5 16.5 16 20l3.5-3.5",
  x: "M6 6l12 12M18 6 6 18",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  alert: "M12 8v5M12 16.5v.01M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z",
  bookmark: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4.5l3 2",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14",
  upload: "M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14",
  trash: "M5 7h14M10 4h4M7 7l1 13h8l1-13",
  offline: "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.4M19 12.5a10 10 0 0 0-3-2M12 20h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
