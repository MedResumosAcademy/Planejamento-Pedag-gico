import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Med2026 — Gestão de Produção',
  description: 'Ciclo Básico de Medicina 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
