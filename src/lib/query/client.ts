import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, del, get, set } from "idb-keyval";
import { ApiError } from "./fetcher";

const DAY = 24 * 60 * 60 * 1000;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 7 * DAY,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && [400, 404].includes(err.status)) && count < 2,
      },
    },
  });
}

function idbStorage() {
  if (typeof indexedDB === "undefined") return undefined;
  const store = createStore("toonify-query", "kv");
  return {
    getItem: (k: string) => get<string>(k, store).then((v) => v ?? null),
    setItem: (k: string, v: string) => set(k, v, store),
    removeItem: (k: string) => del(k, store),
  };
}

export const persister = createAsyncStoragePersister({ storage: idbStorage(), key: "toonify-query-v1" });
export const PERSIST_MAX_AGE = 7 * DAY;
