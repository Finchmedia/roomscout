const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatAge(timestamp: number | undefined) {
  if (timestamp === undefined) return "Never";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relativeTime.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function toneForStatus(status: string) {
  if (
    status === "healthy" ||
    status === "active" ||
    status === "processed" ||
    status === "delivered" ||
    status === "approved" ||
    status === "replied"
  ) {
    return "new";
  }
  if (
    status === "failed" ||
    status === "failing" ||
    status === "degraded" ||
    status === "error" ||
    status === "bounced" ||
    status === "rejected" ||
    status === "complained"
  ) {
    return "warn";
  }
  return "";
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
