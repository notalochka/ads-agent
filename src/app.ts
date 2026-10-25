import cors from "cors";
import express from "express";
import { researchRouter } from "./routes/research.routes.js";
import { statusRouter } from "./routes/status.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  app.use(
    cors({
      origin: corsOrigin.split(",").map((s) => s.trim()),
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "ads-agent",
      adsSource: process.env.ADS_SOURCE ?? "mock",
      llmProvider: process.env.LLM_PROVIDER ?? "mock",
    });
  });

  app.use("/api/status", statusRouter);
  app.use("/api/research", researchRouter);

  app.use(errorHandler);

  return app;
}
