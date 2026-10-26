// Fresh local database for UI tests, then the local-only dev server on port 3100.
import fs from "node:fs";
import { spawn } from "node:child_process";

const dir = "data/e2e-pgdata";
fs.rmSync(dir, { recursive: true, force: true });
const child = spawn("node", ["scripts/dev-local.mjs", "--port", "3100"], {
  env: { ...process.env, CARESIGNAL_PGLITE_DIR: dir, NEXT_DIST_DIR: ".next-e2e" },
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
