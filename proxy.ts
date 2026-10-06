import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER, SESSION_COOKIE, safeNext, sessionCookieOptions } from "./lib/auth/constants";
import { isLiveSession } from "./lib/auth/token";

/**
 * First gate for /admin and /api/admin: a missing, forged or expired session never reaches a
 * page. Pages redirect to the login page (coming back afterwards); API calls get 401. One
 * indexed lookup per request (Node.js runtime). Every admin page, action and route still checks
 * the session itself (lib/auth/session.ts), so a gap in this matcher can't expose anything.
 * Also renews the cookie's 7 days on each visit (sliding sessions) and marks responses noindex.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isLogin = pathname === "/admin/login" || pathname === "/admin/login/";
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const token = cookie && (await isLiveSession(cookie)) ? cookie : undefined;

  let res: NextResponse;
  if (token && isLogin) {
    // Already signed in: skip the form.
    res = NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url));
  } else if (!token && !isLogin) {
    if (isApi) {
      res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
    } else {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login/";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      res = NextResponse.redirect(url);
    }
  } else {
    const headers = new Headers(req.headers);
    headers.set(PATH_HEADER, pathname + search);
    res = NextResponse.next({ request: { headers } });
    if (token) res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  }
  // A dead session's cookie is useless: clear it.
  // (Same attributes as when it was set: a __Host- cookie can only be replaced by a Secure one.)
  if (cookie && !token) res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
