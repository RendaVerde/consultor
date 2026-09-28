const SESSION_COOKIE = "consultor_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

type SessionPayload = {
  sub: string;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToText(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const result = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(result));
}

export function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function authUsername() {
  return process.env.AUTH_USERNAME?.trim() || "admin";
}

export function authConfigurationErrors() {
  const missing: string[] = [];
  if (!process.env.AUTH_PASSWORD_HASH?.trim()) missing.push("AUTH_PASSWORD_HASH");
  if ((process.env.AUTH_SESSION_SECRET?.trim().length ?? 0) < 32) {
    missing.push("AUTH_SESSION_SECRET");
  }
  return missing;
}

export async function createSessionToken(username: string) {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET não foi configurado corretamente.");
  }
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  return `${encodedPayload}.${await signature(encodedPayload, secret)}`;
}

export async function verifySessionToken(token: string | undefined) {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!token || !secret || secret.length < 32) return false;

  const [encodedPayload, receivedSignature, extra] = token.split(".");
  if (!encodedPayload || !receivedSignature || extra) return false;

  const expectedSignature = await signature(encodedPayload, secret);
  if (!constantTimeEqual(receivedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlToText(encodedPayload)) as SessionPayload;
    return (
      payload.sub === authUsername() &&
      Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export function sessionTokenFromRequest(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const entry of cookies.split(";")) {
    const [name, ...value] = entry.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function isAuthenticated(request: Request) {
  return verifySessionToken(sessionTokenFromRequest(request));
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_DURATION_SECONDS,
};
