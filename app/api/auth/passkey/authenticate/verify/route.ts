import { NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import {
  authUsername,
  createSessionToken,
  passkeyChallengeCookie,
  passkeyChallengeFromRequest,
  sessionCookie,
} from "@/lib/auth";
import {
  loadPasskeys,
  passkeyContext,
  passkeysForRpID,
  updatePasskeyCounter,
  webAuthnCredential,
} from "@/lib/passkeys";

export const runtime = "nodejs";

function clearChallenge(response: NextResponse, request: Request) {
  response.cookies.set({
    name: passkeyChallengeCookie.authentication,
    value: "",
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: Request) {
  const challenge = await passkeyChallengeFromRequest(request, "authentication");
  if (!challenge) {
    return clearChallenge(
      NextResponse.json(
        { message: "A tentativa biométrica expirou. Tente novamente." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
      request,
    );
  }

  let credentialResponse: AuthenticationResponseJSON;
  try {
    credentialResponse = (await request.json()) as AuthenticationResponseJSON;
  } catch {
    return clearChallenge(
      NextResponse.json(
        { message: "Resposta biométrica inválida." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
      request,
    );
  }

  const { rpID, origin } = passkeyContext(request);
  const document = await loadPasskeys();
  const passkey = passkeysForRpID(document, rpID).find(
    (item) => item.id === credentialResponse.id,
  );
  if (!passkey) {
    return clearChallenge(
      NextResponse.json(
        { message: "Esta biometria não está cadastrada no Consultor." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
      request,
    );
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: credentialResponse,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: webAuthnCredential(passkey),
      requireUserVerification: true,
    });
    if (!verification.verified) throw new Error("Assinatura biométrica inválida.");

    await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
    const response = NextResponse.json(
      { verified: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set({
      name: sessionCookie.name,
      value: await createSessionToken(authUsername()),
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return clearChallenge(response, request);
  } catch (error) {
    console.error(
      "Falha ao autenticar Passkey:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    return clearChallenge(
      NextResponse.json(
        { message: "Não foi possível validar a biometria." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
      request,
    );
  }
}
