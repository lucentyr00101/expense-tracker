import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { TimezoneCookie } from "@/components/timezone-cookie";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Pursely", template: "%s · Pursely" },
  description: "Track daily expenses and income, set budgets, and see where your money goes.",
  // Search Console ownership proof for the Google OAuth branding page.
  verification: { google: "HpEYBuoAYjQIzebFQ0ncemNegruVD64vubsV0vuMCVM" },
};

export const viewport: Viewport = { themeColor: "#fbf7f0" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <TimezoneCookie />
        {children}
      </body>
    </html>
  );
}
