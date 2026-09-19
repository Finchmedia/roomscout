import { Shimmer } from "@/components/ai-elements/shimmer"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Spinner } from "@/components/ui/spinner"

interface ScoutThinkingIndicatorProps {
  label: string
  text: string
}

/** One shared pending line for text and voice Scout conversations. */
function ScoutThinkingIndicator({ label, text }: ScoutThinkingIndicatorProps) {
  return (
    <Marker role="status" aria-label={label}>
      <MarkerIcon><Spinner role={undefined} aria-label={undefined} /></MarkerIcon>
      <MarkerContent>
        <Shimmer as="span">{text}</Shimmer>
      </MarkerContent>
    </Marker>
  )
}

export { ScoutThinkingIndicator }
