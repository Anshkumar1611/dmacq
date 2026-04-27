import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { connectMongo, disconnectMongo, ensureIndexes } from "./db.js";
import { createApp } from "./app.js";

const rootEnv = join(dirname(fileURLToPath(import.meta.url)), "../../../.env");
if (existsSync(rootEnv)) {
  loadEnvFile(rootEnv);
}

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/dmacq-activities";
const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

async function main(): Promise<void> {
  const db = await connectMongo(MONGODB_URI);
  await ensureIndexes(db);
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

main().catch(async (err) => {
  console.error(err);
  await disconnectMongo();
  process.exit(1);
});
