import { Building2, Check, LockKeyhole, MapPin, Users } from "lucide-react";
export function LandingBento() {
  return (
    <section className="landing-bento" id="features">
      <p className="landing-overline">Mehr als eine Trefferliste</p>
      <h2>
        Ein Scout, der euch versteht.
        <br />
        Und dranbleibt.
      </h2>
      <p>Eure Wünsche, eure Gespräche und eure Suche bleiben zusammen.</p>
      <div className="landing-bento-grid">
        <article className="landing-bento-memory">
          <div>
            <h3>Merkt sich, was euch wichtig ist.</h3>
            <p>Auch wenn sich eure Wünsche ändern.</p>
            <div className="landing-memory">
              <small>
                Eure Wünsche <span>Aktualisiert · gerade eben</span>
              </small>
              <p>
                <Users size={20} /> Geteilter Raum · 4 Personen
              </p>
              <p>🥁 Schlagzeug darf bleiben</p>
              <p>
                € <del>400 €</del> <strong>350 € / Monat</strong>
              </p>
            </div>
          </div>
          <img alt="" src="/design/proberaum.png" />
        </article>
        <article>
          <h3>Bleibt an Antworten dran.</h3>
          <p>Ihr müsst nicht jedes Portal selbst prüfen.</p>
          <div className="landing-replies">
            <p>
              <Building2 />
              <span>
                <small>Anbieter · Demo</small>Mittwoch wäre noch frei.
              </span>
            </p>
            <p>
              <i />
              <span>
                <small>RoomScout</small>Passt Mittwoch für euch?
              </span>
            </p>
          </div>
        </article>
        <article>
          <h3>Behält eure Quellen im Blick.</h3>
          <p>Passende öffentliche Signale an einem Ort.</p>
          <div className="landing-source-stack">
            <span>Angebot · Stuttgart-West</span>
            <span>Gesuch · Band sucht Raum</span>
            <span>
              <MapPin size={16} /> Stuttgart
            </span>
          </div>
        </article>
        <article className="landing-bento-control">
          <div aria-hidden="true" className="landing-orb" />
          <div>
            <h3>Übernimmt Arbeit. Nicht eure Entscheidung.</h3>
            <p>
              Nicht-bindende Anfragen können im erlaubten Rahmen laufen.
              Verbindliche Zusagen bleiben bei euch.
            </p>
            <div className="landing-permissions">
              <p>
                <Check />{" "}
                <span>
                  Anbieter kontaktieren
                  <small>Nur nach Freigabe oder aktivem Mandat.</small>
                </span>
              </p>
              <p>
                <LockKeyhole />{" "}
                <span>
                  Verbindlich zusagen<small>Bleibt immer bei euch.</small>
                </span>
              </p>
            </div>
            <a href="#control">So behaltet ihr die Kontrolle ↓</a>
          </div>
        </article>
      </div>
    </section>
  );
}
