import { cn } from "@/lib/utils"
import type { SelectHTMLAttributes } from "react"

function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-lg border border-indigo-500/30 bg-indigo-950/55 px-3 py-2 text-sm text-slate-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
Select.displayName = "Select"
export { Select }