import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { router } from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
