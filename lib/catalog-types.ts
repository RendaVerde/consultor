export type StoreRecord = {
  key: string;
  name: string;
  status: string;
  standardQty: number | null;
  alertLevel: number | null;
  listPrice: number | null;
  finalPrice: number | null;
  stock: number | null;
  expiry: string | null;
};

export type Product = {
  id: string;
  ean: string;
  name: string;
  category: string;
  cost: number | null;
  imageUrl: string | null;
  stores: StoreRecord[];
  duplicateEan: boolean;
  catalogStatus: "ok" | "missing";
};

export type Catalog = {
  generatedAt: string;
  productCount: number;
  marketCount: number;
  sourceFiles: string[];
  sourceUpdatedAt: Record<string, string | null>;
  products: Product[];
};

