import { NextResponse } from "next/server";
import {
  authConfigurationErrors,
  authUsername,
  createSessionToken,
  sessionCookie,
} from "@/lib/auth";
import { verifyCredentials } from "@/lib/password";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; blockedUntil: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function noStoreJson(body: object, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export async function POST(request: Request) {
  const missing = authConfigurationErrors();
  if (missing.length) {
    return noStoreJson(
      { message: `O acesso ainda precisa ser configurado: ${missing.join(", ")}.` },
      503,
    );
  }

  const address = clientAddress(request);
  const now = Date.now();
  const current = attempts.get(address);
  if (current && current.blockedUntil > now) {
    const retryAfter = Math.ceil((current.blockedUntil - now) / 1000);
    return noStoreJson(
      { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  let credentials: { username?: unknown; password?: unknown } = {};
  try {
    credentials = (await request.json()) as typeof credentials;
  } catch {
    return noStoreJson({ message: "Dados de acesso inválidos." }, 400);
  }

  const username =
    typeof credentials.username === "string" ? credentials.username.trim() : "";
  const password =
    typeof credentials.password === "string" ? credentials.password : "";

  if (!verifyCredentials(username, password)) {
    const count = (current?.blockedUntil && current.blockedUntil <= now ? 0 : current?.count ?? 0) + 1;
    attempts.set(address, {
      count,
      blockedUntil: count >= MAX_ATTEMPTS ? now + WINDOW_MS : 0,
    });
    return noStoreJson({ message: "Usuário ou senha incorretos." }, 401);
  }

  attempts.delete(address);
  const response = noStoreJson({ status: "ok" });
  response.cookies.set({
    name: sessionCookie.name,
    value: await createSessionToken(authUsername()),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return response;
}
