import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
  }
>(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants: Record<string, string> = {
    default:
      "bg-[var(--aria-accent)] text-[#050508] hover:brightness-110 shadow-[0_4px_20px_rgba(34,211,238,0.25)] font-medium",
    destructive: "bg-red-600/90 text-white hover:bg-red-500",
    outline:
      "border border-[var(--aria-border-strong)] bg-transparent text-[var(--aria-text)] hover:bg-[var(--aria-surface-hover)]",
    secondary:
      "bg-[var(--aria-violet-soft)] text-[var(--aria-text)] hover:bg-[var(--aria-surface-hover)] border border-[var(--aria-border)]",
    ghost:
      "text-[var(--aria-text-muted)] hover:bg-[var(--aria-surface-hover)] hover:text-[var(--aria-text)]",
    link: "text-[var(--aria-accent)] underline-offset-4 hover:brightness-125",
  }
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-[10px] px-3 text-sm",
    lg: "h-11 rounded-[10px] px-8",
    icon: "h-10 w-10",
  }
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--aria-radius)] text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.4)] disabled:pointer-events-none disabled:opacity-45 cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"
export { Button }