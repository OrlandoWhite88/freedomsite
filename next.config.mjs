/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['*'], // Allow all image domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Double wildcard to match any hostname, including subdomains
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  experimental: {
    largePageDataBytes: 128 * 1000 * 1000, // 128 MB
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
  serverRuntimeConfig: {
    timeoutSeconds: 60, // 60 seconds timeout
  },
  // Add headers to allow all cross-origin requests
  async headers() {
    return [
      {
        source: '/api/proxy/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' }, // Override any frame restrictions
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ];
  },
};

export default nextConfig;