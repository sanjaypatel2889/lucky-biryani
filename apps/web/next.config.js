/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'www.themealdb.com' },
      { protocol: 'https', hostname: 'foodish-api.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  async rewrites() {
    const apiBase =
      process.env.API_PROXY_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
