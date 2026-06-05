import { cn } from "@/lib/utils"
import type { InputHTMLAttributes } from "react"

function Input({ className, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn("field-base h-10", className)}
      {...props}
    />
  )
}
Input.displayName = "Input"
export { Input }