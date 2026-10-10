import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Big_Shoulders } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppNav, MainFrame } from "@/components/AppNav";
import { StaleBanner } from "@/components/StaleBanner";

const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Big_Shoulders({ subsets: ["latin"], variable: "--font-display-face", axes: ["opsz"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Toonify", template: "%s · Toonify" },
  description: "A fast, mobile-first manhwa reader.",
  applicationName: "Toonify",
  appleWebApp: { capable: true, title: "Toonify", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#15121b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans text-[15px] leading-normal antialiased">
        <a
          href="#main"
          className="sr-only z-[60] rounded-full bg-accent px-4 py-2 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <Providers>
          <AppNav />
          <StaleBanner />
          <MainFrame>{children}</MainFrame>
        </Providers>
      </body>
    </html>
  );
}
