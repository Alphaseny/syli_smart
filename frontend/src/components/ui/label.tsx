import { cn } from "@/lib/utils"
import * as React from "react"

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1 block text-sm font-semibold text-secondary-foreground",
        className
      )}
      {...props}
    />
  )
}
