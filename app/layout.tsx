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
    <html lang="es" className={cn("dark font-sans", geist.variable, geistMono.variable)}>
      <body>{children}</body>
    </html>
  )
}
