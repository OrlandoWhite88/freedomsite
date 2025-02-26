/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['*'], // Allow all image domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    unoptimized: true, // Skip image optimization for faster performance
  },
  experimental: {
    largePageDataBytes: 1024 * 1024 * 1024, // 1 GB (dramatically increased)
    serverComponentsExternalPackages: ['jsdom'], // Allow JSDOM to work correctly
    outputFileTracingExcludes: {
      '*': [
        'node_modules/jsdom/node_modules/**/*',
      ],
    },
  },
  // Unlimited API response size
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
  serverRuntimeConfig: {
    timeoutSeconds: 300, // 5 minutes timeout
  },
  publicRuntimeConfig: {
    noRestrictions: true,
  },
  // Increase buffer limit for large responses
  httpAgentOptions: {
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 300000, // 5 minutes
  },
  // Output standalone build for better performance
  output: 'standalone',
  // Disable static optimization for dynamic content
  staticPageGenerationTimeout: 300,
  // Increase memory limit 
  webpack: (config, { isServer }) => {
    // Increase memory limit for webpack
    if (isServer) {
      config.externals = [...config.externals, 'jsdom']
    }
    
    // Increase resource limits
    config.performance = {
      ...config.performance,
      maxEntrypointSize: 10 * 1024 * 1024, // 10MB
      maxAssetSize: 10 * 1024 * 1024, // 10MB
    }
    
    return config
  },
}

export default nextConfig;