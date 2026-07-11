import { STATE_COOKIE } from "./auth.js";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

function readCookie(header, name) {
  return header.split(";").map((part) => part.trim().split("=")).find(([key]) => key === name)?.[1];
}

export function safeEqual(left = "", right = "") {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

function message(type, payload) { return `authorization:github:${type}:${JSON.stringify(payload)}`; }
function parseTokenResponse(value) {
  if (!value || typeof value !== "object") return {};
  return {
    accessToken: typeof value.access_token === "string" ? value.access_token : undefined,
    error: typeof value.error === "string" ? value.error : undefined
  };
}
function page(authMessage, origin) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>GitHub 登录</title></head><body><p>正在完成登录…</p><script>(function(){var message=${JSON.stringify(authMessage)};var origin=${JSON.stringify(origin)};if(window.opener&&origin){window.opener.postMessage(message,origin);window.close();}})();</script></body></html>`;
}
function response(authMessage, origin, status = 200) {
  return new Response(page(authMessage, origin), { status, headers: { "content-type":"text/html; charset=utf-8", "cache-control":"no-store", "set-cookie":`${STATE_COOKIE}=; Path=/api/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
}
function siteOrigin(env) {
  try { return env.SITE_URL ? new URL(env.SITE_URL).origin : undefined; } catch { return undefined; }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = siteOrigin(env);
  if (!origin) return new Response(page(message("error", { error:"OAuth is not configured." }), ""), { status:500, headers:{ "content-type":"text/html; charset=utf-8", "cache-control":"no-store" } });
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const stored = readCookie(request.headers.get("cookie") || "", STATE_COOKIE) || "";
  if (!code || !state || !stored || !safeEqual(state, stored)) return response(message("error", { error:"OAuth validation failed." }), origin, 400);
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return response(message("error", { error:"OAuth is not configured." }), origin, 500);
  try {
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, { method:"POST", headers:{ accept:"application/json", "content-type":"application/json" }, body:JSON.stringify({ client_id:env.GITHUB_CLIENT_ID, client_secret:env.GITHUB_CLIENT_SECRET, code, redirect_uri:`${url.origin}/api/callback` }) });
    const tokenData = parseTokenResponse(await tokenResponse.json());
    if (!tokenResponse.ok || tokenData.error || !tokenData.accessToken) return response(message("error", { error:"GitHub authorization was denied." }), origin, 401);
    return response(message("success", { token:tokenData.accessToken, provider:"github" }), origin);
  } catch {
    return response(message("error", { error:"GitHub authorization is temporarily unavailable." }), origin, 502);
  }
}
