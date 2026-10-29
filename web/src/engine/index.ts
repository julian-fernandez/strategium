import * as Comlink from "comlink";
import type { Engine } from "./engine.worker";

export type { ListSource } from "./engine.worker";

/** The army engine, running in a Web Worker so parsing and resolving never block the UI. */
export const engine = Comlink.wrap<Engine>(
  new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" }),
);
