import { createServer } from "node:http";
import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, stat, unlink, rename, copyFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(root, "dist");
const publicDir = join(root, "public");
const contentDir = join(root, "src", "content", "blog");
const homeFile = join(root, "src", "data", "home.json");
const siteFile = join(root, "src", "data", "site.json");
const adminFile = join(root, "server", "admin.json");
const uploadDir = join(publicDir, "images", "uploads");
const sessions = new Map();
const PORT = Number(process.env.PORT || 4321);
const homeFieldsToRemove = [
  "siteTitle",
  "siteAuthor",
  "siteDescription",
  "siteUrl",
  "siteEmail",
  "brandMark",
  "favicon",
  "navHomeLabel",
  "navBlogLabel",
  "navTagsLabel",
  "navSearchLabel",
  "navAboutLabel",
  "socialEmailLabel",
  "socialRssLabel",
  "hitokotoApi",
  "poemApi",
  "quoteLoadingTitle",
  "quoteLoadingDescription",
  "quoteLoadingSource",
  "quoteFallbackSource"
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function send(res, status, body, type = "text/plain; charset=utf-8", headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { "content-type": type, "content-length": payload.length, ...headers });
  res.end(payload);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function getSession(req) {
  const id = parseCookies(req).admin_session;
  if (!id) return null;
  const session = sessions.get(id);
  if (!session || session.expires < Date.now()) {
    sessions.delete(id);
    return null;
  }
  session.expires = Date.now() + 1000 * 60 * 60 * 8;
  return session;
}

function requireAdmin(req, res) {
  const session = getSession(req);
  if (session) return true;
  if (req.url.startsWith("/api/")) {
    json(res, 401, { error: "请先登录后台。" });
  } else {
    redirect(res, "/admin/login");
  }
  return false;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function siteToForm(site) {
  return {
    siteTitle: site.title,
    siteAuthor: site.author,
    siteDescription: site.description,
    siteUrl: site.url,
    siteEmail: site.email,
    brandMark: site.brandMark,
    favicon: site.favicon,
    navHomeLabel: site.navHomeLabel,
    navBlogLabel: site.navBlogLabel,
    navTagsLabel: site.navTagsLabel,
    navSearchLabel: site.navSearchLabel,
    navAboutLabel: site.navAboutLabel,
    socialEmailLabel: site.socialEmailLabel,
    socialRssLabel: site.socialRssLabel
  };
}

function formToSite(body, existing) {
  return {
    ...existing,
    title: body.siteTitle ?? existing.title,
    author: body.siteAuthor ?? existing.author,
    description: body.siteDescription ?? existing.description,
    url: body.siteUrl ?? existing.url,
    email: body.siteEmail ?? existing.email,
    brandMark: body.brandMark ?? existing.brandMark,
    favicon: body.favicon ?? existing.favicon,
    navHomeLabel: body.navHomeLabel ?? existing.navHomeLabel,
    navBlogLabel: body.navBlogLabel ?? existing.navBlogLabel,
    navTagsLabel: body.navTagsLabel ?? existing.navTagsLabel,
    navSearchLabel: body.navSearchLabel ?? existing.navSearchLabel,
    navAboutLabel: body.navAboutLabel ?? existing.navAboutLabel,
    socialEmailLabel: body.socialEmailLabel ?? existing.socialEmailLabel,
    socialRssLabel: body.socialRssLabel ?? existing.socialRssLabel
  };
}

function formToHome(body) {
  const home = { ...body };
  cleanHomeFields(home);
  return home;
}

function cleanHomeFields(home) {
  for (const key of homeFieldsToRemove) delete home[key];
  return home;
}

async function readRequest(req, limit = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("请求体过大。");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const raw = await readRequest(req, 2 * 1024 * 1024);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

function safeSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function escapeYaml(value) {
  return JSON.stringify(String(value ?? ""));
}

function normalizeTags(value) {
  const tags = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,，]/);
  return Array.from(new Set(tags.map((tag) => String(tag).trim()).filter(Boolean)));
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: source };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      data[key] = JSON.parse(raw);
    } else if (raw === "true" || raw === "false") {
      data[key] = raw === "true";
    } else {
      data[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
  return { data, content: match[2].trim() };
}

function toMarkdown(post) {
  const tags = normalizeTags(post.tags);
  return `---\n` +
    `title: ${escapeYaml(post.title)}\n` +
    `description: ${escapeYaml(post.description)}\n` +
    `pubDate: ${escapeYaml(post.pubDate)}\n` +
    `tags: ${JSON.stringify(tags)}\n` +
    `cover: ${escapeYaml(post.cover)}\n` +
    `draft: ${post.draft ? "true" : "false"}\n` +
    `---\n\n` +
    `${String(post.content || "").trim()}\n`;
}

async function listPosts() {
  await mkdir(contentDir, { recursive: true });
  const files = (await readdir(contentDir)).filter((file) => file.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const { data, content } = parseFrontmatter(await readFile(join(contentDir, file), "utf8"));
    posts.push({ slug, ...data, content });
  }
  return posts.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
}

async function findPost(slug) {
  const file = join(contentDir, `${safeSlug(slug)}.md`);
  if (!existsSync(file)) return null;
  const { data, content } = parseFrontmatter(await readFile(file, "utf8"));
  return { slug: safeSlug(slug), ...data, content };
}

async function savePost(post, oldSlug) {
  const slug = safeSlug(post.slug || post.title);
  if (!slug) throw new Error("文章 slug 不能为空，只能使用英文、数字和连字符。");
  await mkdir(contentDir, { recursive: true });
  const nextPath = join(contentDir, `${slug}.md`);
  const previousSlug = oldSlug ? safeSlug(oldSlug) : slug;
  const previousPath = join(contentDir, `${previousSlug}.md`);
  await writeFile(nextPath, toMarkdown({ ...post, slug }), "utf8");
  if (previousSlug !== slug && existsSync(previousPath)) {
    await unlink(previousPath);
  }
  return slug;
}

async function deletePost(slug) {
  const file = join(contentDir, `${safeSlug(slug)}.md`);
  if (!existsSync(file)) return false;
  await unlink(file);
  return true;
}

async function renameTag(oldTag, newTag) {
  const from = String(oldTag || "").trim();
  const to = String(newTag || "").trim();
  if (!from) throw new Error("原标签不能为空。");
  if (!to) throw new Error("新标签不能为空。");
  if (from === to) return 0;

  const posts = await listPosts();
  let changed = 0;
  for (const post of posts) {
    const tags = normalizeTags(post.tags);
    if (!tags.includes(from)) continue;
    const nextTags = normalizeTags(tags.map((tag) => (tag === from ? to : tag)));
    await savePost({ ...post, tags: nextTags }, post.slug);
    changed += 1;
  }
  return changed;
}

async function deleteTag(tagName) {
  const target = String(tagName || "").trim();
  if (!target) throw new Error("标签不能为空。");

  const posts = await listPosts();
  let changed = 0;
  for (const post of posts) {
    const tags = normalizeTags(post.tags);
    if (!tags.includes(target)) continue;
    const nextTags = tags.filter((tag) => tag !== target);
    await savePost({ ...post, tags: nextTags }, post.slug);
    changed += 1;
  }
  return changed;
}

async function listImages() {
  const roots = [join(publicDir, "images", "covers"), uploadDir];
  const images = [];

  async function walk(dir) {
    if (!existsSync(dir)) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!entry.isFile() || !imageExtensions.has(extname(entry.name).toLowerCase())) continue;
      const info = await stat(file);
      const path = `/${relative(publicDir, file).split("\\").join("/")}`;
      images.push({ path, name: entry.name, size: info.size });
    }
  }

  for (const dir of roots) await walk(dir);
  return images.sort((a, b) => a.path.localeCompare(b.path, "zh-Hans-CN"));
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new Error("缺少 multipart boundary。");
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(marker);
  while (cursor !== -1) {
    cursor += marker.length;
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;
    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;
    const header = buffer.slice(cursor, headerEnd).toString("utf8");
    let next = buffer.indexOf(marker, headerEnd + 4);
    if (next === -1) break;
    let body = buffer.slice(headerEnd + 4, next);
    if (body.at(-2) === 13 && body.at(-1) === 10) body = body.slice(0, -2);
    parts.push({ header, body });
    cursor = next;
  }

  const fields = {};
  const files = {};
  for (const part of parts) {
    const name = part.header.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    const filename = part.header.match(/filename="([^"]*)"/)?.[1];
    const type = part.header.match(/content-type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
    if (filename) {
      files[name] = { filename, type, buffer: part.body };
    } else {
      fields[name] = part.body.toString("utf8");
    }
  }
  return { fields, files };
}

async function saveUpload(req) {
  const buffer = await readRequest(req);
  const { files } = parseMultipart(buffer, req.headers["content-type"] || "");
  const file = files.image;
  if (!file || !file.buffer.length) throw new Error("没有选择图片。");
  if (!file.type.startsWith("image/")) throw new Error("只能上传图片文件。");
  await mkdir(uploadDir, { recursive: true });
  const ext = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extname(file.filename).toLowerCase())
    ? extname(file.filename).toLowerCase()
    : ".png";
  const base = safeSlug(file.filename.replace(/\.[^.]+$/, "")) || "image";
  const name = `${Date.now()}-${base}${ext}`;
  await writeFile(join(uploadDir, name), file.buffer);
  return `/images/uploads/${name}`;
}

async function rebuildSite() {
  const astroEntry = join(root, "node_modules", "astro", "astro.js");
  const env = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: "1",
    XDG_CONFIG_HOME: join(root, ".config")
  };
  return new Promise((resolveBuild, rejectBuild) => {
    execFile(process.execPath, [astroEntry, "build"], { cwd: root, env, windowsHide: true }, (error, stdout, stderr) => {
      if (error) rejectBuild(new Error(stderr || stdout || error.message));
      else resolveBuild({ stdout, stderr });
    });
  });
}

function verifyPassword(password, admin) {
  const hash = pbkdf2Sync(password, admin.salt, admin.iterations, Buffer.from(admin.hash, "hex").length, admin.digest);
  const expected = Buffer.from(admin.hash, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

async function handleLogin(req, res) {
  const { username, password } = await readJsonBody(req);
  const admin = await readJson(adminFile);
  if (username !== admin.username || !verifyPassword(password || "", admin)) {
    json(res, 401, { error: "账号或密码不正确。" });
    return;
  }
  const sessionId = randomBytes(32).toString("hex");
  sessions.set(sessionId, { username, expires: Date.now() + 1000 * 60 * 60 * 8 });
  send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8", {
    "set-cookie": `admin_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`
  });
}

async function serveFile(res, requestedPath) {
  const pathname = decodeURIComponent(new URL(requestedPath, "http://local").pathname);
  const candidates = [];
  const clean = normalize(pathname).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  const distPath = join(distDir, clean);
  candidates.push(pathname.endsWith("/") ? join(distPath, "index.html") : distPath);
  if (!extname(pathname)) candidates.push(join(distPath, "index.html"));
  candidates.push(join(publicDir, clean));
  candidates.push(join(root, clean));

  for (const candidate of candidates) {
    if (relative(root, candidate).startsWith("..")) continue;
    try {
      const info = await stat(candidate);
      if (!info.isFile()) continue;
      res.writeHead(200, { "content-type": mimeTypes[extname(candidate).toLowerCase()] || "application/octet-stream" });
      createReadStream(candidate).pipe(res);
      return true;
    } catch {}
  }
  return false;
}

function adminLoginPage() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>后台登录</title><link rel="stylesheet" href="/admin/admin.css"></head><body class="admin-auth"><main class="login-panel"><p class="eyebrow">Admin</p><h1>登录博客后台</h1><p>此后台只有预设管理员账号，没有注册入口。</p><form id="login-form"><label>账号<input name="username" autocomplete="username" required value="admin"></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">登录</button><output id="login-message"></output></form></main><script>document.querySelector("#login-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const r=await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});if(r.ok) location.href="/admin/"; else document.querySelector("#login-message").textContent=(await r.json()).error||"登录失败";});</script></body></html>`;
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/admin/login") return send(res, 200, adminLoginPage(), "text/html; charset=utf-8");
    if (url.pathname === "/api/login" && req.method === "POST") return handleLogin(req, res);
    if (url.pathname === "/api/logout" && req.method === "POST") {
      const id = parseCookies(req).admin_session;
      if (id) sessions.delete(id);
      return send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8", {
        "set-cookie": "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
      });
    }

    if (url.pathname.startsWith("/admin")) {
      if (url.pathname === "/admin/admin.css") return serveFile(res, "/server/admin.css");
      if (url.pathname === "/admin/admin.js") return serveFile(res, "/server/admin.js");
      if (!requireAdmin(req, res)) return;
      if (url.pathname === "/admin" || url.pathname === "/admin/") return serveFile(res, "/server/admin.html");
    }

    if (url.pathname.startsWith("/api/")) {
      if (!requireAdmin(req, res)) return;
      if (url.pathname === "/api/me") return json(res, 200, { username: getSession(req).username });
      if (url.pathname === "/api/site" && req.method === "GET") {
        const [home, site] = await Promise.all([readJson(homeFile), readJson(siteFile)]);
        return json(res, 200, { ...home, ...siteToForm(site) });
      }
      if (url.pathname === "/api/site" && req.method === "PUT") {
        const body = await readJsonBody(req);
        const [existingHome, existingSite] = await Promise.all([readJson(homeFile), readJson(siteFile)]);
        const nextHome = cleanHomeFields({ ...existingHome, ...formToHome(body) });
        const nextSite = formToSite(body, existingSite);
        await Promise.all([
          writeFile(homeFile, JSON.stringify(nextHome, null, 2) + "\n", "utf8"),
          writeFile(siteFile, JSON.stringify(nextSite, null, 2) + "\n", "utf8")
        ]);
        await rebuildSite();
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/posts" && req.method === "GET") return json(res, 200, await listPosts());
      if (url.pathname === "/api/images" && req.method === "GET") return json(res, 200, await listImages());
      const tagMatch = url.pathname.match(/^\/api\/tags\/(.+)$/);
      if (tagMatch && req.method === "PUT") {
        const { tag } = await readJsonBody(req);
        const changed = await renameTag(decodeURIComponent(tagMatch[1]), tag);
        await rebuildSite();
        return json(res, 200, { ok: true, changed });
      }
      if (tagMatch && req.method === "DELETE") {
        const changed = await deleteTag(decodeURIComponent(tagMatch[1]));
        await rebuildSite();
        return json(res, 200, { ok: true, changed });
      }
      if (url.pathname === "/api/posts" && req.method === "POST") {
        const slug = await savePost(await readJsonBody(req));
        await rebuildSite();
        return json(res, 201, { ok: true, slug });
      }
      const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
      if (postMatch && req.method === "GET") {
        const post = await findPost(postMatch[1]);
        return post ? json(res, 200, post) : json(res, 404, { error: "文章不存在。" });
      }
      if (postMatch && req.method === "PUT") {
        const slug = await savePost(await readJsonBody(req), postMatch[1]);
        await rebuildSite();
        return json(res, 200, { ok: true, slug });
      }
      if (postMatch && req.method === "DELETE") {
        const ok = await deletePost(postMatch[1]);
        await rebuildSite();
        return json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "文章不存在。" });
      }
      if (url.pathname === "/api/upload" && req.method === "POST") return json(res, 201, { path: await saveUpload(req) });
      if (url.pathname === "/api/rebuild" && req.method === "POST") {
        await rebuildSite();
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "接口不存在。" });
    }

    if (await serveFile(res, req.url)) return;
    send(res, 404, "页面不存在。");
  } catch (error) {
    json(res, 500, { error: error.message || "服务器错误。" });
  }
}

createServer(route).listen(PORT, "127.0.0.1", () => {
  console.log(`博客和后台已启动: http://127.0.0.1:${PORT}/`);
  console.log(`后台入口: http://127.0.0.1:${PORT}/admin/`);
});
