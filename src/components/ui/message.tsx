import * as React from "react"

import { cn } from "@/lib/utils"

function Message({ className, align = "start", ...props }: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return <div data-slot="message" data-align={align} className={cn("group/message relative flex w-full min-w-0 gap-[var(--space-3)] data-[align=end]:flex-row-reverse", className)} {...props} />
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-content" className={cn("flex w-full min-w-0 flex-col gap-[var(--space-2)] break-words group-data-[align=end]/message:items-end", className)} {...props} />
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-header" className={cn("text-[length:var(--text-micro-size)] text-rs-ink-6 group-data-[align=end]/message:text-right", className)} {...props} />
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-footer" className={cn("text-[length:var(--text-micro-size)] text-rs-ink-6 group-data-[align=end]/message:text-right", className)} {...props} />
}

export { Message, MessageContent, MessageHeader, MessageFooter }
