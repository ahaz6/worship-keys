import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Worship Keys",
    short_name: "Worship Keys",
    description: "Play Sound Wall Pads with a Web MIDI keyboard directly in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090c",
    theme_color: "#09090c",
    orientation: "any",
    categories: ["music", "utilities"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
