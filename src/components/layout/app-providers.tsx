"use client"

import dynamic from "next/dynamic"
import { ChatProvider } from "@/lib/chat-context"

const ComandoCentral = dynamic(
  () => import("@/components/dashboard/comando-central").then((m) => m.ComandoCentral),
  { ssr: false }
)

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <ComandoCentral />
    </ChatProvider>
  )
}