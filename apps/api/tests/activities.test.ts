import path from "node:path";
import { mkdirSync } from "node:fs";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectMongo, disconnectMongo, ensureIndexes } from "../src/db.js";

describe("activities API", () => {
  let mongod: MongoMemoryServer | undefined;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const downloadDir = path.join(process.cwd(), ".mongo-binaries");
    mkdirSync(downloadDir, { recursive: true });
    process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    const db = await connectMongo(uri);
    await ensureIndexes(db);
    app = createApp();
  });

  afterAll(async () => {
    await disconnectMongo();
    if (mongod) await mongod.stop();
  });

  it("rejects POST without tenant header", async () => {
    const res = await request(app).post("/activities").send({
      actorId: "a",
      actorName: "A",
      type: "comment",
      entityId: "e1",
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid tenant header format", async () => {
    const res = await request(app)
      .post("/activities")
      .set("X-Tenant-Id", "tenant with spaces")
      .send({
        actorId: "a",
        actorName: "A",
        type: "comment",
        entityId: "e1",
      });
    expect(res.status).toBe(400);
  });

  it("rejects POST with invalid body", async () => {
    const res = await request(app)
      .post("/activities")
      .set("X-Tenant-Id", "t1")
      .send({ actorId: "a" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("creates an activity and returns 201", async () => {
    const res = await request(app)
      .post("/activities")
      .set("X-Tenant-Id", "t1")
      .send({
        actorId: "u1",
        actorName: "User One",
        type: "comment",
        entityId: "doc-1",
        metadata: { text: "hello" },
      });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe("t1");
    expect(res.body.actorId).toBe("u1");
    expect(res.body.type).toBe("comment");
    expect(res.body.createdAt).toBeDefined();
    expect(res.body._id).toBeDefined();
  });

  it("rejects dangerous metadata keys", async () => {
    const res = await request(app)
      .post("/activities")
      .set("X-Tenant-Id", "t1")
      .send({
        actorId: "u1",
        actorName: "User One",
        type: "comment",
        entityId: "doc-1",
        metadata: { constructor: "bad-key" },
      });
    expect(res.status).toBe(400);
  });

  it("isolates tenants on GET", async () => {
    await request(app)
      .post("/activities")
      .set("X-Tenant-Id", "tenant-a")
      .send({
        actorId: "1",
        actorName: "A",
        type: "create",
        entityId: "x",
      });
    await request(app)
      .post("/activities")
      .set("X-Tenant-Id", "tenant-b")
      .send({
        actorId: "2",
        actorName: "B",
        type: "update",
        entityId: "y",
      });

    const a = await request(app).get("/activities").set("X-Tenant-Id", "tenant-a");
    const b = await request(app).get("/activities").set("X-Tenant-Id", "tenant-b");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.items.every((i: { tenantId: string }) => i.tenantId === "tenant-a")).toBe(true);
    expect(b.body.items.every((i: { tenantId: string }) => i.tenantId === "tenant-b")).toBe(true);
    expect(a.body.items.some((i: { actorName: string }) => i.actorName === "B")).toBe(false);
  });

  it("paginates with cursor and returns newest first", async () => {
    const tenant = "paged-tenant";
    await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        request(app)
          .post("/activities")
          .set("X-Tenant-Id", tenant)
          .send({
            actorId: "u",
            actorName: "User",
            type: "comment",
            entityId: `e-${i}`,
          }),
      ),
    );
    const first = await request(app).get("/activities?limit=2").set("X-Tenant-Id", tenant);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.hasMore).toBe(true);
    const c1 = new Date(first.body.items[0].createdAt).getTime();
    const c2 = new Date(first.body.items[1].createdAt).getTime();
    expect(c1).toBeGreaterThanOrEqual(c2);

    const second = await request(app)
      .get(`/activities?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set("X-Tenant-Id", tenant);
    expect(second.status).toBe(200);
    expect(second.body.items.length).toBeGreaterThanOrEqual(1);
    const seen = new Set<string>();
    for (const it of [...first.body.items, ...second.body.items]) {
      expect(seen.has(it._id)).toBe(false);
      seen.add(it._id);
    }
  });

  it("rejects invalid cursor", async () => {
    const res = await request(app)
      .get("/activities?cursor=not-a-date")
      .set("X-Tenant-Id", "t1");
    expect(res.status).toBe(400);
  });
});
