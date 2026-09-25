import { getCatalog, blobIsConfigured } from "@/lib/catalog-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function catalogHeaders(etag?: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-cache",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  if (etag) headers.set("ETag", etag);
  return headers;
}

export async function GET(request: Request) {
  if (blobIsConfigured()) {
    try {
      const result = await getCatalog(
        request.headers.get("if-none-match") ?? undefined,
      );
      if (result?.statusCode === 304) {
        return new Response(null, {
          status: 304,
          headers: catalogHeaders(result.blob.etag),
        });
      }
      if (result?.statusCode === 200 && result.stream) {
        return new Response(result.stream, {
          headers: catalogHeaders(result.blob.etag),
        });
      }
    } catch {
      // Antes da primeira sincronização, usa a base versionada no projeto.
    }
  }

  const fallback = await fetch(new URL("/data/catalog.json", request.url), {
    cache: "no-store",
  });
  if (!fallback.ok) {
    return Response.json(
      { message: "A base de produtos não está disponível." },
      { status: 503 },
    );
  }
  return new Response(fallback.body, { headers: catalogHeaders() });
}

