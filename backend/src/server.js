import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { getClient } from "./blockchain/client.js";
import { startEventMonitor } from "./services/eventMonitor.js";

const app = createApp();

const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(`Product authentication API listening on http://127.0.0.1:${config.port}`);
});

const stopMonitor = startEventMonitor(getClient());

function shutdown() {
  stopMonitor();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
