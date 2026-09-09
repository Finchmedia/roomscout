/**
 * `useFlash` — the prototype's `flash(key, value, ms)`: a boolean that turns
 * itself off again (`docs/UI_PORT/SETTINGS_SCREENS.md` §0.4).
 *
 * It drives the „Gespeichert“ confirmations that follow a switch and the
 * „Kopiert“ label on the copy buttons. Its own module so `primitives.tsx` can
 * stay a components-only file (Fast Refresh).
 */

import * as React from "react"

export function useFlash(duration = 1500): [boolean, () => void] {
  const [on, setOn] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  React.useEffect(() => () => clearTimeout(timer.current), [])

  const fire = React.useCallback(() => {
    setOn(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), duration)
  }, [duration])

  return [on, fire]
}
