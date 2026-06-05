import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <Loader2
        className="h-7 w-7 animate-spin"
        style={{ color: "var(--aria-accent)" }}
        strokeWidth={1.75}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 opacity-40" style={{ color: "var(--aria-accent)" }}>
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium" style={{ color: "var(--aria-text)" }}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm max-w-sm" style={{ color: "var(--aria-text-muted)" }}>
          {description}
        </p>
      )}
    </div>
  )
}