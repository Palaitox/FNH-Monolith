import type { Metadata } from 'next'
import './globals.css'
import { Geist, Geist_Mono } from "next/font/google"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'FNH',
  description: 'Fundación Nuevo Horizonte — Sistema de gestión',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable, geistMono.variable)} suppressHydrationWarning>
      {/*
        Inline script runs before first paint — reads localStorage and applies
        the correct theme class without a flash. Falls back to dark mode.
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
