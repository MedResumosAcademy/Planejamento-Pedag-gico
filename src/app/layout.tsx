import type { Metadata } from 'next'
import './globals.css'
import { CycleProvider } from '@/components/CycleProvider'

export const metadata: Metadata = {
  title: 'Med2026 — Gestão de Produção',
  description: 'Gestão dos ciclos Básico e Clínico de Medicina 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><CycleProvider>{children}</CycleProvider></body>
    </html>
  )
}
