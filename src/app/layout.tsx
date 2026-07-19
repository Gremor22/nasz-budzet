import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BudgetProvider } from "@/lib/data/budget-context";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Nasz Budżet",
  description: "Wspólny budżet domowy — prototyp lokalny",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2d6a4f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="min-h-dvh antialiased">
        <BudgetProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
            <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
            <BottomNav />
          </div>
        </BudgetProvider>
      </body>
    </html>
  );
}
