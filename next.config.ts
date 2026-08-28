import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  serverExternalPackages: ["playwright-extra", "puppeteer-extra-plugin-stealth"],
};

export default nextConfig;
