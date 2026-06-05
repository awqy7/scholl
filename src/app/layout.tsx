import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { AppProviders } from "@/components/layout/app-providers"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Escola Inteligente - Gestão Escolar com IA",
  description: "Sistema completo de gestão escolar com inteligência artificial",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
