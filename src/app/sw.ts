/// <reference lib="webworker" />
// Temporary placeholder until Task 18. Serwist requires the manifest reference.
declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: unknown };
void self.__SW_MANIFEST;
export {};
