/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic configuration
  reactStrictMode: true,
  
  // Output for Docker
  output: 'standalone',
  
  // TypeScript
  typescript: {
    ignoreBuildErrors: true
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable automatic package installation
  onDemandEntries: {
    // Disable automatic npm installs
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Force Yarn usage
  distDir: '.next',
  
  // Image optimization
  images: {
    domains: ['localhost', 'ultraweb.ai', 'ultrawebthinking.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Experimental features
  experimental: {
    optimizePackageImports: ['framer-motion', 'class-variance-authority']
  },
  
  // Page extensions
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // ========== UNIFIED ROUTING CONFIGURATION ==========
  env: {
    // UNIFIED SINGLE PORT ARCHITECTURE
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? 'https://ultrawebthinking.com/api' 
      : 'http://127.0.0.1:3000/api',
    
    NEXT_PUBLIC_BASE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://ultrawebthinking.com' 
      : 'http://127.0.0.1:3000',
      
    // Module Internal Paths (No More Port Conflicts!)
    AGI_PATH: '/api/agi',
    NEURAL_PATH: '/api/neural',
    MEDICAL_PATH: '/api/medical',
    SEARCH_PATH: '/api/search',
    SECURITY_PATH: '/api/security',
    INDUSTRIAL_PATH: '/api/industrial',
    NETWORK_PATH: '/api/network',
    QUANTUM_PATH: '/api/quantum',
  },

  async rewrites() {
    return [
      // ========== AI & AGI CORE MODULES ==========
      { source: '/agi/:path*', destination: '/api/agi/:path*' },
      { source: '/agi-demo/:path*', destination: '/api/agi/demo/:path*' },
      { source: '/agi-search-demo/:path*', destination: '/api/agi/search/:path*' },
      { source: '/agi-tunnel/:path*', destination: '/api/agi/tunnel/:path*' },
      { source: '/neural-demo/:path*', destination: '/api/neural/:path*' },
      { source: '/neural-dev/:path*', destination: '/api/neural/dev/:path*' },
      { source: '/neural-acceleration/:path*', destination: '/api/neural/acceleration/:path*' },
      { source: '/openmind-chat/:path*', destination: '/api/openmind/chat/:path*' },
      { source: '/openmind-demo/:path*', destination: '/api/openmind/demo/:path*' },
      { source: '/openmind-enhanced/:path*', destination: '/api/openmind/enhanced/:path*' },
      { source: '/cva-demo/:path*', destination: '/api/cva/:path*' },
      
      // ========== ASI SYSTEM MODULES ==========
      { source: '/asi-12layer/:path*', destination: '/api/asi/12layer/:path*' },
      { source: '/asi-dashboard/:path*', destination: '/api/asi/dashboard/:path*' },
      { source: '/asi-ultimate/:path*', destination: '/api/asi/ultimate/:path*' },
      
      // ========== MEDICAL AI SUITE ==========
      { source: '/agimed-professional/:path*', destination: '/api/medical/agimed/:path*' },
      { source: '/albamed-demo/:path*', destination: '/api/medical/albamed/:path*' },
      { source: '/agixbionature-demo/:path*', destination: '/api/medical/bionature/:path*' },
      
      // ========== ECONOMICS & BUSINESS ==========
      { source: '/agixeco-demo/:path*', destination: '/api/economics/agixeco/:path*' },
      { source: '/ultra-saas/:path*', destination: '/api/saas/ultra/:path*' },
      { source: '/saas-dashboard/:path*', destination: '/api/saas/dashboard/:path*' },
      
      // ========== SEARCH & DISCOVERY ==========
      { source: '/neural-search-demo/:path*', destination: '/api/search/neural/:path*' },
      { source: '/real-search-demo/:path*', destination: '/api/search/real/:path*' },
      { source: '/web-search-demo/:path*', destination: '/api/search/web/:path*' },
      
      // ========== PERFORMANCE & INFRASTRUCTURE ==========
      { source: '/ultra-industrial/:path*', destination: '/api/industrial/:path*' },
      { source: '/light-speed-io/:path*', destination: '/api/performance/lightspeed/:path*' },
      { source: '/zero-latency/:path*', destination: '/api/performance/zero-latency/:path*' },
      { source: '/quantum-processing/:path*', destination: '/api/quantum/:path*' },
      { source: '/ultra-speed/:path*', destination: '/api/performance/ultra-speed/:path*' },
      { source: '/time-compression/:path*', destination: '/api/performance/time-compression/:path*' },
      
      // ========== SECURITY & GUARDIAN ==========
      { source: '/guardian-demo/:path*', destination: '/api/security/guardian/:path*' },
      { source: '/advanced-security/:path*', destination: '/api/security/advanced/:path*' },
      { source: '/cyber-security/:path*', destination: '/api/security/cyber/:path*' },
      
      // ========== NETWORK & COMMUNICATION ==========
      { source: '/lora-mesh/:path*', destination: '/api/network/lora/:path*' },
      { source: '/iot-manager/:path*', destination: '/api/network/iot/:path*' },
      { source: '/infinite-bandwidth/:path*', destination: '/api/network/bandwidth/:path*' },
      
      // ========== SPECIALIZED APPLICATIONS ==========
      { source: '/aviation-weather/:path*', destination: '/api/specialized/aviation/:path*' },
      { source: '/radio-propaganda/:path*', destination: '/api/specialized/radio/:path*' },
      { source: '/albion-utt/:path*', destination: '/api/specialized/albion/:path*' },
      { source: '/utt-tools/:path*', destination: '/api/tools/utt/:path*' },
      { source: '/fluid-demo/:path*', destination: '/api/demos/fluid/:path*' },
      { source: '/lazy-demo/:path*', destination: '/api/demos/lazy/:path*' },
      { source: '/revolution/:path*', destination: '/api/revolution/:path*' },
      
      // ========== SYSTEM UTILITIES ==========
      { source: '/browser/:path*', destination: '/api/utilities/browser/:path*' },
      { source: '/overview/:path*', destination: '/api/utilities/overview/:path*' },
      { source: '/api-gateway/:path*', destination: '/api/gateway/:path*' },
      
      // ========== LEGACY COMPATIBILITY ==========
      { source: '/asi-demo/:path*', destination: '/api/asi/demo/:path*' },
      { source: '/gateway/:path*', destination: '/api/gateway/:path*' },
      { source: '/producer/:path*', destination: '/api/producer/:path*' },
    ];
  },
  
  // Keep Next.js default webpack runtime chunking to avoid bootstrap/runtime invariants.
  webpack: (config) => config,

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          }
        ]
      }
    ];
  }
}

export default nextConfig