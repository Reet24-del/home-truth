import type {Metadata} from 'next'
import {Fraunces, IBM_Plex_Mono, Inter_Tight} from 'next/font/google'
import Link from 'next/link'

import {Logo} from '@/components/Logo'

import './globals.css'

// A warm editorial serif for headlines, a typewriter face for anything quoted
// from a document. Nothing in this product should look like a dashboard.
const display = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

// Thin and wide for the one line of type that has to hold a whole screen.
const grotesk = Inter_Tight({
  subsets: ['latin'],
  weight: ['200', '300', '400'],
  variable: '--font-grotesk',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Home Truth',
  description:
    "Check a builder's promises against the RERA registration, your draft agreement and the law, with the exact words each claim comes from.",
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${grotesk.variable}`}>
      <body>
        {/* The room at dusk, behind every page: window light, curtains, shafts, vignette. */}
        <div className="atmosphere" aria-hidden="true">
          <span className="shaft one" />
          <span className="shaft two" />
          <span className="shaft three" />
        </div>
        <div className="grain" aria-hidden="true" />
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              <Logo />
              <span className="wordmark">
                Home <em>Truth</em>
              </span>
            </Link>
            <span className="header-note">Promises, checked against the record</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
