import { useQuery } from "convex/react";
import { lazy, Suspense, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { MapMarketSignal } from "../components/map";
import { CoverageTrustNotice } from "../components/coverage/CoverageTrustNotice";
import { PublicHeader } from "../components/navigation/PublicHeader";
import { PageHeader } from "../components/ui/LedgerCard";
import { SelectField } from "../components/ui/SelectField";

const MarketGlobe = lazy(async () => {
  const module = await import("../components/map/MarketGlobe");
  return { default: module.MarketGlobe };
});

type SideFilter = "all" | "supply" | "demand";

function freshnessLabel(lastSeenAt: number, stale = false) {
  if (stale) return "Possibly stale";
  const hours = Math.max(0, Math.floor((Date.now() - lastSeenAt) / 3_600_000));
  if (hours < 1) return "Checked within the hour";
  if (hours < 24) return `Checked ${hours} h ago`;
  return `Checked ${Math.floor(hours / 24)} d ago`;
}

export function MapPage() {
  const areas = useQuery(api.map.listAreas);
  const [city, setCity] = useState("");
  const [side, setSide] = useState<SideFilter>("all");
  const [freshOnly, setFreshOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const pins = useQuery(
    api.map.listPins,
    city
      ? {
          city,
          side: side === "all" ? undefined : side,
          freshOnly,
          verifiedOnly,
          limit: 250,
        }
      : "skip",
  );

  const mapSignals = useMemo<MapMarketSignal[]>(() => {
    if (city && pins) {
      return pins.map((pin) => ({
        id: pin.signalId,
        title: pin.title,
        coordinates: [pin.longitude, pin.latitude],
        side: pin.side,
        locationLabel: [pin.district, pin.city].filter(Boolean).join(", "),
        source: pin.sourceUrl ? "Public source" : "Indexed source",
        freshnessLabel: freshnessLabel(pin.lastSeenAt, pin.status === "stale"),
        summary: `${pin.verification} · ${pin.arrangement} · ${pin.precision === "exact" ? "published exact location" : `approximate ${pin.precision.replace("_", " ")} location`}`,
      }));
    }
    return (areas ?? []).map((area) => ({
      id: `area-${area.city}`,
      title: `${area.city} market area`,
      coordinates: [area.longitude, area.latitude],
      side: area.supplyCount >= area.demandCount ? "supply" : "demand",
      locationLabel: area.city,
      source: "RoomScout market index",
      freshnessLabel: area.lastSignalAt ? freshnessLabel(area.lastSignalAt) : "No freshness data",
      summary: `${area.supplyCount} supply · ${area.demandCount} demand · ${area.verifiedCount} verified`,
    }));
  }, [areas, city, pins]);

  const cityOptions = [
    { value: "", label: "All market areas" },
    ...(areas ?? []).map((area) => ({ value: area.city, label: area.city })),
  ];

  return (
    <>
      <PublicHeader />
      <main className="wrap rs-explore">
        <PageHeader
          eyebrow="Observed public coverage"
          meta={<span className="mono">{mapSignals.length} positioned {city ? "signals" : "markets"}</span>}
          title="RoomScout coverage map"
        />
        <CoverageTrustNotice />
        <div className="tools rs-explore__tools">
          <SelectField ariaLabel="Market city" onValueChange={setCity} options={cityOptions} value={city} />
          <div aria-label="Signal side" className="seg" role="group">
            {(["all", "supply", "demand"] as const).map((value) => (
              <button className={side === value ? "on" : undefined} key={value} onClick={() => setSide(value)} type="button">
                {value.charAt(0).toUpperCase()}{value.slice(1)}
              </button>
            ))}
          </div>
          <button aria-pressed={freshOnly} className={`fchip${freshOnly ? " on" : ""}`} onClick={() => setFreshOnly((value) => !value)} type="button">Fresh only</button>
          <button aria-pressed={verifiedOnly} className={`fchip${verifiedOnly ? " on" : ""}`} onClick={() => setVerifiedOnly((value) => !value)} type="button">Verified only</button>
        </div>
        {areas === undefined || (city && pins === undefined) ? (
          <div className="rs-route-state">Loading the live market index…</div>
        ) : mapSignals.length === 0 ? (
          <div className="rs-route-state rs-route-state--panel">No geocoded signals match these filters yet. Signals remain usable even when a location cannot be positioned.</div>
        ) : (
          <Suspense fallback={<div className="rs-route-state">Loading the interactive map…</div>}>
            <MarketGlobe
              autoRotate={!city}
              initialCenter={city && mapSignals[0] ? mapSignals[0].coordinates : undefined}
              initialZoom={city ? 9 : undefined}
              signals={mapSignals}
            />
          </Suspense>
        )}
      </main>
    </>
  );
}
