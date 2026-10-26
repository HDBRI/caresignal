/**
 * Prints report.html to a US-letter PDF with Chromium (the same engine as Chrome's "Print → Save as PDF")
 * and reports the page count. Output: docs/report/report-print-check.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const html = path.join(process.cwd(), "report.html");
const out = path.join(process.cwd(), "docs", "report", "report-print-check.pdf");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
await page.emulateMedia({ media: "print" });
await page.pdf({ path: out, format: "Letter", preferCSSPageSize: true, printBackground: true });
await browser.close();
const pages = (fs.readFileSync(out, "latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
console.log(JSON.stringify({ pdf: out, pages, brokenImages: broken }));
