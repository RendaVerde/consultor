"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Boxes,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Database,
  LayoutDashboard,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Tags,
  WifiOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type StoreRecord = {
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

type Product = {
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

type Catalog = {
  generatedAt: string;
  productCount: number;
  marketCount: number;
  sourceFiles: string[];
  products: Product[];
};

type DetectedBarcode = { rawValue: string };
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

declare global {
  interface Window {
    BarcodeDetector?: DetectorConstructor;
  }
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "Desbloqueado") return "ok";
  if (status.includes("abastecimento")) return "warning";
  if (status.includes("venda")) return "danger";
  return "muted";
}

function operationalSignal(product: Product) {
  const active = product.stores.filter(
    (store) => store.status === "Desbloqueado",
  );
  const below = active.filter(
    (store) =>
      store.stock !== null &&
      store.alertLevel !== null &&
      store.stock <= store.alertLevel,
  );
  const blocked = product.stores.filter((store) =>
    store.status.includes("Bloqueado"),
  );

  if (product.catalogStatus === "missing") {
    return {
      tone: "danger",
      label: "Cadastro incompleto",
      text: "Este EAN consta em planograma, mas não aparece no cadastro geral de produtos.",
    };
  }
  if (product.duplicateEan) {
    return {
      tone: "danger",
      label: "EAN duplicado",
      text: "Há mais de um produto no cadastro geral usando este mesmo código.",
    };
  }
  if (product.stores.length === 0) {
    return {
      tone: "muted",
      label: "Sem planograma",
      text: "Produto ausente nos mercados importados.",
    };
  }
  if (active.length === 0) {
    return {
      tone: "danger",
      label: "Revisar cadastro",
      text: "O produto está bloqueado em todos os locais onde consta.",
    };
  }
  if (below.length >= 2) {
    return {
      tone: "warning",
      label: "Reposição em atenção",
      text: `${below.length} mercados desbloqueados estão no nível de alerta ou abaixo dele.`,
    };
  }
  if (blocked.length > 0) {
    return {
      tone: "warning",
      label: "Conferir bloqueios",
      text: `${blocked.length} ${blocked.length === 1 ? "local está bloqueado" : "locais estão bloqueados"}.`,
    };
  }
  return {
    tone: "ok",
    label: "Situação estável",
    text: "Nenhum alerta imediato encontrado na base atual.",
  };
}

function CameraDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const [message, setMessage] = useState("Preparando a câmera…");

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(
          "Este navegador não permite acessar a câmera. Digite o código na busca.",
        );
        return;
      }
      if (!window.BarcodeDetector) {
        setMessage(
          "A leitura automática não é compatível com este navegador. Use Chrome no celular ou digite o código.",
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMessage("Centralize o código de barras dentro da marcação.");

        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              onDetected(codes[0].rawValue);
              onOpenChange(false);
              return;
            }
          } catch {
            // Mantém o vídeo ativo e tenta no próximo quadro.
          }
          frameRef.current = requestAnimationFrame(scan);
        };
        frameRef.current = requestAnimationFrame(scan);
      } catch {
        setMessage(
          "Não foi possível abrir a câmera. Verifique a permissão do navegador.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scanner-dialog border-0 p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Ler código de barras</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="scanner-stage">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Visualização da câmera"
          />
          <div className="scanner-frame" aria-hidden="true">
            <span />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [category, setCategory] = useState("Todos");
  const [page, setPage] = useState(1);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch("/data/catalog.json")
      .then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json() as Promise<Catalog>;
      })
      .then((data) => {
        setCatalog(data);
      })
      .catch(() => setOffline(true));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const updateOnline = () => setOffline(!navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const results = useMemo(() => {
    if (!catalog || !query.trim()) return [];
    const term = normalize(query);
    const digits = query.replace(/\D/g, "");

    return catalog.products
      .map((product) => {
        let score = 0;
        const name = normalize(product.name);
        if (digits && product.ean === digits) score = 100;
        else if (product.id === query.trim()) score = 95;
        else if (name === term) score = 90;
        else if (name.startsWith(term)) score = 75;
        else if (name.includes(term)) score = 60;
        else if (term.split(" ").every((part) => name.includes(part)))
          score = 45;
        return { product, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.product.name.localeCompare(b.product.name),
      )
      .slice(0, 7)
      .map((item) => item.product);
  }, [catalog, query]);

  const chooseProduct = useCallback((product: Product) => {
    setSelected(product);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const categories = useMemo(() => {
    if (!catalog) return [];
    return Array.from(
      new Set(
        catalog.products.map((product) => product.category || "Sem categoria"),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [catalog]);

  const dashboardMetrics = useMemo(() => {
    if (!catalog) return null;
    let attention = 0;
    let inCd = 0;
    let blocked = 0;

    catalog.products.forEach((product) => {
      const signal = operationalSignal(product);
      if (signal.tone === "warning" || signal.tone === "danger") attention += 1;
      if (
        product.stores.some(
          (store) => store.key === "cd" && (store.stock ?? 0) > 0,
        )
      )
        inCd += 1;
      if (product.stores.some((store) => store.status.includes("Bloqueado")))
        blocked += 1;
    });

    return { attention, inCd, blocked };
  }, [catalog]);

  const dashboardProducts = useMemo(() => {
    if (!catalog) return [];
    const term = normalize(query);
    const digits = query.replace(/\D/g, "");

    return catalog.products
      .filter(
        (product) =>
          category === "Todos" ||
          (product.category || "Sem categoria") === category,
      )
      .filter((product) => {
        if (!term) return true;
        const name = normalize(product.name);
        return (
          (digits && product.ean.includes(digits)) ||
          product.id.includes(query.trim()) ||
          term.split(" ").every((part) => name.includes(part))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [catalog, category, query]);

  useEffect(() => {
    setPage(1);
  }, [category, query]);

  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(dashboardProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = dashboardProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleDetected = useCallback(
    (value: string) => {
      if (!catalog) return;
      const code = value.replace(/\D/g, "");
      const product = catalog.products.find((item) => item.ean === code);
      if (product) chooseProduct(product);
      else setQuery(code);
    },
    [catalog, chooseProduct],
  );

  async function requestSync() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const rawPayload: unknown = await response.json();
      const payload =
        typeof rawPayload === "object" && rawPayload !== null
          ? (rawPayload as { message?: unknown })
          : {};
      setSyncMessage(
        (typeof payload.message === "string" ? payload.message : null) ??
          (response.ok
            ? "Atualização concluída."
            : "Não foi possível atualizar."),
      );
    } catch {
      setSyncMessage(
        "Não foi possível iniciar a atualização. A base atual foi preservada.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const metrics = useMemo(() => {
    if (!selected) return null;
    const totalStock = selected.stores.reduce(
      (sum, store) => sum + (store.stock ?? 0),
      0,
    );
    const cd = selected.stores.find((store) => store.key === "cd");
    const blocked = selected.stores.filter((store) =>
      store.status.includes("Bloqueado"),
    ).length;
    const belowAlert = selected.stores.filter(
      (store) =>
        store.status === "Desbloqueado" &&
        store.stock !== null &&
        store.alertLevel !== null &&
        store.stock <= store.alertLevel,
    ).length;
    const prices = selected.stores.flatMap((store) =>
      store.finalPrice === null ? [] : [store.finalPrice],
    );
    const averagePrice = prices.length
      ? prices.reduce((sum, price) => sum + price, 0) / prices.length
      : null;
    const averageMargin =
      selected.cost && averagePrice
        ? ((averagePrice - selected.cost) / averagePrice) * 100
        : null;
    return {
      totalStock,
      cdStock: cd?.stock ?? null,
      blocked,
      belowAlert,
      averagePrice,
      averageMargin,
    };
  }, [selected]);

  const signal = selected ? operationalSignal(selected) : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Consultor IHM">
          <span className="brand-mark">
            <Barcode size={23} strokeWidth={2.2} />
          </span>
          <span>Consultor</span>
        </div>
        <button className="data-status" onClick={() => setSyncOpen(true)}>
          <span className="status-dot" />
          <span className="data-status-copy">
            <strong>
              {catalog
                ? `${catalog.productCount.toLocaleString("pt-BR")} produtos`
                : "Carregando base"}
            </strong>
            <small>
              {catalog
                ? `Atualizada ${formatDate(catalog.generatedAt)}`
                : "Aguarde"}
            </small>
          </span>
          <ChevronRight size={17} />
        </button>
      </header>

      {offline && (
        <div className="offline-banner" role="status">
          <WifiOff size={16} /> Você está sem internet. Exibindo a última base
          disponível.
        </div>
      )}

      <section className="search-section" aria-labelledby="search-title">
        <div className="search-copy">
          <p className="eyebrow">Consulta de produtos</p>
          <h1 id="search-title">O que você quer conferir?</h1>
          <p>Leia o código de barras ou pesquise pelo nome, EAN ou ID.</p>
        </div>
        <div className="search-wrap">
          <Search className="search-icon" size={21} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0])
                chooseProduct(results[0]);
            }}
            className="search-input"
            placeholder="Ex.: leite integral ou 789…"
            aria-label="Pesquisar produto"
            autoComplete="off"
            inputMode="search"
          />
          {query && (
            <button
              className="clear-search"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
            >
              <X size={17} />
            </button>
          )}
          <Button className="camera-button" onClick={() => setCameraOpen(true)}>
            <Camera size={19} /> <span>Ler código</span>
          </Button>

          {query.trim() && (
            <div className="search-results" role="listbox">
              {results.length ? (
                results.map((product) => (
                  <button
                    key={`${product.ean}-${product.id}`}
                    onClick={() => chooseProduct(product)}
                  >
                    <span className="result-thumb">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" />
                      ) : (
                        <Boxes size={20} />
                      )}
                    </span>
                    <span className="result-copy">
                      <strong>{product.name}</strong>
                      <small>
                        EAN {product.ean || "não informado"} · ID{" "}
                        {product.id || "não encontrado"}
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))
              ) : (
                <div className="no-result">
                  <AlertTriangle size={19} />
                  <span>
                    <strong>Nenhum produto encontrado.</strong> Confira o código
                    ou tente outro nome.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {!catalog ? (
        <section className="loading-card" aria-live="polite">
          <RefreshCw className="spin" size={22} /> Carregando a última base
          validada…
        </section>
      ) : selected && metrics && signal ? (
        <>
          <div className="detail-toolbar">
            <button
              className="back-button"
              onClick={() => {
                setSelected(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <ArrowLeft size={17} /> Voltar para todos os produtos
            </button>
          </div>
          <section className="product-card">
            <div className="product-identity">
              <div className="product-image">
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt={selected.name} />
                ) : (
                  <Boxes size={34} />
                )}
              </div>
              <div className="product-copy">
                <div className="product-labels">
                  <Badge variant="outline">
                    {selected.category || "Sem categoria"}
                  </Badge>
                  <span className={`signal-pill ${signal.tone}`}>
                    {signal.label}
                  </span>
                </div>
                <h2>{selected.name}</h2>
                <p>
                  EAN {selected.ean || "não informado"} <span>·</span> ID{" "}
                  {selected.id || "não encontrado"}
                </p>
              </div>
            </div>

            <div className={`decision-note ${signal.tone}`}>
              {signal.tone === "ok" ? (
                <Check size={19} />
              ) : (
                <AlertTriangle size={19} />
              )}
              <div>
                <strong>{signal.label}</strong>
                <p>
                  {signal.text} Este sinal apoia a conferência e ainda não é uma
                  recomendação automática de compra.
                </p>
              </div>
            </div>
          </section>

          <section className="metric-grid" aria-label="Resumo do produto">
            <article>
              <span className="metric-icon cost">
                <CircleDollarSign size={20} />
              </span>
              <div>
                <small>Último custo</small>
                <strong>
                  {selected.cost === null
                    ? "Não informado"
                    : currency.format(selected.cost)}
                </strong>
              </div>
            </article>
            <article>
              <span className="metric-icon stock">
                <Boxes size={20} />
              </span>
              <div>
                <small>Estoque total</small>
                <strong>
                  {metrics.totalStock.toLocaleString("pt-BR")} un.
                </strong>
              </div>
            </article>
            <article>
              <span className="metric-icon cd">
                <PackageCheck size={20} />
              </span>
              <div>
                <small>Estoque no CD</small>
                <strong>
                  {metrics.cdStock === null
                    ? "Não consta"
                    : `${metrics.cdStock} un.`}
                </strong>
              </div>
            </article>
            <article>
              <span className="metric-icon alerts">
                <AlertTriangle size={20} />
              </span>
              <div>
                <small>Abaixo do alerta</small>
                <strong>{metrics.belowAlert} mercados</strong>
              </div>
            </article>
          </section>

          <section className="market-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Comparação por local</p>
                <h2>Estoque, preço e situação</h2>
              </div>
              <div className="section-summary">
                <span>
                  <strong>{selected.stores.length}</strong> locais
                </span>
                <span>
                  <strong>{metrics.blocked}</strong> bloqueados
                </span>
                <span>
                  <strong>
                    {metrics.averageMargin === null
                      ? "—"
                      : `${metrics.averageMargin.toFixed(1)}%`}
                  </strong>{" "}
                  margem média
                </span>
              </div>
            </div>

            <div className="market-table-wrap">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Local</th>
                    <th>Situação</th>
                    <th>Estoque</th>
                    <th>Padrão / alerta</th>
                    <th>Preço final</th>
                    <th>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.stores.map((store) => {
                    const margin =
                      selected.cost && store.finalPrice
                        ? ((store.finalPrice - selected.cost) /
                            store.finalPrice) *
                          100
                        : null;
                    const low =
                      store.status === "Desbloqueado" &&
                      store.stock !== null &&
                      store.alertLevel !== null &&
                      store.stock <= store.alertLevel;
                    return (
                      <tr key={store.key}>
                        <td data-label="Local">
                          <strong>{store.name}</strong>
                          {store.key === "cd" && (
                            <small>Centro de distribuição</small>
                          )}
                        </td>
                        <td data-label="Situação">
                          <span
                            className={`status-badge ${statusTone(store.status)}`}
                          >
                            {store.status}
                          </span>
                        </td>
                        <td data-label="Estoque">
                          <strong className={low ? "low-value" : ""}>
                            {store.stock === null ? "—" : store.stock}
                          </strong>
                          {low && <small className="low-note">No alerta</small>}
                        </td>
                        <td data-label="Padrão / alerta">
                          <span>
                            {store.standardQty ?? "—"} /{" "}
                            {store.alertLevel ?? "—"}
                          </span>
                        </td>
                        <td data-label="Preço final">
                          <span>
                            {store.finalPrice === null
                              ? "—"
                              : currency.format(store.finalPrice)}
                          </span>
                        </td>
                        <td data-label="Margem">
                          <span>
                            {margin === null ? "—" : `${margin.toFixed(1)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {selected.stores.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        Este EAN não consta nos planogramas importados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : catalog && dashboardMetrics ? (
        <section className="dashboard" aria-labelledby="dashboard-title">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Visão geral</p>
              <h2 id="dashboard-title">Catálogo de produtos</h2>
              <p>
                Selecione um item para conferir estoque, custo, margem e situação
                em cada mercado.
              </p>
            </div>
            <span className="dashboard-updated">
              Base de {formatDate(catalog.generatedAt)}
            </span>
          </div>

          <div className="dashboard-metrics" aria-label="Resumo do catálogo">
            <article>
              <span className="dashboard-metric-icon products">
                <PackageSearch size={21} />
              </span>
              <div>
                <strong>{catalog.productCount.toLocaleString("pt-BR")}</strong>
                <small>produtos cadastrados</small>
              </div>
            </article>
            <article>
              <span className="dashboard-metric-icon categories">
                <Tags size={21} />
              </span>
              <div>
                <strong>{categories.length.toLocaleString("pt-BR")}</strong>
                <small>categorias</small>
              </div>
            </article>
            <article>
              <span className="dashboard-metric-icon attention">
                <AlertTriangle size={21} />
              </span>
              <div>
                <strong>{dashboardMetrics.attention.toLocaleString("pt-BR")}</strong>
                <small>pedem conferência</small>
              </div>
            </article>
            <article>
              <span className="dashboard-metric-icon available">
                <PackageCheck size={21} />
              </span>
              <div>
                <strong>{dashboardMetrics.inCd.toLocaleString("pt-BR")}</strong>
                <small>com saldo no CD</small>
              </div>
            </article>
          </div>

          <div className="catalog-panel">
            <div className="catalog-toolbar">
              <div>
                <span className="catalog-title">
                  <LayoutDashboard size={18} /> Todos os produtos
                </span>
                <small>
                  {dashboardProducts.length.toLocaleString("pt-BR")} encontrados
                </small>
              </div>
              <label className="category-filter">
                <span>Categoria</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="Todos">Todas</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visibleProducts.length ? (
              <div className="catalog-list">
                {visibleProducts.map((product) => {
                  const productSignal = operationalSignal(product);
                  const stock = product.stores.reduce(
                    (sum, store) => sum + (store.stock ?? 0),
                    0,
                  );
                  return (
                    <button
                      className="catalog-row"
                      key={`${product.ean}-${product.id}`}
                      onClick={() => chooseProduct(product)}
                    >
                      <span className="catalog-thumb">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" />
                        ) : (
                          <Boxes size={22} />
                        )}
                      </span>
                      <span className="catalog-product-copy">
                        <strong>{product.name}</strong>
                        <small>
                          {product.category || "Sem categoria"} · EAN{" "}
                          {product.ean || "não informado"}
                        </small>
                      </span>
                      <span className="catalog-number">
                        <small>Custo</small>
                        <strong>
                          {product.cost === null
                            ? "—"
                            : currency.format(product.cost)}
                        </strong>
                      </span>
                      <span className="catalog-number">
                        <small>Estoque total</small>
                        <strong>{stock.toLocaleString("pt-BR")} un.</strong>
                      </span>
                      <span className={`signal-pill ${productSignal.tone}`}>
                        {productSignal.label}
                      </span>
                      <ChevronRight className="catalog-chevron" size={19} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="catalog-empty">
                <PackageSearch size={28} />
                <strong>Nenhum produto encontrado</strong>
                <span>Altere a busca ou selecione outra categoria.</span>
              </div>
            )}

            {dashboardProducts.length > pageSize && (
              <div className="catalog-pagination">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <span>
                  Página <strong>{currentPage}</strong> de {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <footer>
        <ShieldCheck size={17} /> A base anterior é preservada quando uma
        atualização apresenta erro.
      </footer>

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetected={handleDetected}
      />

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="sync-dialog">
          <DialogHeader>
            <DialogTitle>Base de dados</DialogTitle>
            <DialogDescription>
              O Consultor trabalha com uma cópia validada para manter as
              consultas rápidas e reduzir chamadas ao Google.
            </DialogDescription>
          </DialogHeader>
          <div className="sync-summary">
            <span>
              <Database size={20} />
            </span>
            <div>
              <strong>
                {catalog?.productCount.toLocaleString("pt-BR") ?? "—"} produtos
              </strong>
              <small>
                {catalog?.marketCount ?? "—"} locais ·{" "}
                {catalog ? formatDate(catalog.generatedAt) : "Carregando"}
              </small>
            </div>
          </div>
          <div className="sync-source">
            <p>
              <Store size={17} /> Fontes monitoradas
            </p>
            <span>
              {catalog?.sourceFiles.join(", ") ?? "produtos.xlsx e planogramas"}
            </span>
          </div>
          {syncMessage && (
            <div className="sync-message" role="status">
              {syncMessage}
            </div>
          )}
          <Button
            className="sync-button"
            onClick={requestSync}
            disabled={syncing}
          >
            <RefreshCw className={syncing ? "spin" : ""} size={18} />
            {syncing ? "Verificando…" : "Atualizar dados agora"}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
