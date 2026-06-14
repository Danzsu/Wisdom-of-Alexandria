import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to the monorepo root so Next does not
  // mis-infer it from an unrelated lockfile elsewhere on the machine.
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),
};

export default nextConfig;
