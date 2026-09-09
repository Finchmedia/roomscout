import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LandingBento } from "../../components/landing/LandingBento";
import { LandingFaq } from "../../components/landing/LandingFaq";
import { LandingStory } from "../../components/landing/LandingStory";
import "../../styles/landing.css";

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const update = () => {
      setScrolled(window.scrollY > 40);
      if (!reducedMotion && previewRef.current) {
        const rect = previewRef.current.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.92 - rect.top) / (window.innerHeight * 0.55)));
        previewRef.current.style.transform = `rotateX(${14 * (1 - progress)}deg) scale(${0.96 + 0.04 * progress})`;
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  return <div className="landing-shell">
    <div aria-hidden="true" className="landing-backdrop" />
    <header className={scrolled ? "landing-header is-scrolled" : "landing-header"}>
      <a className="landing-wordmark" href="#top">roomscout</a>
      <nav aria-label="Landing page"><a href="#how">So funktioniert’s</a><a href="#features">Dein Scout</a></nav>
      <Link className="landing-pill landing-pill--small" to="/app/scout">Demo starten</Link>
    </header>
    <main>
      <section className="landing-hero" id="top">
        <div className="landing-kicker">Euer persönlicher Proberaum-Scout</div>
        <h1>Ihr macht Musik.<br /><span>Der Scout sucht den Raum.</span></h1>
        <p>Erzählt, was ihr sucht. RoomScout bündelt die Recherche und hilft, offene Fragen mit Anbietern zu klären.</p>
        <div className="landing-actions"><Link className="landing-pill" to="/app/scout">Demo ausprobieren</Link><a href="#how">So funktioniert’s <span aria-hidden="true">↓</span></a></div>
        <div className="landing-demo-note">Früher Prototyp · Kontrollierte Demo</div>
        <div className="landing-preview-perspective"><div className="landing-preview" ref={previewRef}><img alt="Beispielansicht der RoomScout-App: Der Scout arbeitet und wartet auf eine Antwort." src="/design/hero-preview.png" /><div aria-hidden="true" className="landing-preview-glow" /><span>Beispielansicht</span></div></div>
      </section>
      <section className="landing-intro" id="how"><div><p className="landing-overline">So funktioniert RoomScout</p><h2>Ein Gespräch.<br />Dann übernimmt euer Scout.</h2></div><p>Von euren Wünschen bis zum konkreten Angebot.<br /><a href="#features">Weiter zu den Funktionen ↓</a></p></section>
      <LandingStory />
      <LandingBento />
      <LandingFaq />
      <section className="landing-closing"><p>Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter.</p><div aria-hidden="true" className="landing-orb landing-orb--closing" /><h2>Bereit für euren nächsten Proberaum?</h2><div className="landing-actions"><Link className="landing-pill" to="/app/scout">Demo ausprobieren</Link><Link to="/explore">Öffentlichen Markt ansehen →</Link></div><footer className="landing-footer"><div><strong>roomscout</strong><span aria-hidden="true" /><p>Ein persönlicher Scout für eure Proberaumsuche.</p></div><div><Link to="/map">Karte</Link><small>Entstanden beim Convex All Gas Hackathon.</small></div></footer></section>
    </main>
  </div>;
}
