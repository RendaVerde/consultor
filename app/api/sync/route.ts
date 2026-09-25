import { buildCatalog } from "@/lib/catalog-builder";
import { blobIsConfigured, saveCatalog } from "@/lib/catalog-store";
import {
  downloadDriveFile,
  driveConfigurationErrors,
  findSourceFiles,
} from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(request: Request) {
  const syncToken = process.env.IHM_SYNC_TOKEN?.trim();
  if (syncToken && bearerToken(request) !== syncToken) {
    return Response.json(
      {
        status: "unauthorized",
        requiresToken: true,
        message:
          "Informe a chave de atualização para consultar o Google Drive.",
      },
      { status: 401 },
    );
  }

  const missing = driveConfigurationErrors();
  if (!blobIsConfigured()) missing.push("BLOB_READ_WRITE_TOKEN");
  if (missing.length) {
    return Response.json(
      {
        status: "configuration_required",
        message: `A integração ainda precisa ser configurada na Vercel: ${missing.join(", ")}.`,
      },
      { status: 409 },
    );
  }

  try {
    const files = await findSourceFiles();
    const sources = await Promise.all(
      files.map(async (file) => ({
        ...file,
        data: await downloadDriveFile(file.id),
      })),
    );
    const catalog = buildCatalog(sources);
    await saveCatalog(catalog);

    return Response.json({
      status: "ok",
      productCount: catalog.productCount,
      marketCount: catalog.marketCount,
      generatedAt: catalog.generatedAt,
      message: `${catalog.productCount.toLocaleString("pt-BR")} produtos atualizados a partir do Google Drive.`,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Erro desconhecido.";
    console.error("Falha na sincronização do Consultor:", detail);
    return Response.json(
      {
        status: "failed",
        message: `${detail} A base anterior foi preservada.`,
      },
      { status: 502 },
    );
  }
}
