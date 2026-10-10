"use client";
import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { SourceKey } from "../source/ids";
import type { ChapterPages, Page, Title, TitleSummary } from "../source/types";
import { api } from "./fetcher";

const MIN = 60_000;
const enc = encodeURIComponent;

export function homeQueryOptions(mature: boolean, source: SourceKey) {
  return infiniteQueryOptions({
    queryKey: ["home", source, mature],
    queryFn: ({ pageParam }) => api<Page<TitleSummary>>(`/api/home?page=${pageParam}&mature=${mature ? 1 : 0}&source=${source}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 10 * MIN,
  });
}

export const useHome = (mature: boolean, source: SourceKey, enabled = true) =>
  useInfiniteQuery({ ...homeQueryOptions(mature, source), enabled });

export function useSearch(q: string, mature: boolean, source: SourceKey, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: ["search", source, mature, term.toLowerCase()],
    queryFn: () => api<Page<TitleSummary>>(`/api/search?q=${enc(term)}&mature=${mature ? 1 : 0}&source=${source}`),
    enabled: enabled && term.length >= 2,
    staleTime: 30 * MIN,
  });
}

export const titleQueryOptions = (titleId: string) =>
  queryOptions({
    queryKey: ["title", titleId],
    queryFn: () => api<Title>(`/api/title/${enc(titleId)}`),
    staleTime: 60 * MIN,
  });

export const useTitle = (titleId: string) => useQuery(titleQueryOptions(titleId));

export const chapterQueryOptions = (titleId: string, chapterId: string) =>
  queryOptions({
    queryKey: ["chapter", titleId, chapterId],
    queryFn: () => api<ChapterPages>(`/api/chapter/${enc(titleId)}/${enc(chapterId)}`),
    staleTime: 30 * 24 * 60 * MIN,
  });

export const useChapter = (titleId: string, chapterId: string, enabled = true) =>
  useQuery({ ...chapterQueryOptions(titleId, chapterId), enabled });

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: () => api<Record<string, "up" | "down">>("/api/health"), staleTime: MIN });
