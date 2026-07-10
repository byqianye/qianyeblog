import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = await mkdtemp(join(tmpdir(), "qianyeblog-admin-"));
const port = 4330;
const base = `http://127.0.0.1:${port}`;
const username = "smoke-admin";
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(password, salt, 310000, 64, "sha512").toString("hex");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  return { response, text };
}

await Promise.all([
  cp(join(root, "src"), join(workspace, "src"), { recursive: true }),
  cp(join(root, "public"), join(workspace, "public"), { recursive: true }),
  cp(join(root, "server"), join(workspace, "server"), { recursive: true }),
  cp(join(root, "astro.config.mjs"), join(workspace, "astro.config.mjs")),
  cp(join(root, "tsconfig.json"), join(workspace, "tsconfig.json"))
]);
await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "junction");

const server = spawn(process.execPath, [join(root, "server", "admin-server.mjs")], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    PROJECT_ROOT: workspace,
    ADMIN_USERNAME: username,
    ADMIN_PASSWORD_HASH: `${salt}:310000:sha512:${hash}`,
    ASTRO_TELEMETRY_DISABLED: "1"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
server.stdout.on("data", (data) => (logs += data.toString()));
server.stderr.on("data", (data) => (logs += data.toString()));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${base}/admin/login`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Admin server did not start.\n${logs}`);
}

try {
  await waitForServer();
  expect((await request("/api/register", { method: "POST" })).response.status === 401, "There must be no public registration endpoint.");
  expect((await request("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "wrong-password" }) })).response.status === 401, "An incorrect password must fail.");

  const login = await request("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  expect(login.response.ok, "Configured local administrator should log in.");
  const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
  expect(cookie, "Login should set a session cookie.");

  const imageBytes = await readFile(join(workspace, "public", "images", "covers", "morning-notes.png"));
  const form = new FormData();
  form.append("image", new Blob([imageBytes], { type: "image/png" }), "smoke-cover.png");
  const upload = await fetch(`${base}/api/upload`, { method: "POST", headers: { cookie }, body: form });
  const uploaded = await upload.json();
  expect(upload.ok && uploaded.path?.endsWith(".webp"), "Uploads should be normalized to WebP.");
  expect((await request(uploaded.path.replace(/\.webp$/, "-640.webp"))).response.ok, "Uploads should expose a compact WebP variant.");

  const slug = `smoke-${Date.now()}`;
  const payload = { slug, title: "Smoke test post", description: "Temporary test content.", pubDate: "2026-06-03", tags: ["test"], cover: uploaded.path, draft: false, content: "Temporary test content." };
  const create = await request("/api/posts", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(payload) });
  expect(create.response.status === 201, `Authorized administrator should create a post in the isolated workspace. ${create.text}\n${logs}`);
  const visitor = await request(`/blog/${slug}/`);
  expect(visitor.response.ok && visitor.text.includes(payload.title), "Rebuild should expose the new isolated post to visitors.");
  expect((await request(`/api/posts/${slug}`, { method: "DELETE", headers: { cookie } })).response.ok, "Authorized administrator should delete the isolated post.");
  console.log(JSON.stringify({ ok: true, checks: ["local credentials", "no registration", "WebP upload", "isolated content rebuild"] }));
} finally {
  server.kill();
  await rm(workspace, { recursive: true, force: true });
}
