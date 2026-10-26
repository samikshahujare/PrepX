/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
      const cleanBase = apiUrl.replace(/\/api\/v1\/?$/, "");
      return [
        {
          source: "/api/v1/:path*",
          destination: `${cleanBase}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
