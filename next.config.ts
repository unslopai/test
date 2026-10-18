import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace-Package wird als TS-Quelle konsumiert und muss von Next transpiliert werden.
  transpilePackages: ["@unslop/shared"],
};

export default nextConfig;
