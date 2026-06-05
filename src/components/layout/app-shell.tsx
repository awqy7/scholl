"use client"

import { AuthGuard } from "@/components/layout/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="aria-app">
        <Sidebar />
        <main className="aria-main">
          <div className="aria-main-inner animate-slide-up">{children}</div>
        </main>
      </div>
    </AuthGuard>
  )
}