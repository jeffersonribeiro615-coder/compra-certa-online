import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compra Certa Online",
  description: "Ofertas selecionadas do Mercado Livre e da Shopee.",
  manifest: "/manifest.webmanifest",
  themeColor: "#172033",
  appleWebApp: {
    capable: true,
    title: "Compra Certa",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
