import { get, put } from "@vercel/blob";
import type {
  AuthenticatorTransport,
  Base64URLString,
  CredentialDeviceType,
  WebAuthnCredential,
} from "@simplewebauthn/server";

const PASSKEYS_PATHNAME = "consultor/passkeys.json";

export type StoredPasskey = {
  id: Base64URLString;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransport[];
  deviceType: CredentialDeviceType;
  backedUp: boolean;
  rpID: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
};

type PasskeyDocument = {
  version: 1;
  passkeys: StoredPasskey[];
};

const emptyDocument = (): PasskeyDocument => ({ version: 1, passkeys: [] });

export function passkeyStoreIsConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function loadPasskeys() {
  if (!passkeyStoreIsConfigured()) return emptyDocument();
  const result = await get(PASSKEYS_PATHNAME, {
    access: "private",
    useCache: false,
  });
  if (!result || result.statusCode !== 200) return emptyDocument();

  try {
    const document = (await new Response(result.stream).json()) as PasskeyDocument;
    if (document.version !== 1 || !Array.isArray(document.passkeys)) {
      return emptyDocument();
    }
    return document;
  } catch {
    return emptyDocument();
  }
}

async function savePasskeys(document: PasskeyDocument) {
  if (!passkeyStoreIsConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN não foi configurado.");
  }
  await put(PASSKEYS_PATHNAME, JSON.stringify(document), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });
}

export function passkeysForRpID(document: PasskeyDocument, rpID: string) {
  return document.passkeys.filter((passkey) => passkey.rpID === rpID);
}

export function webAuthnCredential(passkey: StoredPasskey): WebAuthnCredential {
  return {
    id: passkey.id,
    publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
    counter: passkey.counter,
    transports: passkey.transports,
  };
}

export async function addPasskey(passkey: StoredPasskey) {
  const document = await loadPasskeys();
  const existing = document.passkeys.findIndex((item) => item.id === passkey.id);
  if (existing >= 0) document.passkeys[existing] = passkey;
  else document.passkeys.push(passkey);
  await savePasskeys(document);
}

export async function updatePasskeyCounter(id: string, counter: number) {
  const document = await loadPasskeys();
  const passkey = document.passkeys.find((item) => item.id === id);
  if (!passkey) throw new Error("A credencial não foi encontrada.");
  passkey.counter = counter;
  passkey.lastUsedAt = new Date().toISOString();
  await savePasskeys(document);
}

export function passkeyContext(request: Request) {
  const url = new URL(request.url);
  return {
    rpID: url.hostname,
    origin: `${url.protocol}//${url.host}`,
  };
}

export function deviceLabel(userAgent: string | null) {
  const value = userAgent ?? "";
  if (/iphone|ipad/i.test(value)) return "iPhone ou iPad";
  if (/android/i.test(value)) return "Android";
  if (/windows/i.test(value)) return "Windows Hello";
  if (/macintosh|mac os/i.test(value)) return "Mac";
  return "Dispositivo com Passkey";
}
