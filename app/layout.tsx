import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compra Certa Online",
  description: "Ofertas selecionadas do Mercado Livre e da Shopee."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
