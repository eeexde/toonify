import { redirect } from "next/navigation";

/** Search lives in the header now; keep old /search?q= links working. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const term = (Array.isArray(q) ? q[0] : q)?.trim();
  redirect(term ? `/?q=${encodeURIComponent(term)}` : "/");
}
