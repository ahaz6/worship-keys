import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Worship Keys",
  description: "Play the room, see the harmony, prepare the next moment.",
  applicationName: "Worship Keys",
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
