import type { NextConfig } from "next";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const configDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: join(configDir),
  },
};

export default nextConfig;
