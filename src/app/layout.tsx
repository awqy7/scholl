import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import { AppProviders } from "@/components/layout/app-providers"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: "ARIA — Gestão escolar com IA",
  description:
    "ARIA: sistema de gestão escolar com inteligência artificial. Cadastros, grade, faltas e substituições em linguagem natural.",
  applicationName: "ARIA",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={outfit.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}