import { Router, type Request, type Response } from "express";
import { getDb } from "../db.js";
import {
  activityListProjection,
  serializeActivity,
  validateCreateBody,
  type ActivityDoc,
} from "../models/activity.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const activitiesRouter = Router();

activitiesRouter.post("/", async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  let input;
  try {
    input = validateCreateBody(req.body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid body";
    res.status(400).json({ error: message });
    return;
  }

  const createdAt = new Date();
  const doc = {
    tenantId,
    actorId: input.actorId,
    actorName: input.actorName,
    type: input.type,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
    createdAt,
  };

  const result = await getDb().collection("activities").insertOne(doc);
  const inserted = { ...doc, _id: result.insertedId };
  res.status(201).json(serializeActivity(inserted));
});

activitiesRouter.get("/", async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const limitParam = req.query.limit;
  let limit = DEFAULT_LIMIT;
  if (limitParam !== undefined) {
    const n = Number(limitParam);
    if (!Number.isFinite(n) || n < 1) {
      res.status(400).json({ error: "limit must be a positive number" });
      return;
    }
    limit = Math.min(Math.floor(n), MAX_LIMIT);
  }

  const cursorRaw = req.query.cursor;
  let beforeDate: Date | null = null;
  if (cursorRaw !== undefined) {
    if (typeof cursorRaw !== "string" || !cursorRaw.trim()) {
      res.status(400).json({ error: "cursor must be a non-empty ISO date string" });
      return;
    }
    const d = new Date(cursorRaw);
    if (Number.isNaN(d.getTime())) {
      res.status(400).json({ error: "cursor must be a valid ISO 8601 date" });
      return;
    }
    beforeDate = d;
  }

  const filter: Record<string, unknown> = { tenantId };
  if (beforeDate) {
    filter.createdAt = { $lt: beforeDate };
  }

  const fetchLimit = limit + 1;
  const cursor = getDb()
    .collection("activities")
    .find(filter, {
      projection: activityListProjection,
      sort: { createdAt: -1, _id: -1 },
      limit: fetchLimit,
    });

  const rows = await cursor.toArray();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

  res.json({
    items: page.map((doc) => serializeActivity(doc as ActivityDoc)),
    nextCursor,
    hasMore,
  });
});
