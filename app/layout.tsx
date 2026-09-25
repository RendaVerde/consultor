import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consultor | IHM",
  description: "Consulta de produtos, estoques, preços e situação por mercado.",
  applicationName: "Consultor",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b2d34",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
