import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/pads/manifest.json",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }],
      },
    ];
  },
  reactStrictMode: true,
  // The local live session serves musician iPads from the host's LAN address,
  // so dev-time asset requests legitimately arrive from other origins.
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.local", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
};

export default nextConfig;
