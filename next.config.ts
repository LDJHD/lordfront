import type { NextConfig } from 'next'
 
// On Netlify/CI, use the default `.next` directory.
// Locally, keep `.next-local` to avoid Windows file-locking conflicts.
const isCI = process.env.CONTINUOUS_INTEGRATION === 'true'
 
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: isCI ? undefined : '.next-local',
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