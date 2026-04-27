import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(uri: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export async function ensureIndexes(database: Db): Promise<void> {
  await database.collection("activities").createIndex(
    { tenantId: 1, createdAt: -1 },
    { name: "tenantId_createdAt_desc" },
  );
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB not connected");
  return db;
}
