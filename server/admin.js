const state = {
  posts: [],
  currentSlug: null,
  home: null,
  images: [],
  activeImageInput: null
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

function renderImageLibrary() {
  const container = $("#image-library");
  if (!container) return;
  container.innerHTML = "";

  if (!state.images.length) {
    container.innerHTML = `<p class="hint">还没有可选择的图片。</p>`;
    return;
  }

  for (const image of state.images) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-tile";
    button.title = image.path;
    button.innerHTML = `
      <img src="${escapeHtml(image.path)}" alt="" loading="lazy" />
      <span>${escapeHtml(image.name)}</span>
      <small>${formatSize(image.size)}</small>
    `;
    button.addEventListener("click", () => fillImageInput(image.path));
    button.addEventListener("pointerenter", (event) => showImagePreview(image, event));
    button.addEventListener("pointermove", moveImagePreview);
    button.addEventListener("pointerleave", hideImagePreview);
    container.append(button);
  }
}

async function loadImages() {
  state.images = await api("/api/images");
  renderImageLibrary();
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
  return {
    slug: data.slug,
    title: data.title,
    description: data.description,
    pubDate: data.pubDate,
    tags: parseTagsInput(data.tags),
    cover: data.cover,
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
  renderTagOptions();
}

function renderPosts() {
  const list = $("#post-list");
  list.innerHTML = "";
  for (const post of state.posts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "post-item";
    button.innerHTML = `<strong>${post.title}</strong><span>${post.slug} · ${String(post.pubDate).slice(0, 10)}${post.draft ? " · 草稿" : ""}</span>`;
    button.addEventListener("click", () => fillPostForm(post));
    list.append(button);
  }
}

async function loadPosts() {
  state.posts = await api("/api/posts");
  renderPosts();
  fillPostForm(state.posts[0]);
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
        await api(`/api/posts/${encodeURIComponent(originalSlug)}`, { method: "PUT", body: JSON.stringify(post) });
      } else {
        await api("/api/posts", { method: "POST", body: JSON.stringify(post) });
      }
      await loadPosts();
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
    setStatus("上传图片", true);
    try {
      const result = await api("/api/upload", { method: "POST", body: formData });
      $("#upload-result").textContent = result.path;
      navigator.clipboard?.writeText(result.path).catch(() => {});
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
