"use client";
import { useParams } from "next/navigation";
import { Reader } from "@/components/reader/Reader";

export default function ReadPage() {
  const p = useParams<{ titleId: string; chapterId: string }>();
  const titleId = decodeURIComponent(p.titleId);
  const chapterId = decodeURIComponent(p.chapterId);
  return <Reader key={`${titleId}/${chapterId}`} titleId={titleId} chapterId={chapterId} />;
}
