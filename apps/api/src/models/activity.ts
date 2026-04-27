import type { CreateActivityInput } from "@dmacq/types";
import type { ObjectId } from "mongodb";

const MAX_METADATA_KEYS = 50;
const DISALLOWED_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    if (DISALLOWED_METADATA_KEYS.has(key)) {
      throw new Error(`metadata key is not allowed: ${key}`);
    }
    output[key] = value;
  }
  return output;
}

export function validateCreateBody(body: unknown): CreateActivityInput {
  if (!body || typeof body !== "object") {
    throw new Error("Body must be a JSON object");
  }
  const b = body as Record<string, unknown>;
  for (const key of ["actorId", "actorName", "type", "entityId"] as const) {
    const v = b[key];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`Invalid or missing string field: ${key}`);
    }
  }
  let metadata: Record<string, unknown> = {};
  if (b.metadata !== undefined) {
    if (typeof b.metadata !== "object" || b.metadata === null || Array.isArray(b.metadata)) {
      throw new Error("metadata must be a plain object");
    }
    metadata = sanitizeMetadata(b.metadata as Record<string, unknown>);
    if (Object.keys(metadata).length > MAX_METADATA_KEYS) {
      throw new Error(`metadata exceeds ${MAX_METADATA_KEYS} keys`);
    }
  }
  return {
    actorId: String(b.actorId).trim(),
    actorName: String(b.actorName).trim(),
    type: String(b.type).trim(),
    entityId: String(b.entityId).trim(),
    metadata,
  };
}

export const activityListProjection = {
  _id: 1,
  tenantId: 1,
  actorId: 1,
  actorName: 1,
  type: 1,
  entityId: 1,
  metadata: 1,
  createdAt: 1,
} as const;

export type ActivityDoc = {
  _id: ObjectId;
  tenantId: string;
  actorId: string;
  actorName: string;
  type: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export function serializeActivity(doc: ActivityDoc) {
  return {
    _id: doc._id.toHexString(),
    tenantId: doc.tenantId,
    actorId: doc.actorId,
    actorName: doc.actorName,
    type: doc.type,
    entityId: doc.entityId,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt.toISOString(),
  };
}
