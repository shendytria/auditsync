// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AuditSync Bintang Toedjoe',
  description: 'Sistem E-Audit',
  icons: {
    icon: '/logoOnly.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      {}
      <body className="font-arial bg-gradient-to-b from-biru to-hijau min-h-screen">
        {children}
      </body>
    </html>
  )
}