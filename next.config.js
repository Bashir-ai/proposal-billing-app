/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are enabled by default in Next.js 14.2+
  // Optimize compilation
  experimental: {
    // Reduce compilation time
    optimizePackageImports: ['lucide-react'],
  },
  // Reduce webpack compilation time
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
