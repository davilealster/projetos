import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Feijuca PDS | Listas e Reservas",
  description:
    "Gestão de lista VIP, reservas de bistrô e lounges da Feijuca do Papo de Samba.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Feijuca PDS",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="pds-bg min-h-dvh antialiased">{children}</body>
    </html>
  );
}
