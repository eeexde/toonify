import { staleStore } from "./stale-store";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new ApiError("You appear to be offline.", 0);
  }
  let body: { data?: T; stale?: boolean; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // fall through with empty body
  }
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  staleStore.set(Boolean(body.stale));
  return body.data as T;
}
