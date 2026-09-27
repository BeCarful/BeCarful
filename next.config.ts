import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: { position: "bottom-right" },
  // ADK has optional peer deps (express, MCP, SQL ORMs) it only loads on demand; let Node resolve it at runtime.
  serverExternalPackages: ["@google/adk", "@google-cloud/storage"],
};

export default nextConfig;
