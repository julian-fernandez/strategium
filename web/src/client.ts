import { hc } from "hono/client";
import type { AppType } from "../../server/app";

/**
 * The typed API client. Routes, inputs and responses come straight from the
 * server's own types (Hono RPC), so a renamed field fails the typecheck here.
 * Works on the main thread and in the engine worker.
 */
export const api = hc<AppType>(globalThis.location.origin).api;

/**
 * A response's JSON. When the API server is down or restarting, the dev
 * proxy answers with an empty error instead; that becomes a plain message
 * rather than a JSON parse error.
 */
export async function read<R extends { ok: boolean; status: number; json(): Promise<unknown> }>(
  response: R,
): Promise<Awaited<ReturnType<R["json"]>>> {
  try {
    return (await response.json()) as Awaited<ReturnType<R["json"]>>;
  } catch {
    throw new Error(
      response.ok
        ? "The server's answer couldn't be read."
        : `Can't reach the Strategium server (HTTP ${response.status}). Is \`pnpm dev\` running?`,
    );
  }
}

/** A response body that is either the data or `{ error }`, as data or a thrown Error. */
export function unwrap<T extends object>(body: T | { error: string }): T {
  if ("error" in body) throw new Error(body.error);
  return body;
}
