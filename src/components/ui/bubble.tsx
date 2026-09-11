import * as React from "react"

import { cn } from "@/lib/utils"

function Bubble({ className, align = "start", ...props }: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return <div data-slot="bubble" data-align={align} className={cn("group/bubble relative flex w-fit max-w-[88%] min-w-0 flex-col data-[align=end]:self-end", className)} {...props} />
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="bubble-content" className={cn("w-fit max-w-full min-w-0 overflow-hidden break-words whitespace-pre-wrap rounded-[var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble-tail)] bg-rs-surface-subtle-2 px-[var(--space-6)] py-[var(--space-4)] text-[length:var(--text-body-sm-size)] leading-[1.45] text-rs-ink group-data-[align=end]/bubble:rounded-[var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble-tail)_var(--radius-bubble)] group-data-[align=end]/bubble:border group-data-[align=end]/bubble:border-rs-border-accent-soft group-data-[align=end]/bubble:bg-rs-rust", className)} {...props} />
}

export { Bubble, BubbleContent }
