import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { factsAtStage, storyLines } from "./landingStoryModel";

export function LandingStory() {
  const storyRef = useRef<HTMLElement>(null);
  const workRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [workProgress, setWorkProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [answer, setAnswer] = useState<"wednesday" | "thursday" | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);
    const measure = (element: HTMLElement | null) => {
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      return Math.min(
        1,
        Math.max(0, -rect.top / Math.max(1, rect.height - window.innerHeight)),
      );
    };
    const update = () => {
      frameRef.current = null;
      setProgress(measure(storyRef.current));
      setWorkProgress(measure(workRef.current));
    };
    const schedule = () => {
      if (frameRef.current === null)
        frameRef.current = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      media.removeEventListener("change", syncMotion);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null)
        window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const visibleLines = reducedMotion
    ? storyLines.length
    : Math.min(storyLines.length, Math.floor(progress * 5.2) + 1);
  const facts = useMemo(() => factsAtStage(visibleLines), [visibleLines]);
  const showBrief = reducedMotion || progress > 0.72;
  const statuses = [
    "Ich suche passende Räume.",
    "Ich prüfe Quellen und offene Fragen.",
    "Die Demo-Anfrage ist vorbereitet.",
  ];
  const statusIndex = reducedMotion
    ? statuses.length - 1
    : Math.min(statuses.length - 1, Math.floor(workProgress * statuses.length));

  return (
    <>
      <section
        aria-label="Illustrierter Demo-Ablauf: Suchauftrag"
        className={`landing-story${reducedMotion ? " is-linear" : ""}`}
        ref={storyRef}
      >
        <div className={`landing-story-sticky${showBrief ? " is-brief" : ""}`}>
          <div className="landing-listener">
            <div className="landing-orb" />
            <p>
              <i /> Ich höre zu
            </p>
          </div>
          <div
            aria-hidden={showBrief && !reducedMotion}
            className="landing-conversation"
          >
            {storyLines.map((line, index) => (
              <div
                aria-hidden={index >= visibleLines}
                className={index < visibleLines ? "is-visible" : ""}
                key={line.text}
              >
                <small>Du</small>
                <p>{line.text}</p>
                <div>
                  {line.changes.map((fact) => (
                    <span
                      className={
                        facts.some(
                          (current) =>
                            current.id === fact.id &&
                            current.label === fact.label,
                        )
                          ? "is-current"
                          : ""
                      }
                      key={fact.label}
                    >
                      {fact.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <aside
            aria-live="polite"
            className="landing-facts landing-shared-brief"
          >
            <h3>{showBrief ? "So suche ich für euch." : "Euer Suchauftrag"}</h3>
            {facts.map((fact) => (
              <p data-fact-id={fact.id} key={fact.id}>
                <i />
                {fact.label}
              </p>
            ))}
            <em>Korrekturen ersetzen den alten Wert.</em>
            <div className="landing-brief-actions" inert={!showBrief}>
              <a className="landing-pill" href="#work">
                Scout losschicken
              </a>
              <small>
                Illustrativer Demo-Ablauf. Eine verbindliche Zusage gebt nur
                ihr.
              </small>
            </div>
          </aside>
        </div>
      </section>
      <section
        aria-label="Illustrierter Demo-Ablauf: Recherche"
        className={`landing-work${reducedMotion ? " is-linear" : ""}`}
        id="work"
        ref={workRef}
      >
        <div className="landing-work-sticky">
          <div className="landing-orb" />
          <h3>Ich kümmere mich darum.</h3>
          <p>{statuses[statusIndex]}</p>
          <span>
            <Search size={16} /> Stuttgart · bis 350 €
          </span>
          <small>
            Ihr könnt die App schließen. Der Scout meldet sich, wenn eine
            Entscheidung nötig ist.
          </small>
        </div>
      </section>
      <section className="landing-decision">
        <div className="landing-orb landing-orb--small" />
        <h3>Nur echte Entscheidungen kommen zu euch.</h3>
        <div className="landing-question">
          <small>Dein Scout · Demo</small>
          <p>
            Ein Beispielraum passt. Donnerstag ist schon belegt — wäre Mittwoch
            ab 19 Uhr auch möglich?
          </p>
          {!answer ? (
            <div>
              <button onClick={() => setAnswer("wednesday")} type="button">
                Mittwoch passt
              </button>
              <button onClick={() => setAnswer("thursday")} type="button">
                Donnerstag bleibt wichtig
              </button>
            </div>
          ) : null}
        </div>
        {answer ? (
          <div className="landing-answer">
            <p>
              {answer === "wednesday"
                ? "Mittwoch passt auch."
                : "Donnerstag bleibt wichtig."}
            </p>
            <span>
              {answer === "wednesday"
                ? "Alles klar. Ich kläre den Rest im Demo-Ablauf."
                : "Verstanden. Dieses Beispiel passt nicht mehr – der Scout setzt die Suche mit Donnerstag als fester Vorgabe fort."}
            </span>
          </div>
        ) : null}
      </section>
      {answer === "wednesday" ? (
        <section className="landing-offer">
          <h3>Ein Raum, der zu euch passt.</h3>
          <div className="landing-offer-card">
            <img
              alt="Beispielhafter Proberaum mit Schlagzeug und Akustikpaneelen"
              src="/design/proberaum.png"
            />
            <div>
              <small>Illustratives Beispielangebot</small>
              <h4>Stuttgart-West · Geteilter Proberaum</h4>
              <strong>
                280 € <span>/ Monat</span>
              </strong>
              <p>inklusive Nebenkosten</p>
              <ul>
                <li>
                  <Check size={18} />
                  Mittwochs, 19–22 Uhr
                </li>
                <li>
                  <Check size={18} />
                  Schlagzeug kann im Raum bleiben
                </li>
              </ul>
              <Link className="landing-pill" to="/app/scout">
                Demo öffnen
              </Link>
              <p>Keine echte Anzeige. Eine verbindliche Zusage gebt nur ihr.</p>
            </div>
          </div>
          <small>Beispielsuche · Ablauf verkürzt dargestellt</small>
        </section>
      ) : null}
      {answer === "thursday" ? (
        <section aria-live="polite" className="landing-continued-search">
          <div className="landing-orb landing-orb--small" />
          <small>Demo-Suche angepasst</small>
          <h3>Donnerstag bleibt gesetzt.</h3>
          <p>
            Der Beispielraum in Stuttgart-West ist verworfen. Der Scout sucht
            weiter und meldet sich erst wieder mit einem passenden Treffer oder
            einer neuen Rückfrage.
          </p>
          <span>
            <Search size={16} /> Stuttgart · Donnerstag ab 19 Uhr · bis 350 €
          </span>
          <Link className="landing-pill" to="/app/scout">
            Echten Scout öffnen
          </Link>
          <button
            className="landing-replay"
            onClick={() => setAnswer("wednesday")}
            type="button"
          >
            Alternativen Demo-Ausgang mit Mittwoch ansehen
          </button>
        </section>
      ) : null}
    </>
  );
}
