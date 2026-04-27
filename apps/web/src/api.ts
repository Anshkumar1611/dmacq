import type { ActivitiesPage, Activity, CreateActivityInput } from "@dmacq/types";

const base = () => (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function fetchActivitiesPage(
  tenantId: string,
  cursor: string | null,
  limit = 20,
): Promise<ActivitiesPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`${base()}/activities?${params}`, {
    headers: { "X-Tenant-Id": tenantId },
  });
  if (!res.ok) throw new Error(`GET /activities failed: ${res.status}`);
  return parseJson<ActivitiesPage>(res);
}

export async function createActivity(
  tenantId: string,
  body: CreateActivityInput,
): Promise<Activity> {
  const res = await fetch(`${base()}/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": tenantId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `POST failed: ${res.status}`);
  }
  return parseJson<Activity>(res);
}
