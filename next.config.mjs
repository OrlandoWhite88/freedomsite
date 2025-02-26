// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['*'], // Allow all image domains
  },
  experimental: {
    largePageDataBytes: 128 * 1000 * 1000, // 128 MB (default is just 128 KB)
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
  // Increase timeout for API routes
  serverRuntimeConfig: {
    timeoutSeconds: 60, // 60 seconds timeout
  },
}

export default nextConfig;