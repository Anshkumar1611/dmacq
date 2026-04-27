export type ActivityType =
  | "create"
  | "update"
  | "delete"
  | "comment"
  | "assign"
  | string;

export interface Activity {
  _id: string;
  tenantId: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateActivityInput {
  actorId: string;
  actorName: string;
  type: ActivityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface ActivitiesPage {
  items: Activity[];
  nextCursor: string | null;
  hasMore: boolean;
}
