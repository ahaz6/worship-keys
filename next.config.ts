import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The local live session serves musician iPads from the host's LAN address,
  // so dev-time asset requests legitimately arrive from other origins.
  allowedDevOrigins: ["*.local", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
};

export default nextConfig;
