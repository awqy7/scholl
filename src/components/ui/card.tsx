import { cn } from "@/lib/utils"
import type { HTMLAttributes } from "react"

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card text-[var(--aria-text)]", className)} {...props} />
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1 p-6 pb-4", className)} {...props} />
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-semibold text-base tracking-tight", className)}
      style={{ color: "var(--aria-text)" }}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm", className)} style={{ color: "var(--aria-text-muted)" }} {...props} />
  )
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }