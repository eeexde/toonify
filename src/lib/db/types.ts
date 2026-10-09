import type { SourceKey } from "../source/ids";

export interface LibraryItem {
  titleId: string;
  title: string;
  cover: string;
  addedAt: number;
  lastChapterSeenId?: string;
  latestChapterId?: string;
}

export interface HistoryItem {
  titleId: string;
  title: string;
  cover: string;
  chapterId: string;
  chapterName: string;
  readAt: number;
}

export interface ProgressItem {
  titleId: string;
  chapterId: string;
  pageIndex: number;
  scrollRatio: number;
  completed: boolean;
  updatedAt: number;
}

export interface Settings {
  mature: boolean;
  matureConfirmedAt?: number;
  theme: "dark" | "light" | "system";
  readerWidth: number;
  source: SourceKey;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export const DEFAULT_SETTINGS: Settings = {
  mature: false,
  theme: "dark",
  readerWidth: 720,
  source: "md",
};
