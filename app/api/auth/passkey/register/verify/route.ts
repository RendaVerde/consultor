import { NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
  type AuthenticatorTransport,
} from "@simplewebauthn/server";
import {
  isAuthenticated,
  passkeyChallengeCookie,
  passkeyChallengeFromRequest,
} from "@/lib/auth";
import {
  addPasskey,
  deviceLabel,
  passkeyContext,
  passkeyStoreIsConfigured,
} from "@/lib/passkeys";

export const runtime = "nodejs";

function responseWithClearedChallenge(
  request: Request,
  body: object,
  status = 200,
) {
  const response = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set({
    name: passkeyChallengeCookie.registration,
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
  if (!(await isAuthenticated(request))) {
    return responseWithClearedChallenge(request, { message: "Sua sessão expirou." }, 401);
  }
  if (!passkeyStoreIsConfigured()) {
    return responseWithClearedChallenge(
      request,
      { message: "O armazenamento de Passkeys ainda não está configurado." },
      503,
    );
  }

  const challenge = await passkeyChallengeFromRequest(request, "registration");
  if (!challenge) {
    return responseWithClearedChallenge(
      request,
      { message: "O cadastro expirou. Tente novamente." },
      400,
    );
  }

  let credentialResponse: RegistrationResponseJSON;
  try {
    credentialResponse = (await request.json()) as RegistrationResponseJSON;
  } catch {
    return responseWithClearedChallenge(
      request,
      { message: "Resposta biométrica inválida." },
      400,
    );
  }

  const { rpID, origin } = passkeyContext(request);
  try {
    const verification = await verifyRegistrationResponse({
      response: credentialResponse,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return responseWithClearedChallenge(
        request,
        { message: "Não foi possível confirmar a biometria." },
        400,
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    await addPasskey({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransport[] | undefined,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      rpID,
      label: deviceLabel(request.headers.get("user-agent")),
      createdAt: new Date().toISOString(),
    });

    return responseWithClearedChallenge(request, {
      verified: true,
      message: "Biometria cadastrada neste dispositivo.",
    });
  } catch (error) {
    console.error(
      "Falha ao cadastrar Passkey:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    return responseWithClearedChallenge(
      request,
      { message: "Não foi possível concluir o cadastro biométrico." },
      400,
    );
  }
}
