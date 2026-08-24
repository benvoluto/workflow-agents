import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The list used to live at /records. Anyone holding that link still lands.
  async redirects() {
    return [
      { source: '/records', destination: '/grants', permanent: false },
      { source: '/records/:id', destination: '/grants/:id', permanent: false },
    ]
  },
  /* config options here */
};

export default nextConfig;
