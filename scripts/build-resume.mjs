// Renders resume/resume.html to docs/Vincent_Lam_Resume.pdf (one Letter page).
//
//   node scripts/build-resume.mjs
//
// The resume is set in Carlito (open-licensed, metric-compatible with Calibri). The
// font files are downloaded into resume/fonts/ on first run and are not committed.
// Needs Playwright's Chromium (npx playwright install chromium).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = path.join(root, "resume", "fonts");
mkdirSync(fontDir, { recursive: true });
for (const style of ["Regular", "Bold", "Italic", "BoldItalic"]) {
  const file = path.join(fontDir, `Carlito-${style}.ttf`);
  if (existsSync(file)) continue;
  const res = await fetch(`https://github.com/googlefonts/carlito/raw/main/fonts/ttf/Carlito-${style}.ttf`);
  if (!res.ok) throw new Error(`Couldn't download Carlito-${style}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(root, "resume", "resume.html")).href);
await page.evaluate(() => document.fonts.ready);
const pdf = path.join(root, "docs", "Vincent_Lam_Resume.pdf");
await page.pdf({ path: pdf, format: "Letter", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`wrote ${pdf}`);
