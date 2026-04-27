import cors from "cors";
import express from "express";
import { tenantMiddleware } from "./middleware/tenant.js";
import { activitiesRouter } from "./routes/activities.js";

function resolveCorsOrigins(): true | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return true;
  const origins = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: resolveCorsOrigins(),
    }),
  );
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/activities", tenantMiddleware, activitiesRouter);
  return app;
}
