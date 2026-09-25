import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildCatalog } from "../lib/catalog-builder";
import { SOURCE_FILES } from "../lib/google-drive";

function workbookBuffer(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Dados",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const productHeader = [
  "ID",
  "Nome",
  "Categoria",
  "Último Preço",
  "Código de Barras Primário",
  "URL da Imagem",
];
const productRows = Array.from({ length: 120 }, (_, index) => [
  1000 + index,
  `Produto ${index}`,
  "Teste",
  3.5,
  `789000000${String(index).padStart(3, "0")}`,
  `https://example.com/${index}.png`,
]);
productRows.push([
  9999,
  "Produto duplicado",
  "Teste",
  4.5,
  "789000000000",
  "",
]);

const storeHeader = [
  "Id",
  "Código de Planograma",
  "Codigo de Barras",
  "Nome do Produto",
  "Status",
  "Qtd.Padrão",
  "Nível de Alerta",
  "Preço Lista",
  "Preço Final (consumidor)",
  "Qtd.Estoque",
  "Data de vencimento",
];

const sources = SOURCE_FILES.map((name, index) => ({
  id: `file-${index}`,
  name,
  modifiedTime: "2026-09-25T12:00:00.000Z",
  size: null,
  data:
    name === "produtos.xlsx"
      ? workbookBuffer([productHeader, ...productRows])
      : workbookBuffer([
          storeHeader,
          [
            index,
            1,
            "789000000000",
            "Produto 0",
            "Desbloqueado",
            5,
            2,
            10,
            9,
            3,
            "Não Informado",
          ],
          ...(name === "aruba.xlsx"
            ? [[2, 1, "7899999999999", "Produto ausente", "Desbloqueado", 1, 0, 5, 5, 1, "Não Informado"]]
            : []),
        ]),
}));

const catalog = buildCatalog(sources);
assert.equal(catalog.productCount, 122);
assert.equal(catalog.marketCount, 8);
assert.equal(catalog.sourceFiles.length, 9);
assert.equal(
  catalog.products.filter((product) => product.ean === "789000000000").length,
  2,
);
assert.ok(
  catalog.products
    .filter((product) => product.ean === "789000000000")
    .every((product) => product.duplicateEan && product.stores.length === 8),
);
const missing = catalog.products.find(
  (product) => product.ean === "7899999999999",
);
assert.equal(missing?.catalogStatus, "missing");
assert.equal(missing?.stores.length, 1);

console.log("Catálogo sintético validado com 9 fontes, duplicidade e item ausente.");

