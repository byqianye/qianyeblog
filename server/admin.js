const state = {
  posts: [],
  currentSlug: null,
  home: null,
  images: [],
  activeImageInput: null,
  postFilter: "all",
  postQuery: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const imageInputSelector = '#post-form input[name="cover"], #home-form input[name="image"], #home-form input[name="favicon"]';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(message, busy = false) {
  $("#status").textContent = busy ? `${message}...` : message;
}

function parseTagsInput(value) {
  const tags = String(value || "")
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

function getExistingTags() {
  const tags = state.posts.flatMap((post) => (Array.isArray(post.tags) ? post.tags : []));
  return Array.from(new Set(tags.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function getTagStats() {
  const counts = new Map();
  for (const post of state.posts) {
    for (const tag of Array.isArray(post.tags) ? post.tags : []) {
      const name = String(tag || "").trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag, "zh-Hans-CN"));
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDimensions(image) {
  return image.width && image.height ? `${image.width} x ${image.height}` : "尺寸未知";
}

function copyText(text, label = "已复制") {
  navigator.clipboard?.writeText(text).then(() => setStatus(label)).catch(() => setStatus(text));
}

function makeSlug(title) {
  const charMap = {
    的: "de", 一: "yi", 是: "shi", 不: "bu", 了: "le", 在: "zai", 人: "ren", 有: "you",
    我: "wo", 他: "ta", 这: "zhe", 中: "zhong", 大: "da", 来: "lai", 上: "shang",
    个: "ge", 国: "guo", 到: "dao", 说: "shuo", 们: "men", 为: "wei", 子: "zi",
    和: "he", 你: "ni", 地: "di", 出: "chu", 道: "dao", 也: "ye", 时: "shi",
    年: "nian", 得: "de", 就: "jiu", 那: "na", 要: "yao", 下: "xia", 以: "yi",
    生: "sheng", 会: "hui", 自: "zi", 着: "zhe", 去: "qu", 之: "zhi", 过: "guo",
    家: "jia", 学: "xue", 对: "dui", 可: "ke", 她: "ta", 里: "li", 后: "hou",
    小: "xiao", 么: "me", 心: "xin", 多: "duo", 天: "tian", 而: "er", 能: "neng",
    好: "hao", 都: "dou", 然: "ran", 没: "mei", 日: "ri", 于: "yu", 起: "qi",
    还: "hai", 发: "fa", 成: "cheng", 事: "shi", 只: "zhi", 作: "zuo", 当: "dang",
    想: "xiang", 看: "kan", 文: "wen", 章: "zhang", 新: "xin", 记: "ji", 录: "lu",
    读: "du", 书: "shu", 影: "ying", 视: "shi", 工: "gong", 具: "ju", 浅: "qian",
    靥: "ye", 博: "bo", 客: "ke", 网: "wang", 站: "zhan", 分: "fen", 享: "xiang"
  };
  const converted = Array.from(String(title || "").trim().toLowerCase())
    .map((char) => {
      if (/[a-z0-9]/.test(char)) return char;
      if (/[\s_-]/.test(char)) return "-";
      return charMap[char] ? `-${charMap[char]}-` : "-";
    })
    .join("");
  return converted
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdownPreview() {
  const target = $("#markdown-preview");
  const textarea = $("#post-form").elements.content;
  if (!target || !textarea) return;

  const lines = String(textarea.value || "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let inCode = false;
  let code = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }
    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code.length) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);

  target.innerHTML = blocks.join("") || `<p class="hint">预览会随着正文输入实时更新。</p>`;
}

function getImageInput() {
  if (state.activeImageInput?.isConnected && state.activeImageInput.matches(imageInputSelector)) return state.activeImageInput;
  return $("#post-form").elements.cover;
}

function fillImageInput(path) {
  const input = getImageInput();
  input.value = path;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus({ preventScroll: true });
  navigator.clipboard?.writeText(path).catch(() => {});
  setStatus(`图片路径已填入：${path}`);
}

function moveImagePreview(event) {
  const preview = $("#image-preview");
  if (!preview || preview.hidden) return;
  const margin = 18;
  const width = preview.offsetWidth || 320;
  const height = preview.offsetHeight || 240;
  const left = Math.min(window.innerWidth - width - margin, event.clientX + margin);
  const top = Math.min(window.innerHeight - height - margin, event.clientY + margin);
  preview.style.left = `${Math.max(margin, left)}px`;
  preview.style.top = `${Math.max(margin, top)}px`;
}

function showImagePreview(image, event) {
  const preview = $("#image-preview");
  if (!preview) return;
  preview.querySelector("img").src = image.path;
  preview.querySelector("span").textContent = image.path;
  preview.hidden = false;
  moveImagePreview(event);
}

function hideImagePreview() {
  const preview = $("#image-preview");
  if (preview) preview.hidden = true;
}

function createImageButton(image, { compact = false, selected = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${compact ? "cover-option" : "image-tile"}${selected ? " active" : ""}`;
  button.title = image.path;
  button.setAttribute("aria-pressed", String(selected));
  button.innerHTML = `
    <img src="${escapeHtml(image.path)}" alt="" loading="lazy" />
    <span>${escapeHtml(image.name)}</span>
    ${compact ? "" : `<small>${formatSize(image.size)} · ${formatDimensions(image)}</small>`}
  `;
  button.addEventListener("click", () => fillImageInput(image.path));
  button.addEventListener("pointerenter", (event) => showImagePreview(image, event));
  button.addEventListener("pointermove", moveImagePreview);
  button.addEventListener("pointerleave", hideImagePreview);
  return button;
}

function renderImageLibrary() {
  const container = $("#image-library");
  if (!container) return;
  container.innerHTML = "";
  if (!state.images.length) {
    container.innerHTML = `<p class="hint">还没有可选择的图片。</p>`;
    return;
  }

  for (const image of state.images) {
    container.append(createImageButton(image));
  }
}

function renderCoverOptions() {
  const container = $("#cover-options");
  if (!container) return;
  const selectedPath = $("#post-form").elements.cover.value.trim();
  container.innerHTML = "";

  if (!state.images.length) {
    container.innerHTML = `<p class="hint">还没有可选择的图片。</p>`;
    return;
  }

  for (const image of state.images) {
    container.append(createImageButton(image, { compact: true, selected: image.path === selectedPath }));
  }
}

async function loadImages() {
  state.images = await api("/api/images");
  renderImageLibrary();
  renderCoverOptions();
}

function setTagsInput(tags) {
  $("#post-form").elements.tags.value = parseTagsInput(tags.join(", ")).join(", ");
}

function renderTagOptions() {
  const container = $("#tag-options");
  if (!container) return;
  const selectedTags = new Set(parseTagsInput($("#post-form").elements.tags.value));
  const existingTags = getExistingTags();

  container.innerHTML = "";
  if (!existingTags.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  for (const tag of existingTags) {
    const button = document.createElement("button");
    const selected = selectedTags.has(tag);
    button.type = "button";
    button.className = `tag-option${selected ? " active" : ""}`;
    button.textContent = tag;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      const nextTags = parseTagsInput($("#post-form").elements.tags.value);
      const nextSet = new Set(nextTags);
      if (nextSet.has(tag)) {
        nextSet.delete(tag);
      } else {
        nextSet.add(tag);
      }
      setTagsInput(Array.from(nextSet));
      renderTagOptions();
    });
    container.append(button);
  }
}

function renderTagManager() {
  const container = $("#tag-manager-list");
  if (!container) return;
  const stats = getTagStats();

  container.innerHTML = "";
  if (!stats.length) {
    container.innerHTML = `<p class="hint">保存文章后，这里会显示可管理的标签。</p>`;
    return;
  }

  for (const { tag, count } of stats) {
    const item = document.createElement("div");
    item.className = "tag-manager-item";
    const safeTag = escapeHtml(tag);
    item.innerHTML = `
      <div class="tag-manager-meta">
        <strong>${safeTag}</strong>
        <span>${count} 篇文章</span>
      </div>
      <form class="rename-tag-form">
        <input name="tag" value="${safeTag}" aria-label="重命名标签 ${safeTag}" />
        <button type="submit">重命名</button>
      </form>
      <button type="button" class="danger delete-tag-button">删除</button>
    `;

    item.querySelector(".rename-tag-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const nextTag = event.currentTarget.elements.tag.value.trim();
      if (!nextTag) return setStatus("新标签不能为空");
      if (nextTag === tag) return setStatus("标签没有变化");
      setStatus("重命名标签并重建站点", true);
      try {
        await api(`/api/tags/${encodeURIComponent(tag)}`, { method: "PUT", body: JSON.stringify({ tag: nextTag }) });
        await loadPosts();
        setStatus("标签已重命名，访客站已更新");
      } catch (error) {
        setStatus(error.message);
      }
    });

    item.querySelector(".delete-tag-button").addEventListener("click", async () => {
      if (!confirm(`确认从所有文章中删除标签「${tag}」？文章不会被删除。`)) return;
      setStatus("删除标签并重建站点", true);
      try {
        await api(`/api/tags/${encodeURIComponent(tag)}`, { method: "DELETE" });
        await loadPosts();
        setStatus("标签已删除，访客站已更新");
      } catch (error) {
        setStatus(error.message);
      }
    });

    container.append(item);
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { "content-type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || "请求失败。");
  return data;
}

function formToPost(form) {
  const data = Object.fromEntries(new FormData(form));
  const cover = String(data.cover || "").trim();
  const image = state.images.find((item) => item.path === cover);
  return {
    slug: data.slug,
    title: data.title,
    description: data.description,
    pubDate: data.pubDate,
    tags: parseTagsInput(data.tags),
    cover,
    coverWidth: image?.width,
    coverHeight: image?.height,
    draft: form.elements.draft.checked,
    content: data.content
  };
}

function fillPostForm(post = {}) {
  const form = $("#post-form");
  form.elements.originalSlug.value = post.slug || "";
  form.elements.slug.value = post.slug || "";
  form.elements.title.value = post.title || "";
  form.elements.description.value = post.description || "";
  form.elements.pubDate.value = String(post.pubDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  setTagsInput(Array.isArray(post.tags) ? post.tags : []);
  form.elements.cover.value = post.cover || "/images/covers/morning-notes.png";
  form.elements.draft.checked = Boolean(post.draft);
  form.elements.content.value = post.content || "写下你的新文章。";
  state.currentSlug = post.slug || null;
  $("#post-edit-status").textContent = post.slug ? `正在修改：${post.title || post.slug}` : "正在新建文章";
  renderTagOptions();
  renderCoverOptions();
  renderMarkdownPreview();
  renderPosts();
}

function getVisiblePosts() {
  const query = state.postQuery.trim().toLowerCase();
  return state.posts.filter((post) => {
    const statusMatch =
      state.postFilter === "all" ||
      (state.postFilter === "draft" && post.draft) ||
      (state.postFilter === "published" && !post.draft);
    const haystack = [post.title, post.slug, post.description, ...(Array.isArray(post.tags) ? post.tags : [])]
      .join(" ")
      .toLowerCase();
    return statusMatch && (!query || haystack.includes(query));
  });
}

function renderPosts() {
  const list = $("#post-list");
  list.innerHTML = "";
  const posts = getVisiblePosts();
  if (!posts.length) {
    list.innerHTML = `<p class="hint">没有匹配的文章。</p>`;
    return;
  }
  for (const post of posts) {
    const item = document.createElement("article");
    item.className = `post-item${post.slug === state.currentSlug ? " active" : ""}`;
    item.innerHTML = `
      <div class="post-item-main">
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(post.slug)} · ${String(post.pubDate).slice(0, 10)}${post.draft ? " · 草稿" : ""}</span>
      </div>
      <button type="button" class="edit-post-button">修改</button>
    `;
    item.querySelector(".edit-post-button").addEventListener("click", () => fillPostForm(post));
    list.append(item);
  }
}

async function loadPosts(preferredSlug = state.currentSlug) {
  state.posts = await api("/api/posts");
  renderPosts();
  const nextPost = state.posts.find((post) => post.slug === preferredSlug) || state.posts[0];
  fillPostForm(nextPost);
  renderTagOptions();
  renderTagManager();
}

function fillHomeForm(home) {
  const form = $("#home-form");
  for (const [key, value] of Object.entries(home)) {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  }
}

async function loadHome() {
  state.home = await api("/api/site");
  fillHomeForm(state.home);
}

function switchPanel(panel) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.panel === panel));
  $$(".panel").forEach((section) => section.classList.toggle("active", section.id === `panel-${panel}`));
  $("#panel-title").textContent = { posts: "文章管理", home: "站点设置", media: "图片上传" }[panel];
}

async function init() {
  try {
    await api("/api/me");
    await Promise.all([loadPosts(), loadHome(), loadImages()]);
    setStatus("已连接");
  } catch (error) {
    location.href = "/admin/login";
  }

  $$(".nav-item").forEach((button) => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
  $("#post-form").elements.tags.addEventListener("input", renderTagOptions);
  $("#post-form").elements.cover.addEventListener("input", renderCoverOptions);
  $("#post-form").elements.content.addEventListener("input", renderMarkdownPreview);
  $("#post-form").elements.title.addEventListener("blur", () => {
    const form = $("#post-form");
    if (form.elements.originalSlug.value || form.elements.slug.value.trim()) return;
    const slug = makeSlug(form.elements.title.value);
    if (slug) form.elements.slug.value = slug;
  });
  $("#generate-slug").addEventListener("click", () => {
    const form = $("#post-form");
    const slug = makeSlug(form.elements.title.value);
    if (!slug) return setStatus("无法从标题生成安全 slug，请手动输入英文、数字或连字符。");
    form.elements.slug.value = slug;
    setStatus(`已生成 slug：${slug}`);
  });
  $("#post-search").addEventListener("input", (event) => {
    state.postQuery = event.currentTarget.value;
    renderPosts();
  });
  $$("[data-post-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.postFilter = button.dataset.postFilter;
      $$("[data-post-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderPosts();
    });
  });
  $$(imageInputSelector).forEach((input) => {
    input.addEventListener("focus", () => {
      state.activeImageInput = input;
    });
    input.addEventListener("click", () => {
      state.activeImageInput = input;
    });
  });
  $("#refresh-images").addEventListener("click", async () => {
    setStatus("刷新图片库", true);
    try {
      await loadImages();
      setStatus("图片库已刷新");
    } catch (error) {
      setStatus(error.message);
    }
  });

  $("#add-tag-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const tag = event.currentTarget.elements.tag.value.trim();
    if (!tag) return setStatus("新增标签不能为空");
    const nextTags = parseTagsInput($("#post-form").elements.tags.value);
    if (!nextTags.includes(tag)) nextTags.push(tag);
    setTagsInput(nextTags);
    renderTagOptions();
    event.currentTarget.reset();
    setStatus("标签已加入当前文章，保存后生效");
  });

  $("#new-post").addEventListener("click", () => {
    fillPostForm({
      slug: "",
      title: "新的文章",
      description: "一句简短摘要。",
      pubDate: new Date().toISOString().slice(0, 10),
      tags: ["日常"],
      cover: "/images/covers/morning-notes.png",
      draft: false,
      content: "从这里开始写。"
    });
  });

  $("#post-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const originalSlug = event.currentTarget.elements.originalSlug.value;
    const post = formToPost(event.currentTarget);
    setStatus("保存文章并重建站点", true);
    try {
      if (originalSlug) {
        const result = await api(`/api/posts/${encodeURIComponent(originalSlug)}`, { method: "PUT", body: JSON.stringify(post) });
        await loadPosts(result.slug || post.slug);
      } else {
        const result = await api("/api/posts", { method: "POST", body: JSON.stringify(post) });
        await loadPosts(result.slug || post.slug);
      }
      setStatus("文章已保存，访客站已更新");
    } catch (error) {
      setStatus(error.message);
    }
  });

  $("#delete-post").addEventListener("click", async () => {
    const slug = $("#post-form").elements.originalSlug.value;
    if (!slug) return setStatus("当前没有可删除的文章");
    if (!confirm("确认删除这篇文章？删除后会立即重建访客站。")) return;
    setStatus("删除文章并重建站点", true);
    try {
      await api(`/api/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });
      await loadPosts();
      setStatus("文章已删除，访客站已更新");
    } catch (error) {
      setStatus(error.message);
    }
  });

  $("#home-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setStatus("保存站点设置并重建站点", true);
    try {
      await api("/api/site", { method: "PUT", body: JSON.stringify(data) });
      state.home = data;
      setStatus("站点设置已更新");
    } catch (error) {
      setStatus(error.message);
    }
  });

  $("#upload-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = event.currentTarget.elements.image.files?.[0];
    if (file && file.size > 8 * 1024 * 1024) {
      setStatus("图片超过 8 MB，请先压缩后再上传。");
      return;
    }
    setStatus("上传图片", true);
    try {
      const result = await api("/api/upload", { method: "POST", body: formData });
      $("#upload-result").innerHTML = `<div class="upload-result-card">
        <code>${escapeHtml(result.path)}</code>
        <span>${escapeHtml(formatSize(result.size))} · ${escapeHtml(formatDimensions(result))}</span>
        <button type="button" class="ghost-button" data-copy-upload>复制路径</button>
      </div>`;
      $("[data-copy-upload]")?.addEventListener("click", () => copyText(result.path, "图片路径已复制"));
      copyText(result.path, "图片已上传，路径已复制");
      await loadImages();
      setStatus("图片已上传，路径已显示");
    } catch (error) {
      setStatus(error.message);
    }
  });

  $("#logout").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
    location.href = "/admin/login";
  });
}

init();
