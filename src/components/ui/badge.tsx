import { cn } from "@/lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "success" | "warning" | "danger" | "outline"
  className?: string
  style?: React.CSSProperties
}

function Badge({ children, variant = "default", className, style }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-indigo-500/25 text-indigo-200 border border-indigo-500/30",
    success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-200 border border-amber-500/30",
    danger: "bg-red-500/20 text-red-300 border border-red-500/30",
    outline: "border border-indigo-400/40 text-indigo-200 bg-indigo-950/30",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      style={style}
    >
      {children}
    </span>
  )
}
export { Badge }