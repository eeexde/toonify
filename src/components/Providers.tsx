"use client";
import { useEffect, useState, type ReactNode } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Toaster, toast } from "sonner";
import { makeQueryClient, persister, PERSIST_MAX_AGE } from "@/lib/query/client";
import { db, storageDegraded } from "@/lib/db/schema";
import { ThemeApplier } from "./ThemeApplier";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  useEffect(() => {
    if (storageDegraded) toast.warning("Storage unavailable — your library won't be saved after you close this tab.");
    db.open().catch(() => toast.error("Could not open local storage. Library and history are disabled."));
  }, []);
  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: "v1" }}>
      <ThemeApplier />
      {children}
      <Toaster
        position="top-center"
        offset={{ top: "max(16px, env(safe-area-inset-top))" }}
        mobileOffset={{ top: "max(12px, env(safe-area-inset-top))" }}
        toastOptions={{ classNames: { toast: "toonify-toast" } }}
      />
    </PersistQueryClientProvider>
  );
}
