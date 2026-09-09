/**
 * The autopilot pair in the app header: the „Scout ist unterwegs“ badge and the
 * pause control (App.jsx `right={…}`, SCOUT_SCREENS §2.4.1/§2.4.2).
 *
 * Rendered only while the Scout is actually working and the Scout view is on
 * top — the header is otherwise wordmark + avatar.
 */

import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { StatusDot } from "@/components/ui/status-dot";
import { useAppHeaderNarrow } from "@/ui/chrome/AppHeader";
import { useCopy } from "@/ui/copy";

interface ScoutHeaderRightProps {
  paused: boolean;
  onTogglePause: () => void;
}

export function ScoutHeaderRight({ paused, onTogglePause }: ScoutHeaderRightProps) {
  const { t } = useCopy();
  const narrow = useAppHeaderNarrow();

  const badge = paused ? t("scout.chrome.badge.paused") : t("scout.chrome.badge.running");
  const pauseLabel = paused ? t("scout.chrome.pause.resume") : t("scout.chrome.pause.pause");

  return (
    <>
      {/* §2.4.1: the label collapses in narrow chrome, the accessible name does not. */}
      {narrow ? (
        <StatusDot
          tone={paused ? "muted" : "accent"}
          pulse={!paused}
          announce
          aria-label={badge}
        />
      ) : (
        <StatusDot tone={paused ? "muted" : "accent"} pulse={!paused} announce>
          {badge}
        </StatusDot>
      )}
      <IconButton size={narrow ? 38 : 42} label={pauseLabel} onClick={onTogglePause}>
        <Icon name={paused ? "play" : "pause"} size={16} />
      </IconButton>
    </>
  );
}
