const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

function callbackPage(message) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>GitHub 登录</title>
  </head>
  <body>
    <script>
      (function () {
        var message = ${JSON.stringify(message)};
        function receiveMessage(event) {
          if (!window.opener) return;
          window.opener.postMessage(message, event.origin);
          window.removeEventListener("message", receiveMessage);
          window.close();
        }
        window.addEventListener("message", receiveMessage);
        if (window.opener) {
          window.opener.postMessage("authorizing:github", "*");
        }
      })();
    </script>
  </body>
</html>`;
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

function authMessage(type, payload) {
  return `authorization:github:${type}:${JSON.stringify(payload)}`;
}

export async function onRequestGet({ request, env }) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return htmlResponse(callbackPage(authMessage("error", { error: "Missing GitHub OAuth code" })), 400);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return htmlResponse(callbackPage(authMessage("error", { error: "Missing GitHub OAuth credentials" })), 500);
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${requestUrl.origin}/api/callback`
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
    return htmlResponse(
      callbackPage(authMessage("error", { error: tokenData.error_description || tokenData.error || "GitHub OAuth failed" })),
      401
    );
  }

  return htmlResponse(callbackPage(authMessage("success", { token: tokenData.access_token, provider: "github" })));
}
