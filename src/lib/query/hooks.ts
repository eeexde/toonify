"use client";
import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { SourceKey } from "../source/ids";
import type { ChapterPages, Page, Title, TitleSummary } from "../source/types";
import { filtersKey, type Tag } from "../source/filters";
import { browseApiPath, isSearching, type BrowseState } from "./browse";
import { api } from "./fetcher";

const MIN = 60_000;
const enc = encodeURIComponent;

export function browseQueryOptions(state: BrowseState, mature: boolean, source: SourceKey) {
  const term = isSearching(state.q) ? state.q.trim().toLowerCase() : "";
  const filters = filtersKey(state.filters);
  return infiniteQueryOptions({
    queryKey: ["browse", source, mature, term, filters],
    queryFn: ({ pageParam }) => api<Page<TitleSummary>>(browseApiPath({ q: term, filters: state.filters, page: pageParam, mature, source })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: (term ? 30 : 10) * MIN,
  });
}

export const useBrowse = (state: BrowseState, mature: boolean, source: SourceKey, enabled = true) =>
  useInfiniteQuery({ ...browseQueryOptions(state, mature, source), enabled });

export const useTags = (source: SourceKey, enabled = true) =>
  useQuery({
    queryKey: ["tags", source],
    queryFn: () => api<Tag[]>(`/api/tags?source=${source}`),
    staleTime: 24 * 60 * MIN,
    enabled,
  });

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
