import type { NextConfig } from 'next'

// Keep a separate build directory locally to avoid Windows file-locking
// conflicts on the default `.next` cache. Netlify is configured via
// `netlify.toml` to publish from this directory.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: '.next-local',
  async headers() {
    return [
      {
        // Le service worker doit toujours être servi frais pour détecter les mises à jour.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
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