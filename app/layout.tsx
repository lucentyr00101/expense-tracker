import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { TimezoneCookie } from "@/components/timezone-cookie";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ledgerly", template: "%s · Ledgerly" },
  description: "Track daily expenses and income, set budgets, and see where your money goes.",
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
