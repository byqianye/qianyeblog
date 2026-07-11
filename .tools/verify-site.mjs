import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = 4322;
const base = `http://127.0.0.1:${port}`;
const artifacts = join(root, "artifacts");
const server = spawn(process.execPath, [join(root, "node_modules", "astro", "astro.js"), "preview", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
server.stdout.on("data", (data) => (logs += data));
server.stderr.on("data", (data) => (logs += data));

const expect = (value, message) => { if (!value) throw new Error(message); };
async function ready() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(logs);
}

try {
  await ready();
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const viewports = [{ name: "desktop", width: 1440, height: 1000 }, { name: "tablet", width: 768, height: 900 }, { name: "mobile", width: 390, height: 844 }];
  const visualRoutes = ["/", "/blog/", "/archive/", "/tags/", "/tags/%E5%B7%A5%E5%85%B7/", "/search/", "/about/", "/404.html", "/blog/browser-notes/"];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of visualRoutes) {
      const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      expect(response?.ok(), `${viewport.name} ${path} failed`);
      expect(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${viewport.name} ${path} overflows`);
      expect(await page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0 && image.hasAttribute("width") && image.hasAttribute("height"))), `${viewport.name} ${path} has unstable images`);
      if (path === "/blog/browser-notes/") await page.screenshot({ path: join(artifacts, `entry-${viewport.name}.png`), fullPage: true });
      if (path === "/404.html" && viewport.name !== "tablet") await page.screenshot({ path: join(artifacts, `404-${viewport.name}.png`), fullPage: true });
    }
    await page.goto(base, { waitUntil: "networkidle" });
    expect((await page.title()).includes("浅靥"), "Homepage title must include site name");
    expect(await page.locator("h1").count() === 1, "Homepage must have one H1");
    await page.keyboard.press("Tab");
    expect(await page.locator(".skip-link").evaluate((link) => link === document.activeElement), "Skip link must be the first keyboard target");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === "auto"), "Reduced motion must disable smooth scrolling");
    expect(await page.locator("canvas.particle-field").count() === 1, "Every page must expose exactly one particle field");
    expect(await page.locator("canvas.particle-field").evaluate((canvas) => canvas.getAttribute("aria-hidden") === "true" && getComputedStyle(canvas).pointerEvents === "none"), "Particle field must remain decorative");
    const canvasState = await page.locator("canvas.particle-field").evaluate((canvas) => ({ motion: canvas.dataset.motion, particles: Number(canvas.dataset.particles), dpr: Number(canvas.dataset.dpr), width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height }));
    expect(canvasState.motion === "static", "Reduced motion must keep the particle field static");
    expect(canvasState.particles <= (viewport.name === "mobile" ? 42 : 96), "Particle count must stay within its viewport budget");
    expect(canvasState.dpr <= 1.5 && canvasState.width >= viewport.width && canvasState.height >= viewport.height, "Particle field must cap DPR and cover the viewport");
    const staticBefore = await page.locator("canvas.particle-field").evaluate((canvas) => canvas.toDataURL());
    await page.waitForTimeout(80);
    const staticAfter = await page.locator("canvas.particle-field").evaluate((canvas) => canvas.toDataURL());
    expect(staticBefore === staticAfter, "Reduced-motion particle frame must not change");
    if (viewport.name === "mobile") {
      await page.locator(".mobile-nav summary").click();
      expect(await page.locator(".mobile-nav nav").isVisible(), "Mobile navigation must open");
      const targets = await page.locator("button, summary").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      expect(targets.every((height) => height >= 40), "Mobile controls must have 40px touch targets");
      const linkTargets = await page.locator(".hero-actions a, .entry-footer a").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      expect(linkTargets.every((height) => height >= 40), "Primary mobile links must have 40px touch targets");
      await page.locator(".mobile-nav summary").click();
    }
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.screenshot({ path: join(artifacts, `home-${viewport.name}.png`), fullPage: true });
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/blog/browser-notes/`, { waitUntil: "networkidle" });
  expect(await page.locator(".post-aside nav a").count() >= 2, "Desktop article must expose its table of contents");
  const cover = await page.locator(".post-cover img").boundingBox();
  expect(cover && Math.abs(cover.width / cover.height - 16 / 9) < 0.05, "Article cover must remain 16:9");
  await page.goto(`${base}/blog/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /资源/ }).click();
  expect(await page.locator(".entry:not([hidden])").count() === 2, "Resource filter must show both migrated entries");
  expect(await page.getByRole("button", { name: /资源/ }).getAttribute("aria-pressed") === "true", "Active garden filter must expose aria-pressed");
  await page.goto(`${base}/search/`, { waitUntil: "networkidle" });
  await page.locator("#search").fill("浏览器");
  expect(await page.locator(".results article").count() === 1, "Search should find the browser resource");

  for (const path of ["/404.html", "/rss.xml", "/sitemap.xml", "/search.json", "/admin/"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    expect(response?.ok(), `${path} failed`);
  }
  const search = await (await fetch(`${base}/search.json`)).json();
  expect(search.every((item) => item.title && item.description && item.url && item.kind && Array.isArray(item.tags)), "Search contract is incomplete");

  const motionPage = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  await motionPage.emulateMedia({ reducedMotion: "no-preference" });
  await motionPage.goto(base, { waitUntil: "networkidle" });
  const canvasBefore = await motionPage.locator("canvas.particle-field").evaluate((canvas) => canvas.toDataURL());
  await motionPage.mouse.move(700, 350);
  await motionPage.waitForTimeout(120);
  const canvasAfter = await motionPage.locator("canvas.particle-field").evaluate((canvas) => canvas.toDataURL());
  expect(canvasBefore !== canvasAfter, "Homepage particle field must animate when motion is allowed");
  expect(await motionPage.locator("canvas.particle-field").getAttribute("data-motion") === "running", "Homepage particle state must report running");
  expect(await motionPage.locator("canvas.particle-field").getAttribute("data-pointer") === "active", "Homepage particle field must respond to pointer movement");
  await motionPage.screenshot({ path: join(artifacts, "home-motion-desktop.png"), fullPage: false });
  await motionPage.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  expect(await motionPage.locator("canvas.particle-field").getAttribute("data-motion") === "paused", "Hidden page must pause the particle field");
  await motionPage.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  expect(await motionPage.locator("canvas.particle-field").getAttribute("data-motion") === "running", "Visible homepage must resume the particle field");
  await motionPage.goto(`${base}/about/`, { waitUntil: "networkidle" });
  const ambientBefore = await motionPage.locator("canvas.particle-field").evaluate((canvas) => canvas.toDataURL());
  await motionPage.waitForTimeout(80);
  const ambientAfter = await motionPage.locator("canvas.particle-field").evaluate((canvas) => canvas.toDataURL());
  expect(ambientBefore === ambientAfter && await motionPage.locator("canvas.particle-field").getAttribute("data-motion") === "static", "Non-home particle field must remain ambient and static");
  await motionPage.close();
  await browser.close();
  console.log(JSON.stringify({ ok: true, checks: ["1440", "768", "390", "Canvas motion", "keyboard", "touch", "reduced-motion", "filters", "search", "TOC", "16:9 media", "legacy slugs", "CMS", "RSS", "sitemap"] }));
} finally {
  server.kill();
}
