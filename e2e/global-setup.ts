/**
 * Dev servers compile each route on first request, which can take longer than a test's navigation.
 * Warm the main routes once so the first test run is as reliable as later ones.
 */
export default async function globalSetup() {
  const base = "http://localhost:3100";
  for (const path of ["/api/health", "/", "/demo", "/sign-in", "/register", "/terms", "/privacy", "/cases"]) {
    await fetch(base + path, { redirect: "manual" }).catch(() => undefined);
  }
}
