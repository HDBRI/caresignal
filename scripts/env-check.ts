/** Prints which .env files were found and which keys are present — never the values. */
import { loadEnv } from "../src/lib/env";

const report = loadEnv();
console.log("CareSignal environment check (values are never printed)\n");
for (const f of report.filesChecked) console.log(`  ${f.found ? "found  " : "missing"}  ${f.path}`);
console.log("");
for (const [k, present] of Object.entries(report.keysPresent)) console.log(`  ${present ? "set    " : "not set"}  ${k}`);
const hosted = report.keysPresent.NEXT_PUBLIC_SUPABASE_URL && report.keysPresent.SUPABASE_SERVICE_ROLE_KEY;
console.log(`\nData backend: ${hosted ? "Supabase (hosted)" : "local SQLite fallback"}`);
console.log(`AI analysis: ${report.keysPresent.PORTKEY_API_KEY ? "configured" : "unavailable (no PORTKEY_API_KEY)"}`);
