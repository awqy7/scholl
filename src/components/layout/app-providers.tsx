"use client"

import { ChatProvider } from "@/lib/chat-context"
import { ComandoCentral } from "@/components/dashboard/comando-central"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <ComandoCentral />
    </ChatProvider>
  )
}
