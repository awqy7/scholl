"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Brain } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login")
      } else {
        setLoading(false)
      }
    })
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="aria-brand-icon animate-pulse">
          <Brain className="h-5 w-5" strokeWidth={2} />
        </div>
        <p className="text-sm font-medium tracking-wide" style={{ color: "var(--aria-text-muted)" }}>
          ARIA
        </p>
      </div>
    )
  }

  return <>{children}</>
}