import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { ThemeProvider } from '@/lib/ThemeContext'
import { LangProvider } from '@/lib/LangContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({
  subsets: ['latin'],
  display: 'optional',
  preload: true,
  fallback: ['system-ui', 'arial'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#003DA6',
}

export const metadata: Metadata = {
  title: {
    default: 'Memorabilius — La plateforme des collectionneurs de cartes',
    template: '%s | Memorabilius',
  },
  description: 'Gérez et partagez votre collection de cartes de sport en 3D. Galeries interactives, annuaire des collectionneurs, trades et teams.',
  keywords: ['cartes de sport', 'collection', 'NBA', 'galerie 3D', 'trade', 'collectionneurs', 'panini', 'prizm'],
  authors: [{ name: 'Memorabilius' }],
  creator: 'Memorabilius',
  metadataBase: new URL('https://www.memorabilius.fr'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Memorabilius',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://www.memorabilius.fr',
    siteName: 'Memorabilius',
    title: 'Memorabilius — La plateforme des collectionneurs de cartes',
    description: 'Gérez et partagez votre collection de cartes de sport en 3D.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Memorabilius' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Memorabilius — La plateforme des collectionneurs de cartes',
    description: 'Gérez et partagez votre collection de cartes de sport en 3D.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <ThemeProvider>
          <LangProvider>
            <Navbar />
            <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px' }}>
              {children}
            </main>
            <Footer />
          </LangProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
