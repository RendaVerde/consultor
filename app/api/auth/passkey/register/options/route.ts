import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import {
  authUsername,
  createPasskeyChallengeToken,
  isAuthenticated,
  passkeyChallengeCookie,
} from "@/lib/auth";
import {
  loadPasskeys,
  passkeyContext,
  passkeyStoreIsConfigured,
  passkeysForRpID,
} from "@/lib/passkeys";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ message: "Sua sessão expirou." }, { status: 401 });
  }
  if (!passkeyStoreIsConfigured()) {
    return Response.json(
      { message: "O armazenamento de Passkeys ainda não está configurado." },
      { status: 503 },
    );
  }

  const { rpID } = passkeyContext(request);
  const document = await loadPasskeys();
  const passkeys = passkeysForRpID(document, rpID);
  const options = await generateRegistrationOptions({
    rpName: "Consultor",
    rpID,
    userID: new TextEncoder().encode("consultor-admin-v1"),
    userName: authUsername(),
    userDisplayName: "Administrador",
    attestationType: "none",
    excludeCredentials: passkeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    preferredAuthenticatorType: "localDevice",
  });

  const response = NextResponse.json(options, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set({
    name: passkeyChallengeCookie.registration,
    value: await createPasskeyChallengeToken("registration", options.challenge),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: passkeyChallengeCookie.maxAge,
  });
  return response;
}
