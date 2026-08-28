import { Clock3, Eye, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { SignalCard } from "../../components/signals/SignalCard";
import { FixtureNotice, LedgerCard } from "../../components/ui/LedgerCard";
import { demoSignals } from "../../mocks/demoData";

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
    title: "You review every external action",
    body: "The Scout can explain a signal and draft an inquiry. Nothing is sent until you approve the exact recipient and message.",
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

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams({ location: location.trim() || "Stuttgart" });
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
            <FixtureNotice />
            <span className="mono">{demoSignals.length} example signals</span>
            <span className="mono">Stuttgart demo geography</span>
          </div>
        </section>

        <section aria-labelledby="recent-signals" className="section rs-section">
          <div className="sechead">
            <h2 id="recent-signals">Recent signals</h2>
            <Link className="mono" to="/explore">Open the market explorer →</Link>
          </div>
          <div className="grid3 rs-card-grid">
            {demoSignals.slice(0, 3).map((signal) => <SignalCard compact key={signal.id} signal={signal} />)}
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
