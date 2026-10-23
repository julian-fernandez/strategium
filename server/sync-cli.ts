import { checkForUpdates } from "./updates";

const meta = await checkForUpdates();
console.log(JSON.stringify(meta, null, 2));
if (meta.lastError) process.exitCode = 1;
