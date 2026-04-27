import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const cache = path.join(webRoot, ".cypress-cache");

const env = {
  ...process.env,
  CYPRESS_CACHE_FOLDER: cache,
  CYPRESS_SKIP_VERIFY: "true",
};
delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync("npx", ["cypress", "run"], {
  cwd: webRoot,
  stdio: "inherit",
  env,
});
process.exit(result.status ?? 1);
