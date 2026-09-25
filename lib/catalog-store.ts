import { get, put } from "@vercel/blob";
import type { Catalog } from "@/lib/catalog-types";

export const CATALOG_PATHNAME = "consultor/catalog.json";

export function blobIsConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function saveCatalog(catalog: Catalog) {
  return put(CATALOG_PATHNAME, JSON.stringify(catalog), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });
}

export async function getCatalog(ifNoneMatch?: string) {
  return get(CATALOG_PATHNAME, {
    access: "private",
    ifNoneMatch,
  });
}

