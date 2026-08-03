import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Worship Keys",
  description: "Play the room, see the harmony, prepare the next moment.",
  applicationName: "Worship Keys",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%230b0a18'/%3E%3Ccircle cx='32' cy='32' r='28' fill='none' stroke='%237667d2' stroke-width='3'/%3E%3Ctext x='32' y='39' text-anchor='middle' font-family='monospace' font-size='21' font-weight='700' fill='%23c8c0ff'%3EWK%3C/text%3E%3C/svg%3E",
  },
  // app/icon.png and app/apple-icon.png are picked up automatically; both are
  // cropped to the emblem so the mark stays readable at 16 px.
};

export const viewport: Viewport = {
  themeColor: "#09090c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
