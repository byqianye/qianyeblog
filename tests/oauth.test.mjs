import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as authorize } from "../functions/api/auth.js";
import { onRequestGet as callback, safeEqual } from "../functions/api/callback.js";

test("authorization creates a state parameter and hardened cookie", async () => {
  const response = await authorize({ request:new Request("https://preview.example/api/auth"), env:{GITHUB_CLIENT_ID:"client"} });
  assert.equal(response.status,302);
  const location = new URL(response.headers.get("location"));
  const state = location.searchParams.get("state");
  assert.ok(state && state.length >= 40);
  assert.match(response.headers.get("set-cookie"), new RegExp(`garden_oauth_state=${state}`));
  assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
});

test("callback rejects a missing or mismatched state before token exchange", async () => {
  const response = await callback({ request:new Request("https://preview.example/api/callback?code=x&state=wrong",{headers:{cookie:"garden_oauth_state=right"}}), env:{SITE_URL:"https://preview.example"} });
  assert.equal(response.status,400);
  assert.match(await response.text(),/OAuth validation failed/);
});

test("callback reports missing OAuth configuration after state validation", async () => {
  const response = await callback({ request:new Request("https://preview.example/api/callback?code=x&state=valid",{headers:{cookie:"garden_oauth_state=valid"}}), env:{SITE_URL:"https://preview.example"} });
  assert.equal(response.status,500);
  assert.match(await response.text(),/OAuth is not configured/);
});

test("callback normalizes GitHub denial and restricts the opener origin", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error:"bad_verification_code" });
  try {
    const response = await callback({ request:new Request("https://preview.example/api/callback?code=x&state=valid",{headers:{cookie:"garden_oauth_state=valid"}}), env:{GITHUB_CLIENT_ID:"id",GITHUB_CLIENT_SECRET:"secret",SITE_URL:"https://qianyeblog.pages.dev"} });
    assert.equal(response.status,401);
    const body = await response.text();
    assert.match(body,/GitHub authorization was denied/);
    assert.match(body,/https:\/\/qianyeblog.pages.dev/);
    assert.doesNotMatch(body,/postMessage\(message,"\*"\)/);
  } finally { globalThis.fetch = originalFetch; }
});

test("callback returns the Decap success message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ access_token:"test-token" });
  try {
    const response = await callback({ request:new Request("https://preview.example/api/callback?code=x&state=valid",{headers:{cookie:"garden_oauth_state=valid"}}), env:{GITHUB_CLIENT_ID:"id",GITHUB_CLIENT_SECRET:"secret",SITE_URL:"https://qianyeblog.pages.dev"} });
    assert.equal(response.status,200);
    assert.match(await response.text(),/authorization:github:success/);
  } finally { globalThis.fetch = originalFetch; }
});

test("state comparison checks exact values", () => { assert.equal(safeEqual("same","same"),true); assert.equal(safeEqual("same","different"),false); });
