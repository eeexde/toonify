"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { readSettings } from "./actions";
import { db } from "./schema";
import type { ProgressItem } from "./types";

export const useSettings = () => useLiveQuery(() => readSettings(db), []);

export const useLibrary = () => useLiveQuery(() => db.library.orderBy("addedAt").reverse().toArray(), []);

export const useLibraryItem = (titleId: string) =>
  useLiveQuery(async () => (await db.library.get(titleId)) ?? null, [titleId]);

export const useHistory = () => useLiveQuery(() => db.history.orderBy("readAt").reverse().toArray(), []);

export const useHistoryItem = (titleId: string) =>
  useLiveQuery(async () => (await db.history.get(titleId)) ?? null, [titleId]);

export const useProgressMap = (titleId: string) =>
  useLiveQuery(async () => {
    const rows = await db.progress.where("titleId").equals(titleId).toArray();
    return new Map<string, ProgressItem>(rows.map((r) => [r.chapterId, r]));
  }, [titleId]);
