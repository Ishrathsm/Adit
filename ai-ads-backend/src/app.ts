import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { healthRouter } from "./routes/health";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());

  app.use("/health", healthRouter);

  return app;
}
