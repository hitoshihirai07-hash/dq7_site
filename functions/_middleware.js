export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);

  // Protect admin lab routes
  if (!url.pathname.startsWith("/lab/")) {
    return next();
  }

  const user = env.LAB_USER || "";
  const pass = env.LAB_PASS || "";

  // If env vars are not set, fail closed (deny)
  if (!user || !pass) {
    return new Response("Lab auth is not configured.", { status: 401 });
  }

  const auth = request.headers.get("Authorization") || "";

  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const i = decoded.indexOf(":");
      const u = i >= 0 ? decoded.slice(0, i) : decoded;
      const p = i >= 0 ? decoded.slice(i + 1) : "";
      if (u === user && p === pass) {
        return next();
      }
    } catch (e) {
      // fallthrough
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="DQ7 Lab"',
      "Cache-Control": "no-store"
    }
  });
}
