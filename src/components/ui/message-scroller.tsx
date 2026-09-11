import * as React from "react"
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"
import { ArrowDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>
) {
  return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn("group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

function MessageScrollerViewport({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn("size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]", className)}
      {...props}
    />
  )
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-[var(--space-7)]", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({ className, scrollAnchor = false, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  )
}

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  render,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      direction={direction}
      className={cn(
        "absolute inset-x-1/2 z-10 -translate-x-1/2 transition-[translate,scale,opacity] duration-[var(--duration-quick)]",
        "data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0",
        "data-[direction=end]:bottom-[var(--space-5)] data-[direction=start]:top-[var(--space-5)] data-[direction=start]:[&_svg]:rotate-180",
        className
      )}
      render={render ?? <Button variant="secondary" size="icon-sm" />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon aria-hidden="true" />
          <span className="sr-only">{direction === "end" ? "Zu den neuesten Nachrichten" : "Zum Anfang"}</span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  // Hooks are part of the official primitive escape-hatch API. They are not
  // components, so the refresh lint rule needs the same explicit exception as
  // exported cva helpers in the rest of this UI directory.
  // eslint-disable-next-line react-refresh/only-export-components
  useMessageScroller,
  // eslint-disable-next-line react-refresh/only-export-components
  useMessageScrollerScrollable,
  // eslint-disable-next-line react-refresh/only-export-components
  useMessageScrollerVisibility,
}
