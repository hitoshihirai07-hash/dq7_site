export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/admin")) {
    return context.next();
  }

  const USER = env.BASIC_AUTH_USER;
  const PASS = env.BASIC_AUTH_PASSWORD;

  if (!USER || !PASS) {
    return new Response("Admin auth is not configured.", { status: 403 });
  }

  const auth = request.headers.get("Authorization") || "";
  const [scheme, encoded] = auth.split(" ");

  if (scheme === "Basic" && encoded) {
    try {
      const decoded = atob(encoded);
      const idx = decoded.indexOf(":");
      const u = idx >= 0 ? decoded.slice(0, idx) : "";
      const p = idx >= 0 ? decoded.slice(idx + 1) : "";
      if (u === USER && p === PASS) {
        return context.next();
      }
    } catch (e) {}
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"' }
  });
}
