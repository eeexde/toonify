import { after } from "next/server";

/** Keep a background promise alive after the response (serverless-safe). */
export function defer(p: Promise<unknown>): void {
  try {
    after(() => p);
  } catch {
    void p;
  }
}
