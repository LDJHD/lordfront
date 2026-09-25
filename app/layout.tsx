import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaRegistrar from './pwa-registrar'

export const metadata: Metadata = {
  title: 'THE LORD GAMES',
  description: 'Les jeux qui rapprochent',
  manifest: '/site.webmanifest',
  applicationName: 'Lord Games',
  appleWebApp: {
    capable: true,
    title: 'Lord Games',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#201a2a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PwaRegistrar />
      </body>
    </html>
  )
}
