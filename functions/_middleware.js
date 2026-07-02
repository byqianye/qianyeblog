function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="Qianye Blog Admin", charset="UTF-8"'
    }
  });
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function decodeBasicAuth(value) {
  const prefix = "Basic ";
  if (!value?.startsWith(prefix)) return null;

  try {
    const decoded = atob(value.slice(prefix.length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function onRequest({ request, env, next }) {
  const { pathname } = new URL(request.url);
  if (!isAdminPath(pathname)) return next();

  const expectedUsername = env.ADMIN_USERNAME;
  const expectedPassword = env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return new Response("Missing admin credentials", { status: 500 });
  }

  const credentials = decodeBasicAuth(request.headers.get("authorization"));
  if (
    !credentials ||
    !timingSafeEqual(credentials.username, expectedUsername) ||
    !timingSafeEqual(credentials.password, expectedPassword)
  ) {
    return unauthorized();
  }

  return next();
}
