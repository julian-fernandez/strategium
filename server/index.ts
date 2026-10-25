import { serve } from "@hono/node-server";
import { SERVER_PORT, UPDATE_INTERVAL_MS } from "../shared/config";
import { app } from "./app";
import { checkForUpdates } from "./updates";

serve({ fetch: app.fetch, port: SERVER_PORT }, ({ port }) => {
  console.log(`army-cards server on http://localhost:${port}`);
});

const runCheck = () =>
  checkForUpdates().then((meta) => {
    if (meta.lastError) console.warn(`Update check failed: ${meta.lastError}`);
  });
void runCheck();
setInterval(runCheck, UPDATE_INTERVAL_MS);
