import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaChrome } from "@/components/PwaChrome";

export const metadata: Metadata = {
  title: "Nasz Budżet",
  description: "Wspólny budżet domowy — bezpiecznie do wydania",
  applicationName: "Nasz Budżet",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nasz Budżet",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2d6a4f" },
    { media: "(prefers-color-scheme: dark)", color: "#2d6a4f" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="min-h-dvh antialiased">
        <PwaChrome>{children}</PwaChrome>
      </body>
    </html>
  );
}
