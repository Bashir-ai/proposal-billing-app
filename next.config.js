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
    // Externalize puppeteer and chromium for serverless
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'puppeteer-core': 'commonjs puppeteer-core',
        'puppeteer': 'commonjs puppeteer',
        '@sparticuz/chromium': 'commonjs @sparticuz/chromium',
      })
    }
    return config
  },
}

module.exports = nextConfig
