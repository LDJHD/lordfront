import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'THE LORD GAMES', description: 'Les jeux qui rapprochent' }
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html> }
