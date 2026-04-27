import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cache = path.join(root, ".cypress-cache");
const env = {
  ...process.env,
  CYPRESS_CACHE_FOLDER: cache,
  CYPRESS_SKIP_VERIFY: "true",
};
delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync("npx", ["cypress", "install"], {
  cwd: root,
  stdio: "inherit",
  env,
});
process.exit(result.status ?? 1);
