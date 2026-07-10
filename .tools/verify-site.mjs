import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = 4322;
const base = `http://127.0.0.1:${port}`;
const artifacts = join(root, "artifacts");
const server = spawn(process.execPath, [join(root, "node_modules", "astro", "astro.js"), "preview", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
server.stdout.on("data", (data) => (logs += data.toString()));
server.stderr.on("data", (data) => (logs += data.toString()));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start.\n${logs}`);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await waitForServer();
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  expect((await page.title()).includes("浅靥"), "Homepage title should include the site name.");
  expect(await page.locator("h1").count() === 1, "Homepage should expose exactly one H1.");
  expect(await page.locator(".skip-link").count() === 1, "Homepage should provide a skip link.");
  expect(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), "Homepage images should load.");
  await page.screenshot({ path: join(artifacts, "home-desktop.png"), fullPage: false });

  for (const path of ["/blog/", "/archive/", "/tags/", "/search/", "/about/", "/404.html", "/rss.xml", "/sitemap.xml"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    expect(response?.ok(), `${path} should return a successful response.`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/blog/browser-notes/`, { waitUntil: "networkidle" });
  expect(await page.locator("h1").count() === 1, "Article page should expose one H1 on mobile.");
  expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "Mobile article should not overflow horizontally.");
  await page.screenshot({ path: join(artifacts, "post-mobile.png"), fullPage: false });

  await browser.close();
  console.log(JSON.stringify({ ok: true, checks: ["desktop", "mobile", "routes", "RSS", "sitemap", "images"] }));
} finally {
  server.kill();
}
