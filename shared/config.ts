export const SERVER_PORT = 8787;

/** The web app's port, on this computer and, with `pnpm dev:lan`, on the local network. */
export const WEB_PORT = 5173;

/**
 * The BSData commit the app stays on. GW's DMCA notice took BSData's
 * repositories down on 12 November 2026, and this, from 11 November, was its
 * last. The app doesn't ask BSData for updates while it's set: later changes
 * come in as overrides (shared/overrides.ts). Unset it to follow BSData again,
 * should it come back.
 */
export const BSDATA_FROZEN: string | undefined = "f015101d4c495173283e1b97e9d59f2befb877ad";

/** How often the server checks BSData and Wahapedia for new data. */
export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** How often the web app asks the server whether the data changed. */
export const META_POLL_MS = 5 * 60 * 1000;
