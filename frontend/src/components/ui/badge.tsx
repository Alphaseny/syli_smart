import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[10px] px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-secondary-foreground",

        primary:
          "bg-blue-500 text-white",

        success:
          "bg-green-500 text-white",

        warning:
          "bg-yellow-500 text-black",

        destructive:
          "bg-red-500 text-white",

        info:
          "bg-cyan-500 text-white",

        outline:
          "border border-border bg-transparent",

        purple:
          "bg-purple-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  )
}
