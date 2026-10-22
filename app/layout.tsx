import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { TimezoneCookie } from "@/components/timezone-cookie";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Pursely", template: "%s · Pursely" },
  description: "Track daily expenses and income, set budgets, and see where your money goes.",
  // Launches full screen when added to the iOS home screen.
  appleWebApp: { title: "Pursely", statusBarStyle: "default" },
  // Search Console ownership proof for the Google OAuth branding page.
  verification: { google: "HpEYBuoAYjQIzebFQ0ncemNegruVD64vubsV0vuMCVM" },
};

// viewportFit "cover" makes env(safe-area-inset-*) report the iPhone's rounded corners and home indicator.
export const viewport: Viewport = { themeColor: "#fbf7f0", viewportFit: "cover" };

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
