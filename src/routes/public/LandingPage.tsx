import { Clock3, Eye, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { useQuery } from "convex/react";
import { lazy, Suspense, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { SignalCard } from "../../components/signals/SignalCard";
import { LedgerCard } from "../../components/ui/LedgerCard";
import type { MapMarketSignal } from "../../components/map";
import type { MarketSignal } from "../../mocks/demoData";

const LandingGlobe = lazy(async () => {
  const module = await import("../../components/map/MarketGlobe");
  return { default: module.MarketGlobe };
});

function toSignalCard(signal: {
  _id: Id<"signals">;
  side: "supply" | "demand";
  title: string;
  city: string;
  district?: string;
  summary: string;
  arrangement: "permanent" | "shared" | "hourly" | "unknown";
  priceEur?: number;
  pricePeriod?: "hour" | "month" | "unknown";
  requirements: string[];
  status: "published" | "stale";
  verification: "observed" | "verified" | "conflicting";
  sourceCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
}): MarketSignal {
  const ageHours = Math.max(0, Math.floor((Date.now() - signal.lastSeenAt) / 3_600_000));
  return {
    id: signal._id,
    side: signal.side,
    verification: signal.verification === "verified"
      ? "source_verified"
      : signal.verification,
    freshness: signal.status === "stale" ? "possibly_stale" : ageHours < 24 ? "fresh" : "current",
    freshnessLabel: signal.status === "stale" ? "Possibly stale" : ageHours < 1 ? "Checked within the hour" : `Checked ${ageHours} h ago`,
    title: signal.title,
    location: [signal.district, signal.city].filter(Boolean).join(", "),
    arrangement: signal.arrangement === "unknown" ? undefined : signal.arrangement,
    source: `${signal.sourceCount} public source${signal.sourceCount === 1 ? "" : "s"}`,
    firstSeen: `First seen ${new Date(signal.firstSeenAt).toLocaleDateString()}`,
    facts: [
      ...(signal.priceEur === undefined ? [] : [{ label: "Price", value: `€${signal.priceEur} / ${signal.pricePeriod ?? "unknown"}` }]),
      ...(signal.requirements.length ? [{ label: "Requirements", value: signal.requirements.join(" · ") }] : []),
    ],
    summary: signal.summary,
  };
}

const howItWorks = [
  {
    title: "RoomScout watches the market",
    body: "Public rehearsal-room offers and room-wanted posts across fragmented sources become comparable signals with provenance and freshness.",
  },
  {
    title: "Your Scout learns what you need",
    body: "Describe the room in your own words. The Scout turns it into a structured search you can review and edit before activation.",
  },
  {
    title: "Your Scout starts working",
    body: "Autopilot handles non-binding outreach and follow-up. RoomScout comes back to you when an agreement, booking, or payment needs a real decision.",
  },
] as const;

const trustPoints = [
  { icon: Clock3, text: "Every signal says when it was checked or last seen — never a vague available-now badge." },
  { icon: LinkIcon, text: "Every signal keeps its original source. RoomScout indexes the public market; it does not erase provenance." },
  { icon: Eye, text: "Observed is not verified. Public posts remain labelled until their author or source confirms them." },
  { icon: ShieldCheck, text: "Unknown budget or unclear equipment stays visibly unknown. RoomScout does not invent missing values." },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const [location, setLocation] = useState("Stuttgart");
  const recentSignals = useQuery(api.signals.list, { limit: 3 });
  const areas = useQuery(api.map.listAreas);
  const globeSignals = useMemo<MapMarketSignal[]>(() => (areas ?? []).map((area) => ({
    id: `area-${area.city}`,
    title: `${area.city} market area`,
    coordinates: [area.longitude, area.latitude],
    side: area.supplyCount >= area.demandCount ? "supply" : "demand",
    locationLabel: area.city,
    source: "RoomScout market index",
    freshnessLabel: area.lastSignalAt ? `Updated ${new Date(area.lastSignalAt).toLocaleDateString()}` : "No recent signal",
    summary: `${area.supplyCount} supply · ${area.demandCount} demand · ${area.verifiedCount} verified`,
  })), [areas]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams({ city: location.trim() || "Stuttgart" });
    navigate(`/explore?${query.toString()}`);
  }

  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero rs-hero">
          <div className="eyebrow">Rehearsal-room market radar · Stuttgart prototype</div>
          <h1>Stop searching the same <em>twenty websites.</em></h1>
          <p>RoomScout watches a fragmented rehearsal-room market and explains relevant signals — including source, freshness, and what remains unknown.</p>
          <form className="searchbar" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="landing-location">City or region</label>
            <input className="input" id="landing-location" onChange={(event) => setLocation(event.target.value)} value={location} />
            <button className="btn btn-p" type="submit">Search rehearsal rooms</button>
          </form>
          <Link to="/app/scout">Meet your Room Scout →</Link>
          <div className="proof">
            <span className="mono">{recentSignals?.length ?? 0} recent public signals</span>
            <span className="mono">{areas?.length ?? 0} geocoded market areas</span>
          </div>
        </section>

        <section aria-labelledby="market-map-heading" className="section rs-section">
          <div className="sechead"><h2 id="market-map-heading">One market, many fragmented sources</h2><Link className="mono" to="/map">Open the full map →</Link></div>
          {areas === undefined ? <div className="rs-route-state">Loading the market map…</div> : globeSignals.length === 0 ? (
            <LedgerCard><p>The index is ready. City aggregates appear here after the controlled pilot publishes geocoded signals.</p></LedgerCard>
          ) : (
            <Suspense fallback={<div className="rs-route-state">Loading the interactive globe…</div>}>
              <LandingGlobe initialZoom={3.5} signals={globeSignals} />
            </Suspense>
          )}
        </section>

        <section aria-labelledby="recent-signals" className="section rs-section">
          <div className="sechead">
            <h2 id="recent-signals">Recent signals</h2>
            <Link className="mono" to="/explore">Open the market explorer →</Link>
          </div>
          <div className="grid3 rs-card-grid">
            {recentSignals === undefined ? <div className="rs-route-state">Loading recent signals…</div> : recentSignals.length === 0 ? (
              <LedgerCard><p>No public signals have been published yet. RoomScout does not fill an empty market with demo listings.</p></LedgerCard>
            ) : recentSignals.map((signal) => <SignalCard compact key={signal._id} signal={toSignalCard(signal)} />)}
          </div>
        </section>

        <section aria-labelledby="how-heading" className="section rs-section" id="how">
          <div className="sechead"><h2 id="how-heading">How it works</h2></div>
          <div className="grid3 rs-card-grid">
            {howItWorks.map((step, index) => (
              <LedgerCard className="step" key={step.title}>
                <div className="num">{String(index + 1).padStart(2, "0")}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </LedgerCard>
            ))}
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="section rs-section">
          <div className="sechead"><h2 id="trust-heading">Honest by design</h2></div>
          <div className="trust rs-trust-grid">
            {trustPoints.map(({ icon: Icon, text }) => (
              <div className="check" key={text}><Icon aria-hidden="true" size={16} /><span>{text}</span></div>
            ))}
          </div>
        </section>

        <section className="cta-end rs-final-cta">
          <h2>Your next room is a signal away.</h2>
          <Link className="btn btn-p btn-lg" to="/explore">Start my search</Link>
        </section>
      </main>
      <footer className="rs-public-footer">
        <span className="mono">RoomScout · Convex Hackathon Prototype</span>
        <span className="mono">Stuttgart first · more cities as data allows</span>
      </footer>
    </>
  );
}
