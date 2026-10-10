import Link from "next/link";
import { buttonPrimary } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-20 text-center">
      <p aria-hidden className="display text-[6rem] leading-none text-accent-text">404</p>
      <h1 className="display mt-2 text-[2.25rem]">Not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">This page or series doesn&apos;t exist, or the source removed it.</p>
      <Link href="/" className={`${buttonPrimary} mt-6`}>Back home</Link>
    </div>
  );
}
