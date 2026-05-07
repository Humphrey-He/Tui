/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    proxy: {
      "/api": {
        target: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
};

export default nextConfig;
