import { isAuthenticated } from "@/lib/auth";
import {
  loadPasskeys,
  passkeyContext,
  passkeyStoreIsConfigured,
  passkeysForRpID,
} from "@/lib/passkeys";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ message: "Sua sessão expirou." }, { status: 401 });
  }
  if (!passkeyStoreIsConfigured()) {
    return Response.json({ configured: false, passkeyCount: 0 });
  }
  const { rpID } = passkeyContext(request);
  const document = await loadPasskeys();
  return Response.json(
    {
      configured: true,
      passkeyCount: passkeysForRpID(document, rpID).length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
