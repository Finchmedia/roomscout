import type { MarketSignal } from "../../mocks/demoData";

const verificationLabels: Record<MarketSignal["verification"], string> = {
  observed: "Observed",
  source_verified: "Source verified",
  user_verified: "User verified",
};

export function SignalBadge({ signal }: { signal: MarketSignal }) {
  return (
    <span className={`type t-${signal.side}`}>
      {signal.side === "supply" ? "Supply" : "Demand"} · {verificationLabels[signal.verification]}
    </span>
  );
}

export function Freshness({ signal }: { signal: MarketSignal }) {
  return (
    <span className={`mono rs-freshness rs-freshness--${signal.freshness}`}>
      <span aria-hidden="true" className={signal.freshness === "fresh" ? "dot dot-pulse" : "dot"} />
      {signal.freshnessLabel}
    </span>
  );
}
