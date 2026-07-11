const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const DEFAULT_SCOPE = "public_repo";
export const STATE_COOKIE = "garden_oauth_state";

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encode(bytes);
}

function errorResponse(status = 500) {
  return new Response("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>OAuth error</title></head><body><p>OAuth request could not be started.</p></body></html>", { status, headers: { "content-type":"text/html; charset=utf-8", "cache-control":"no-store" } });
}

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) return errorResponse();
  const requestUrl = new URL(request.url);
  const state = createState();
  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${requestUrl.origin}/api/callback`);
  authorize.searchParams.set("scope", env.GITHUB_OAUTH_SCOPE || DEFAULT_SCOPE);
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": `${STATE_COOKIE}=${state}; Path=/api/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
    }
  });
}
