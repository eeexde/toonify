"use client";
import { useEffect } from "react";
import { useSettings } from "@/lib/db/hooks";

export function ThemeApplier() {
  const settings = useSettings();
  useEffect(() => {
    if (settings) document.documentElement.dataset.theme = settings.theme;
  }, [settings]);
  return null;
}
