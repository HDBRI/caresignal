// Runs ONLY the live AI smoke test (real gpt-6-luna calls, synthetic data). Never prints the key.
import { spawn } from "node:child_process";
const child = spawn("npx", ["vitest", "run", "tests/live", "--silent=false"], {
  env: { ...process.env, CARESIGNAL_LIVE_AI: "1" },
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
