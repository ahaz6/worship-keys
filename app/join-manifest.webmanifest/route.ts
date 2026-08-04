import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    id: "/worship-join",
    name: "Worship Join",
    short_name: "Worship Join",
    description: "Join a live Worship Keys session locally or through Cloud Live.",
    start_url: "/join-app",
    scope: "/",
    display: "standalone",
    background_color: "#09090c",
    theme_color: "#09090c",
    orientation: "portrait",
    categories: ["music", "utilities"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  }, {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
