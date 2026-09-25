import * as XLSX from "xlsx";
import type { Catalog, Product, StoreRecord } from "@/lib/catalog-types";
import type { DriveSourceFile } from "@/lib/google-drive";

type SourceWorkbook = DriveSourceFile & { data: Buffer };
type Row = Record<string, unknown>;

const STORES: Record<
  Exclude<DriveSourceFile["name"], "produtos.xlsx">,
  { key: string; name: string }
> = {
  "aruba.xlsx": { key: "aruba", name: "Aruba" },
  "maggiore.xlsx": { key: "maggiore", name: "Maggiore" },
  "oggi.xlsx": { key: "oggi", name: "Oggi" },
  "paradise.xlsx": { key: "paradise", name: "Paradise" },
  "mares.xlsx": { key: "mares", name: "Verdes Mares" },
  "varandas.xlsx": { key: "varandas", name: "Varandas" },
  "miami.xlsx": { key: "miami", name: "Miami" },
  "cd.xlsx": { key: "cd", name: "CD" },
};

function normalizedHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function field(row: Row, ...names: string[]) {
  const wanted = new Set(names.map(normalizedHeader));
  const key = Object.keys(row).find((item) => wanted.has(normalizedHeader(item)));
  return key ? row[key] : null;
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = textValue(value);
  if (!text || /^n[aã]o informado$/i.test(text)) return null;
  const normalized = text
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function identifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return textValue(value).replace(/\.0$/, "");
}

function barcode(value: unknown) {
  return identifier(value).replace(/\D/g, "");
}

function expiryValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  if (typeof value === "number" && value > 20_000 && value < 100_000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString();
  }
  const valueText = textValue(value);
  return valueText || null;
}

function rowsFromWorkbook(source: SourceWorkbook) {
  const workbook = XLSX.read(source.data, {
    type: "buffer",
    cellDates: true,
    dense: true,
  });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error(`${source.name} não contém nenhuma aba.`);
  return XLSX.utils.sheet_to_json<Row>(workbook.Sheets[firstSheet], {
    defval: null,
    raw: true,
  });
}

function validateHeaders(rows: Row[], sourceName: string, required: string[]) {
  const first = rows[0];
  if (!first) throw new Error(`${sourceName} está vazio.`);
  const headers = new Set(Object.keys(first).map(normalizedHeader));
  const missing = required.filter((name) => !headers.has(normalizedHeader(name)));
  if (missing.length) {
    throw new Error(
      `${sourceName} mudou de formato. Colunas ausentes: ${missing.join(", ")}.`,
    );
  }
}

export function buildCatalog(sources: SourceWorkbook[]): Catalog {
  const productSource = sources.find((source) => source.name === "produtos.xlsx");
  if (!productSource) throw new Error("produtos.xlsx não foi carregado.");

  const productRows = rowsFromWorkbook(productSource);
  validateHeaders(productRows, productSource.name, [
    "ID",
    "Nome",
    "Categoria",
    "Último Preço",
    "Código de Barras Primário",
    "URL da Imagem",
  ]);

  const validProductRows = productRows.filter((row) => {
    const ean = barcode(field(row, "Código de Barras Primário"));
    return ean.length >= 6;
  });
  if (validProductRows.length < 100) {
    throw new Error(
      "produtos.xlsx retornou poucos produtos válidos. A base anterior foi preservada.",
    );
  }

  const eanCounts = new Map<string, number>();
  validProductRows.forEach((row) => {
    const ean = barcode(field(row, "Código de Barras Primário"));
    eanCounts.set(ean, (eanCounts.get(ean) ?? 0) + 1);
  });

  const storesByEan = new Map<string, StoreRecord[]>();
  const fallbackNames = new Map<string, string>();

  for (const source of sources) {
    if (source.name === "produtos.xlsx") continue;
    const store = STORES[source.name];
    if (!store) continue;
    const rows = rowsFromWorkbook(source);
    validateHeaders(rows, source.name, [
      "Codigo de Barras",
      "Nome do Produto",
      "Status",
      "Qtd.Padrão",
      "Nível de Alerta",
      "Preço Lista",
      "Preço Final (consumidor)",
      "Qtd.Estoque",
      "Data de vencimento",
    ]);

    for (const row of rows) {
      const ean = barcode(field(row, "Codigo de Barras", "Código de Barras"));
      if (ean.length < 6) continue;
      const records = storesByEan.get(ean) ?? [];
      records.push({
        key: store.key,
        name: store.name,
        status: textValue(field(row, "Status")) || "Não informado",
        standardQty: numberValue(field(row, "Qtd.Padrão", "Qtd Padrao")),
        alertLevel: numberValue(field(row, "Nível de Alerta")),
        listPrice: numberValue(field(row, "Preço Lista")),
        finalPrice: numberValue(field(row, "Preço Final (consumidor)")),
        stock: numberValue(field(row, "Qtd.Estoque", "Qtd Estoque")),
        expiry: expiryValue(field(row, "Data de vencimento")),
      });
      storesByEan.set(ean, records);
      if (!fallbackNames.has(ean)) {
        fallbackNames.set(
          ean,
          textValue(field(row, "Nome do Produto")) || `Produto ${ean}`,
        );
      }
    }
  }

  const products: Product[] = validProductRows.map((row) => {
    const ean = barcode(field(row, "Código de Barras Primário"));
    const imageUrl = textValue(field(row, "URL da Imagem"));
    return {
      id: identifier(field(row, "ID")),
      ean,
      name: textValue(field(row, "Nome")) || fallbackNames.get(ean) || `Produto ${ean}`,
      category: textValue(field(row, "Categoria")) || "Sem categoria",
      cost: numberValue(field(row, "Último Preço")),
      imageUrl: imageUrl && !/^n[aã]o informado$/i.test(imageUrl) ? imageUrl : null,
      stores: storesByEan.get(ean) ?? [],
      duplicateEan: (eanCounts.get(ean) ?? 0) > 1,
      catalogStatus: "ok",
    };
  });

  const registeredEans = new Set(eanCounts.keys());
  for (const [ean, stores] of storesByEan) {
    if (registeredEans.has(ean)) continue;
    products.push({
      id: "",
      ean,
      name: fallbackNames.get(ean) || `Produto ${ean}`,
      category: "Não cadastrado no catálogo",
      cost: null,
      imageUrl: null,
      stores,
      duplicateEan: false,
      catalogStatus: "missing",
    });
  }

  const sourceUpdatedAt = Object.fromEntries(
    sources.map((source) => [source.name, source.modifiedTime]),
  );

  return {
    generatedAt: new Date().toISOString(),
    productCount: products.length,
    marketCount: Object.keys(STORES).length,
    sourceFiles: sources.map((source) => source.name),
    sourceUpdatedAt,
    products,
  };
}

