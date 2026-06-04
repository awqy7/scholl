"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { ChatProvider } from "@/lib/chat-context"

const ComandoCentral = dynamic(
  () => import("@/components/dashboard/comando-central").then((m) => m.ComandoCentral),
  { ssr: false }
)

function ComandoCentralGate() {
  const pathname = usePathname()
  if (pathname === "/login") return null
  return <ComandoCentral />
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <ComandoCentralGate />
    </ChatProvider>
  )
}