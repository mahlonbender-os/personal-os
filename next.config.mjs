/** @type {import('next').NextConfig} */
const noStoreHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate, max-age=0' },
  { key: 'CDN-Cache-Control', value: 'no-store' },
  { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      { source: '/api/finance/:path*', headers: noStoreHeaders },
      { source: '/api/heloc-shield', headers: noStoreHeaders },
      { source: '/api/home/balances', headers: noStoreHeaders },
      { source: '/api/cc/investments', headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
