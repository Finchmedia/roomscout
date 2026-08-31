import { Info } from "lucide-react";

type CoverageTrustNoticeProps = {
  compact?: boolean;
};

export function CoverageTrustNotice({ compact = false }: CoverageTrustNoticeProps) {
  return (
    <div className={`rs-coverage-trust${compact ? " rs-coverage-trust--compact" : ""}`} role="note">
      <Info aria-hidden="true" size={15} />
      <p><strong>Observed online coverage, not total market availability.</strong> Offline offers and sources that require an unconnected account may be missing.</p>
    </div>
  );
}
