import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Acme Travel — Fiat Checkout',
  description:
    'Pay a merchant by card via Stripe, in the browser, with no Nevermined account — powered by the Nevermined Orders flow.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
