import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-browser packages out of the webpack bundle so their native
  // binaries are require()d at runtime instead of being (incorrectly) bundled.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],
};

export default nextConfig;
