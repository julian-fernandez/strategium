export const SERVER_PORT = 8787;

/** The web app's port, on this computer and, with `pnpm dev:lan`, on the local network. */
export const WEB_PORT = 5173;

/** How often the server checks BSData and Wahapedia for new data. */
export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** How often the web app asks the server whether the data changed. */
export const META_POLL_MS = 5 * 60 * 1000;
