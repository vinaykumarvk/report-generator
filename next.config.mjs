/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  async redirects() {
    return [
      {
        source: "/template-studio",
        destination: "/reports-studio",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
