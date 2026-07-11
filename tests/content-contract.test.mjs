import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("every resource keeps the public contract and a valid external URL", async () => {
  const directory = resolve(root, "src/content/blog");
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".md")) continue;
    const source = await readFile(resolve(directory, name), "utf8");
    assert.match(source, /^---[\s\S]*?\nkind: (article|note|resource)\n/);
    assert.match(source, /\ntitle: /);
    assert.match(source, /\ndescription: /);
    assert.doesNotMatch(source, /\n(category|coverWidth|coverHeight):/);
    if (/\nkind: resource\n/.test(source)) {
      const url = source.match(/\nexternalUrl: "([^"]+)"/)?.[1];
      assert.ok(url);
      assert.doesNotThrow(() => new URL(url));
    }
  }
});

test("media manifest contains responsive variants for every content cover", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "src/generated/media-manifest.json"), "utf8"));
  const directory = resolve(root, "src/content/blog");
  for (const name of await readdir(directory)) {
    const source = await readFile(resolve(directory, name), "utf8");
    const cover = source.match(/\ncover: "([^"]+)"/)?.[1];
    if (cover) {
      assert.ok(manifest[cover], `Missing media manifest entry for ${cover}`);
      assert.match(manifest[cover].srcset, /\d+w/);
    }
  }
});
