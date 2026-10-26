// Runs CareSignal against the LOCAL database (PGlite) even when .env contains Supabase settings,
// so development and UI tests never write to the live hosted database.
// Usage: npm run dev:local [-- --port 3001]
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  CARESIGNAL_PGLITE_DIR: process.env.CARESIGNAL_PGLITE_DIR || "data/pgdata",
};
const args = ["next", "dev", ...process.argv.slice(2)];
const child = spawn("npx", args, { env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
