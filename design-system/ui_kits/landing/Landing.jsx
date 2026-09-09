const LDS = window.RoomScoutDesignSystem_e8f376;
const { ScoutBlob: LBlob, Button: LBtn, Badge: LBadge, Overline: LOvl, Card: LCard, Icon: LIc, Accordion: LAcc, Wordmark: LMark, Capsule: LCap, FactList: LFacts, SummaryPill: LPill, StatusDot: LDot } = LDS;

const FAQS = [
  ['Was darf der Scout selbstständig tun?', 'Er recherchiert und fragt unverbindlich an — innerhalb eures Suchauftrags. Verbindliche Zusagen, Buchungen und Zahlungen entscheidet ihr selbst. Quellen, Handlungsspielraum und Erinnerungen könnt ihr in den Einstellungen prüfen und ändern.'],
  ['Muss ich mit dem Scout sprechen?', 'Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche.'],
  ['Funktioniert das schon auf allen Portalen?', 'Noch nicht. Die aktuelle Demo zeigt den Ablauf auf einem von uns kontrollierten Testportal. In dieser Demo kontaktieren wir keine fremden Anbieter.'],
];
const FACTS = [{ id: 'ort', label: 'Stuttgart & Umgebung' }, { id: 'band', label: 'Geteilter Raum · 4 Personen' }, { id: 'budget', label: 'Bis 350 € / Monat', changed: true }, { id: 'equip', label: 'Schlagzeug darf im Raum bleiben' }, { id: 'zeit', label: 'Donnerstags ab 19 Uhr' }];
const CHECK = <LIc name="check" size={18} color="var(--rs-orange)" />;
const H2 = ({ children, style }) => <h2 style={{ margin: '18px 0 0', fontSize: 'clamp(36px,5vw,68px)', lineHeight: 1.04, fontWeight: 400, letterSpacing: '-.03em', textWrap: 'balance', ...style }}>{children}</h2>;
const BentoTitle = ({ t, s }) => <><div style={{ fontSize: 'clamp(22px,1.9vw,27px)', fontWeight: 500, letterSpacing: '-.01em' }}>{t}</div><div style={{ marginTop: 6, fontSize: 16, color: 'var(--rs-ink-4)' }}>{s}</div></>;

function Landing() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', position: 'relative', minHeight: '100vh' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}><div className="rs-bg" /><div className="rs-grain" /></div>
      <header style={{ position: 'fixed', zIndex: 10, top: 0, left: 0, right: 0, height: 76, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 clamp(20px,4vw,48px)', background: 'rgba(11,10,9,.55)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--rs-border-divider-soft)' }}>
        <LMark size={19} href="#top" style={{ justifySelf: 'start' }} />
        <nav style={{ display: 'flex', gap: 34, fontSize: 15 }}><a href="#how" style={{ color: 'var(--rs-ink-2)', textDecoration: 'none' }}>So funktioniert’s</a><a href="#features" style={{ color: 'var(--rs-ink-2)', textDecoration: 'none' }}>Dein Scout</a></nav>
        <a href="../roomscout-app/index.html" style={{ justifySelf: 'end', height: 44, padding: '0 22px', borderRadius: 999, background: 'var(--rs-orange)', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Demo starten</a>
      </header>

      <section id="top" style={{ position: 'relative', zIndex: 2, padding: '130px 24px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <LBadge variant="pill">Euer persönlicher Proberaum-Scout</LBadge>
        <h1 style={{ margin: '26px 0 0', fontSize: 'clamp(42px,6.2vw,84px)', lineHeight: 1.02, fontWeight: 400, letterSpacing: '-.03em', textWrap: 'balance' }}>Ihr macht Musik.<br /><span style={{ color: 'var(--rs-orange)' }}>Der Scout sucht den Raum.</span></h1>
        <p style={{ margin: '24px 0 0', fontSize: 'clamp(17px,1.5vw,21px)', lineHeight: 1.5, color: 'var(--rs-ink-4)', maxWidth: 600, textWrap: 'pretty' }}>Erzählt, was ihr sucht. RoomScout übernimmt die Suche und klärt mit Anbietern, ob der Raum zu euch passt.</p>
        <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}><a href="../roomscout-app/index.html" style={{ textDecoration: 'none' }}><LBtn size="md" style={{ fontSize: 17 }}>Demo ausprobieren</LBtn></a><a href="#how" style={{ fontSize: 16, color: 'var(--rs-ink)', textDecoration: 'none' }}>So funktioniert’s ↓</a></div>
        <div style={{ marginTop: 20, fontSize: 13.5, color: 'var(--rs-ink-6)' }}>Früher Prototyp · Kontrollierte Demo</div>
        <div style={{ marginTop: 44, width: 'min(1120px,100%)', perspective: 1600, perspectiveOrigin: '50% 0%' }}>
          <div style={{ position: 'relative', borderRadius: 22, border: '1px solid rgba(255,190,140,.26)', overflow: 'hidden', boxShadow: 'var(--shadow-hero)', transform: 'rotateX(14deg) scale(.96)', transformOrigin: '50% 0%' }}>
            <img src="../../assets/hero-preview.png" alt="Beispielansicht der RoomScout-App" style={{ display: 'block', width: '100%', height: 'auto' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(11,10,9,0) 70%,rgba(11,10,9,.35) 100%)' }} />
            <div style={{ position: 'absolute', right: 18, bottom: 14, fontSize: 12, color: 'var(--rs-ink-2)', padding: '5px 11px', borderRadius: 999, border: '1px solid var(--rs-border-control)', background: 'rgba(11,10,9,.55)' }}>Beispielansicht</div>
          </div>
        </div>
      </section>

      <section id="how" style={{ position: 'relative', zIndex: 2, padding: '120px clamp(20px,5vw,80px) 0', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 40, alignItems: 'end' }}>
          <div><LOvl tone="accent" wide>So funktioniert RoomScout</LOvl><H2 style={{ fontSize: 'clamp(36px,5.4vw,74px)', lineHeight: 1.02 }}>Ein Gespräch.<br />Dann übernimmt euer Scout.</H2></div>
          <div style={{ fontSize: 'clamp(17px,1.4vw,20px)', color: 'var(--rs-ink-4)', lineHeight: 1.5, paddingBottom: 10 }}>Von euren Wünschen bis zum konkreten Angebot.</div>
        </div>
        <div style={{ marginTop: 70, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 'clamp(24px,4vw,60px)', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}><LBlob size={140} state="listening" /><LDot pulse style={{ fontSize: 14, color: 'var(--rs-ink-6)' }}>Ich höre zu</LDot></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
            {[['Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart.', ['Stuttgart & Umgebung', 'Geteilter Raum · 4 Personen']], ['Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können.', ['Bis 400 € / Monat', 'Schlagzeug darf im Raum bleiben']], ['Eigentlich lieber maximal 350 Euro.', ['Bis 350 € / Monat']]].map(([t, caps]) => <div key={t}><div style={{ fontSize: 12.5, color: 'var(--rs-ink-6)', marginBottom: 4 }}>Du</div><div style={{ fontSize: 'clamp(17px,2.2vw,30px)', lineHeight: 1.2, fontWeight: 300, letterSpacing: '-.015em', textWrap: 'balance' }}>{t}</div><div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{caps.map(c => <LCap key={c} size="sm">{c}</LCap>)}</div></div>)}
          </div>
          <div><LFacts facts={FACTS} /><div style={{ marginTop: 14, fontSize: 14, color: 'var(--rs-ink-6)', lineHeight: 1.5, maxWidth: 300 }}>Während ihr sprecht, merke ich mir, was zählt. Korrekturen ersetzen den alten Wert.</div></div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 2, padding: '140px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <LBlob size={150} style={{ marginBottom: 44 }} />
        <h3 style={{ margin: 0, fontSize: 'clamp(34px,5vw,64px)', lineHeight: 1.05, fontWeight: 300, letterSpacing: '-.025em' }}>Ich kümmere mich darum.</h3>
        <div style={{ marginTop: 22, fontSize: 'clamp(17px,1.6vw,22px)', color: 'var(--rs-ink-2)', maxWidth: 560 }}>Die Anfrage ist raus. Ich warte auf eine Antwort.</div>
        <LPill style={{ marginTop: 26, height: 42, color: 'var(--rs-ink-2)' }}>Stuttgart · bis 350 €</LPill>
        <div style={{ marginTop: 50, fontSize: 15, color: 'var(--rs-ink-6)', maxWidth: 460, lineHeight: 1.6 }}>Ihr könnt die App schließen. Ich melde mich, wenn ich euch brauche.</div>
      </section>

      <section style={{ position: 'relative', zIndex: 2, padding: '140px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <LBlob size={96} state="listening" style={{ marginBottom: 32 }} />
        <h3 style={{ margin: 0, fontSize: 'clamp(32px,4.6vw,58px)', lineHeight: 1.05, fontWeight: 300, letterSpacing: '-.025em', textWrap: 'balance' }}>Nur echte Entscheidungen kommen zu euch.</h3>
        <LCard size="lg" tone="soft" style={{ marginTop: 34, width: 'min(680px,100%)', padding: '30px 32px', textAlign: 'center' }}>
          <LOvl>Dein Scout</LOvl>
          <div style={{ marginTop: 12, fontSize: 'clamp(21px,2.3vw,29px)', lineHeight: 1.25, fontWeight: 300, textWrap: 'balance' }}>Ein Raum passt zu euch. Donnerstag ist schon belegt — wäre Mittwoch ab 19 Uhr auch möglich?</div>
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}><LBtn variant="tint" size="xs">Mittwoch passt</LBtn><LBtn variant="secondary" size="xs">Donnerstag bleibt wichtig</LBtn></div>
        </LCard>
      </section>

      <section style={{ position: 'relative', zIndex: 2, padding: '140px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 30px', fontSize: 'clamp(32px,4.6vw,58px)', lineHeight: 1.05, fontWeight: 300, letterSpacing: '-.025em' }}>Ein Raum, der zu euch passt.</h3>
        <LCard size="xl" padding={0} style={{ width: 'min(1100px,100%)', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', overflow: 'hidden' }}>
          <img src="../../assets/proberaum.png" alt="Proberaum mit Schlagzeug und Akustikpaneelen" style={{ display: 'block', width: '100%', height: '100%', minHeight: 300, maxHeight: 440, objectFit: 'cover' }} />
          <div style={{ padding: 'clamp(24px,3vw,44px) clamp(24px,3.4vw,52px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <LOvl tone="accent">Beispielangebot</LOvl>
            <div style={{ marginTop: 16, fontSize: 'clamp(22px,2.2vw,30px)' }}>Stuttgart-West · Geteilter Proberaum</div>
            <div style={{ marginTop: 6, fontSize: 'clamp(36px,3.6vw,50px)', letterSpacing: '-.02em', lineHeight: 1.1 }}>280 € <span style={{ fontSize: '.6em', color: 'var(--rs-ink-2)' }}>/ Monat</span></div>
            <div style={{ marginTop: 4, fontSize: 16, color: 'var(--rs-ink-4)' }}>inklusive Nebenkosten</div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{CHECK}Mittwochs, 19–22 Uhr</div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{CHECK}Schlagzeug kann im Raum bleiben</div></div>
            <LBtn size="base" style={{ marginTop: 26, alignSelf: 'flex-start', padding: '0 30px' }}>Angebot prüfen</LBtn>
            <div style={{ marginTop: 14, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Eine verbindliche Zusage gebt nur ihr.</div>
          </div>
        </LCard>
        <div style={{ marginTop: 22, fontSize: 13, color: 'var(--rs-ink-6)' }}>Beispielsuche · Ablauf verkürzt dargestellt</div>
      </section>

      <section id="features" style={{ position: 'relative', zIndex: 2, padding: '140px clamp(20px,5vw,80px) 40px', maxWidth: 1400, margin: '0 auto' }}>
        <LOvl tone="accent" wide>Mehr als eine Trefferliste</LOvl>
        <H2>Ein Scout, der euch versteht.<br />Und dranbleibt.</H2>
        <p style={{ margin: '16px 0 0', fontSize: 'clamp(17px,1.4vw,20px)', color: 'var(--rs-ink-4)' }}>Eure Wünsche, eure Gespräche und eure Suche bleiben zusammen.</p>
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 18 }}>
          <LCard size="2xl" tone="soft" hoverLift padding={0} style={{ overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,.8fr)' }}>
            <div style={{ padding: '32px 34px', minWidth: 0 }}><BentoTitle t="Merkt sich, was euch wichtig ist." s="Auch wenn sich eure Wünsche ändern." />
              <div style={{ marginTop: 24, border: '1px solid var(--rs-border-card)', borderRadius: 16, background: 'var(--rs-surface-inset)', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--rs-ink-6)', letterSpacing: '.1em', textTransform: 'uppercase' }}><span>Eure Wünsche</span><span style={{ letterSpacing: 0, textTransform: 'none' }}>Heute</span></div>
                {[['users', 'Geteilter Raum · 4 Personen'], ['drum', 'Schlagzeug darf bleiben']].map(([i, t]) => <div key={t} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, height: 46, borderTop: '1px solid var(--rs-border-divider-soft)', fontSize: 15.5 }}><LIc name={i} size={20} color="var(--rs-ink-2)" />{t}</div>)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 46, borderTop: '1px solid var(--rs-border-divider-soft)', fontSize: 15.5 }}><span style={{ fontSize: 19, width: 20, textAlign: 'center' }}>€</span><span style={{ color: 'var(--rs-ink-6)', textDecoration: 'line-through' }}>400 €</span><span style={{ color: 'var(--rs-orange-light)', fontWeight: 500 }}>350 € / Monat</span></div>
              </div>
            </div>
            <img src="../../assets/proberaum.png" alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', minHeight: 280 }} />
          </LCard>
          <LCard size="2xl" tone="soft" hoverLift><BentoTitle t="Bleibt an Antworten dran." s="Ihr müsst nicht jedes Portal selbst prüfen." />
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'start' }}><span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--rs-surface-subtle-2)', border: '1px solid var(--rs-border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rs-ink-2)' }}><LIc name="building" size={18} /></span><div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(255,255,255,.05)', border: '1px solid var(--rs-border-divider)' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--rs-ink-6)' }}><span>Anbieter</span><span>Heute, 14:27</span></div><div style={{ marginTop: 4, fontSize: 15.5 }}>Mittwoch wäre noch frei.</div></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'start' }}><LBlob size={44} state="still" /><div style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--rs-rust-soft)', border: '1px solid var(--rs-border-accent-faint)' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--rs-orange-light)' }}>RoomScout</span><span style={{ color: 'var(--rs-ink-6)' }}>Heute, 14:28</span></div><div style={{ marginTop: 4, fontSize: 15.5 }}>Passt Mittwoch für euch?</div></div></div>
            </div>
          </LCard>
        </div>
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', gap: 18 }}>
          <LCard size="2xl" tone="soft" hoverLift style={{ overflow: 'hidden' }}><BentoTitle t="Behält eure Quellen im Blick." s="Passende Anzeigen an einem Ort." />
            <div style={{ marginTop: 24, position: 'relative', height: 170 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 'min(300px,78%)', display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, padding: 10, borderRadius: 14, background: 'rgba(0,0,0,.35)', border: '1px solid var(--rs-border-panel)' }}><img src="../../assets/proberaum.png" alt="" style={{ width: 96, height: 78, objectFit: 'cover', borderRadius: 8 }} /><div><div style={{ fontSize: 14.5 }}>Angebot · Stuttgart-West</div><div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.12)', width: '80%' }} /><div style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.12)', width: '60%' }} /></div></div>
              <div style={{ position: 'absolute', left: 'min(150px,40%)', top: 58, width: 'min(240px,62%)', padding: '12px 14px', borderRadius: 14, background: 'rgba(10,8,7,.9)', border: '1px solid var(--rs-border-card)' }}><div style={{ fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}><LIc name="doc" size={16} />Gesuch · Band sucht Raum</div><div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.12)', width: '70%' }} /></div>
              <LPill size="sm" icon={<LIc name="pin" size={16} />} style={{ position: 'absolute', left: 0, bottom: 0, height: 40 }}>Stuttgart</LPill>
            </div>
          </LCard>
          <LCard size="2xl" tone="soft" hoverLift style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-50%)', width: 220, height: 220, borderRadius: 'var(--blob-shape)', background: 'var(--blob-gradient)', boxShadow: '0 0 60px 10px rgba(255,105,38,.35)', opacity: .9, animation: 'rsBreathe 6s ease-in-out infinite' }} />
            <div style={{ position: 'relative', maxWidth: '66%' }}><BentoTitle t="Übernimmt Arbeit. Nicht eure Entscheidung." s="Anfragen laufen im Autopilot. Verbindliche Zusagen bleiben bei euch." />
              <div style={{ marginTop: 24, border: '1px solid var(--rs-border-card)', borderRadius: 16, background: 'rgba(0,0,0,.3)', padding: '6px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--rs-border-divider-soft)' }}><span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--rs-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><LIc name="check" size={16} strokeWidth={2.4} /></span><div><div style={{ fontSize: 15.5 }}>Anbieter kontaktieren</div><div style={{ fontSize: 13.5, color: 'var(--rs-ink-6)' }}>Darf RoomScout für euch übernehmen.</div></div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 14, alignItems: 'center', padding: '12px 0' }}><span style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,220,190,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LIc name="lock" size={15} /></span><div><div style={{ fontSize: 15.5 }}>Verbindlich zusagen</div><div style={{ fontSize: 13.5, color: 'var(--rs-ink-6)' }}>Bleibt immer bei euch.</div></div></div>
              </div>
            </div>
          </LCard>
        </div>
      </section>

      <section id="control" style={{ position: 'relative', zIndex: 2, padding: '110px clamp(20px,5vw,80px) 40px', maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 'clamp(30px,5vw,80px)', alignItems: 'start' }}>
        <div><LOvl tone="accent" wide>Klar geregelt</LOvl><H2 style={{ fontSize: 'clamp(32px,3.8vw,54px)', lineHeight: 1.06 }}>Euer Scout übernimmt.<br />Ihr behaltet das letzte Wort.</H2><p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.6, color: 'var(--rs-ink-4)', maxWidth: 460 }}>Ihr bestimmt, wo gesucht wird, was der Scout übernehmen darf und was er sich merkt.</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{FAQS.map(([q, a], i) => <LAcc key={q} question={q} defaultOpen={i === 0}>{a}</LAcc>)}</div>
      </section>

      <section style={{ position: 'relative', zIndex: 2, padding: '100px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 15, color: 'var(--rs-ink-4)' }}>Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter.</div>
        <LBlob size={86} style={{ marginTop: 44 }} />
        <h2 style={{ margin: '34px 0 0', fontSize: 'clamp(36px,5vw,66px)', lineHeight: 1.04, fontWeight: 300, letterSpacing: '-.03em', textWrap: 'balance' }}>Bereit für euren nächsten Proberaum?</h2>
        <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}><a href="../roomscout-app/index.html" style={{ textDecoration: 'none' }}><LBtn size="md" style={{ height: 58, fontSize: 17 }}>Demo ausprobieren</LBtn></a><a href="https://github.com/Finchmedia/roomscout" target="_blank" rel="noopener" style={{ fontSize: 16, color: 'var(--rs-ink)', textDecoration: 'none' }}>Projekt ansehen ↗</a></div>
        <footer style={{ marginTop: 90, width: 'min(1400px,100%)', padding: '26px clamp(20px,5vw,80px) 30px', borderTop: '1px solid var(--rs-border-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 14, color: 'var(--rs-ink-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><LMark size={17} /><span style={{ width: 1, height: 18, background: 'rgba(255,220,190,.2)' }} /><span>Ein persönlicher Scout für eure Proberaumsuche.</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><a href="https://github.com/Finchmedia/roomscout" target="_blank" rel="noopener" style={{ color: 'var(--rs-ink-2)', textDecoration: 'none' }}>GitHub</a><span style={{ fontSize: 13 }}>Entstanden beim Convex All Gas Hackathon.</span></div>
        </footer>
      </section>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Landing />);
