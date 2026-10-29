import { hc } from "hono/client";
import type { AppType } from "../../server/app";

/**
 * The typed API client. Routes, inputs and responses come straight from the
 * server's own types (Hono RPC), so a renamed field fails the typecheck here.
 * Works on the main thread and in the engine worker.
 */
export const api = hc<AppType>(globalThis.location.origin).api;

/** A response body that is either the data or `{ error }`, as data or a thrown Error. */
export function unwrap<T extends object>(body: T | { error: string }): T {
  if ("error" in body) throw new Error(body.error);
  return body;
}
