const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const DEFAULT_SCOPE = "public_repo";

function getOrigin(request) {
  return new URL(request.url).origin;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return jsonResponse({ error: "Missing GITHUB_CLIENT_ID" }, 500);
  }

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${getOrigin(request)}/api/callback`);
  url.searchParams.set("scope", env.GITHUB_OAUTH_SCOPE || DEFAULT_SCOPE);

  return Response.redirect(url.toString(), 302);
}
