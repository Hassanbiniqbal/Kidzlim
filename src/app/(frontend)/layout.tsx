import type { Metadata } from 'next'
import { Bricolage_Grotesque, Inter, Schibsted_Grotesk } from 'next/font/google'
import React from 'react'

import { CartProvider } from '@/components/cart/CartProvider'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import '@/styles/brand.css'
import './styles.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-inter' })
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], weight: ['500'], variable: '--font-schibsted' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
  title: {
    default: 'Kidzlim | Islamic Books for Kids',
    template: '%s | Kidzlim',
  },
  description:
    'Islamic children’s books from Kidzlim — beautifully printed and delivered, or downloaded instantly as PDF. Stories that nurture faith, character and curiosity.',
  icons: { icon: '/favicon.ico', apple: '/brand/kidzlim-mascot.png' },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${schibsted.variable} ${bricolage.variable}`}>
      <body>
        <a href="#main" className="k-skip">
          Skip to content
        </a>
        <CartProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  )
}
