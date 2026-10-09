import { useSyncExternalStore } from "react";

let stale = false;
const subs = new Set<() => void>();

export const staleStore = {
  get: () => stale,
  set(v: boolean) {
    if (v === stale) return;
    stale = v;
    subs.forEach((cb) => cb());
  },
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => subs.delete(cb);
  },
};

export function useStale(): boolean {
  return useSyncExternalStore(staleStore.subscribe, staleStore.get, () => false);
}
