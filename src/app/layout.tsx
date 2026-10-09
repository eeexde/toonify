import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppNav } from "@/components/AppNav";
import { StaleBanner } from "@/components/StaleBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Toonify", template: "%s · Toonify" },
  description: "A fast, mobile-first manhwa reader.",
  applicationName: "Toonify",
  appleWebApp: { capable: true, title: "Toonify", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d0d12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <Providers>
          <AppNav />
          <StaleBanner />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 md:pb-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
