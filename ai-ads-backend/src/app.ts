import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { rateLimitGenerations } from "./middleware/rate-limit";
import { accountRouter } from "./routes/account";
import { adminRouter } from "./routes/admin";
import { foldersRouter } from "./routes/folders";
import { healthRouter } from "./routes/health";
import { jobsRouter } from "./routes/jobs";
import { notificationsRouter } from "./routes/notifications";
import { productsRouter } from "./routes/products";
import { projectsRouter } from "./routes/projects";
import { storyboardsRouter } from "./routes/storyboards";
import { templatesRouter } from "./routes/templates";
import { transcribeRouter } from "./routes/transcribe";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl }));
  // Mounted before the global JSON parser: it takes recorded audio, larger than the default limit.
  app.use("/api/transcribe", requireAuth, transcribeRouter);
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/api/account", requireAuth, accountRouter);
  app.use("/api/admin", requireAuth, requireAdmin, adminRouter);
  app.use("/api/folders", requireAuth, foldersRouter);
  app.use("/api/products", requireAuth, productsRouter);
  app.use("/api/projects", requireAuth, projectsRouter);
  app.use("/api/jobs", requireAuth, rateLimitGenerations, jobsRouter);
  app.use("/api/notifications", requireAuth, notificationsRouter);
  app.use("/api/storyboards", requireAuth, rateLimitGenerations, storyboardsRouter);
  app.use("/api/templates", requireAuth, templatesRouter);

  return app;
}
