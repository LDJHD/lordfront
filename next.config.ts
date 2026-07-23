import type { NextConfig } from 'next'

// The previous `.next` cache is locked by Windows on this machine. Keep the
// Next.js build output separate so the development server can start normally.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: '.next-local',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ]
  },
}
export default nextConfig
