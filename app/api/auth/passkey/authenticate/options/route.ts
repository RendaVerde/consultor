import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import {
  createPasskeyChallengeToken,
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
  if (!passkeyStoreIsConfigured()) {
    return Response.json(
      { message: "O acesso por biometria ainda não está configurado." },
      { status: 503 },
    );
  }

  const { rpID } = passkeyContext(request);
  const document = await loadPasskeys();
  const passkeys = passkeysForRpID(document, rpID);
  if (!passkeys.length) {
    return Response.json(
      { message: "Entre com a senha e cadastre a biometria neste aparelho." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports,
    })),
    userVerification: "required",
  });
  const response = NextResponse.json(options, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set({
    name: passkeyChallengeCookie.authentication,
    value: await createPasskeyChallengeToken("authentication", options.challenge),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: passkeyChallengeCookie.maxAge,
  });
  return response;
}
