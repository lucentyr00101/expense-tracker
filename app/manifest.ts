import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pursely",
    short_name: "Pursely",
    description: "Track daily expenses and income, set budgets, and see where your money goes.",
    // proxy.ts sends signed-out users from here to the sign-in page.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f0",
    theme_color: "#fbf7f0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
