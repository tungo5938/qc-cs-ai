import type { NextConfig } from "next";

const BACKEND_INTERNAL = process.env.API_BASE_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  images: {
    domains: ["res.cloudinary.com"],
  },
  async rewrites() {
    return [
      {
        source: "/proxy/:path*",
        destination: `${BACKEND_INTERNAL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
