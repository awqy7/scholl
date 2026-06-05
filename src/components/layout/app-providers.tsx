"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { ChatProvider } from "@/lib/chat-context"
import { EscolaProvider } from "@/lib/escola-context"
import { AriaFloatingButton } from "@/components/dashboard/aria-floating-button"

const ComandoCentral = dynamic(
  () =>
    import("@/components/dashboard/comando-central").then((m) => ({
      default: m.ComandoCentral,
    })),
  { ssr: false }
)

function ComandoCentralGate() {
  const pathname = usePathname()
  if (pathname === "/login" || pathname?.startsWith("/auth")) return null

  return (
    <>
      <AriaFloatingButton />
      <ComandoCentral />
    </>
  )
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <EscolaProvider>
      <ChatProvider>
        {children}
        <ComandoCentralGate />
      </ChatProvider>
    </EscolaProvider>
  )
}