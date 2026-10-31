import { serve } from "@hono/node-server";
import { SERVER_PORT, UPDATE_INTERVAL_MS } from "../shared/config";
import { app } from "./app";
import { dataHealth } from "./health";
import { checkForUpdates } from "./updates";

serve({ fetch: app.fetch, port: SERVER_PORT }, ({ port }) => {
  console.log(`strategium server on http://localhost:${port}`);
});

const runCheck = () =>
  checkForUpdates().then((meta) => {
    if (meta.lastError) console.warn(`Update check failed: ${meta.lastError}`);
  });
// Then audit the data, if the last audit was of older data or an older compiler.
void runCheck().then(() => dataHealth());
setInterval(runCheck, UPDATE_INTERVAL_MS);
