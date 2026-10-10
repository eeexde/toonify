import { Icon } from "@/components/icons";

export default function Offline() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-20 text-center">
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon name="offline" className="h-7 w-7" />
      </span>
      <h1 className="display mt-5 text-[2.25rem]">You&apos;re offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">Recently opened pages and images are still available.</p>
    </div>
  );
}
