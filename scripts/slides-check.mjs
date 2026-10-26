/**
 * Opens slides.html from disk with ALL network requests blocked (proves it is self-contained), counts slides with
 * Reveal's own API, checks every slide fits 1280×720, and saves a screenshot per slide to docs/report/slides-check/.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const out = path.join(process.cwd(), "docs", "report", "slides-check");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const blocked = [];
await page.route("**/*", (route) => {
  if (route.request().url().startsWith("file:") || route.request().url().startsWith("data:")) return route.continue();
  blocked.push(route.request().url());
  return route.abort();
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.join(process.cwd(), "slides.html")).href);
await page.waitForFunction(() => window.Reveal && window.Reveal.isReady());
const total = await page.evaluate(() => window.Reveal.getTotalSlides());
const overflow = [];
for (let i = 0; i < total; i++) {
  await page.evaluate((n) => window.Reveal.slide(n), i);
  await page.waitForTimeout(1200);
  const o = await page.evaluate(() => {
    const s = window.Reveal.getCurrentSlide();
    return { scroll: s.scrollHeight, height: s.clientHeight, title: s.querySelector("h1,h2")?.textContent?.trim() };
  });
  if (o.scroll > o.height + 2) overflow.push({ slide: i + 1, ...o });
  await page.screenshot({ path: path.join(out, `slide-${String(i + 1).padStart(2, "0")}.png`) });
}
const brokenImages = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
await browser.close();
console.log(JSON.stringify({ slides: total, blockedNetworkRequests: blocked, brokenImages, overflow, errors }, null, 1));
