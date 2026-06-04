import { cn } from "@/lib/utils"
import * as React from "react"

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "w-full flex-1 rounded-md bg-background py-1.5 text-sm text-foreground transition outline-none placeholder:text-muted-foreground",
      className
    )}
    {...props}
  />
))
