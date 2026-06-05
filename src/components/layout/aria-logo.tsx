"use client"

import Link from "next/link"
import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"

type AriaLogoProps = {
  href?: string
  className?: string
  showName?: boolean
}

/** Marca ARIA — cérebro + nome, alinhada à esquerda. */
export function AriaLogo({ href = "/dashboard", className, showName = true }: AriaLogoProps) {
  const content = (
    <>
      <div className="aria-brand-icon" aria-hidden>
        <Brain className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
      </div>
      {showName && <span className="aria-brand-name">ARIA</span>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn("aria-brand", className)} aria-label="ARIA — início">
        {content}
      </Link>
    )
  }

  return (
    <div className={cn("aria-brand", className)} aria-label="ARIA">
      {content}
    </div>
  )
}