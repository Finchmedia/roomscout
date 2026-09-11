import * as React from "react"

import { cn } from "@/lib/utils"

function Marker({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="marker" className={cn("flex w-full items-center gap-[var(--space-3)] text-center text-[length:var(--text-caption-sm-size)] text-rs-ink-6 before:h-px before:min-w-0 before:flex-1 before:bg-rs-border-divider after:h-px after:min-w-0 after:flex-1 after:bg-rs-border-divider", className)} {...props} />
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="marker-content" className={cn("min-w-0 flex-none break-words", className)} {...props} />
}

export { Marker, MarkerContent }
