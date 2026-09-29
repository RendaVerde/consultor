import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/passkey/authenticate/options",
  "/api/auth/passkey/authenticate/verify",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/sw.js",
]);

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    PUBLIC_PATHS.has(pathname)
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = await isAuthenticated(request);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicAsset(pathname)) return NextResponse.next();
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { status: "unauthorized", message: "Sua sessão expirou. Entre novamente." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const login = new URL("/login", request.url);
  const next = `${pathname}${search}`;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
