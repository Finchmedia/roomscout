const DS = window.RoomScoutDesignSystem_e8f376;
const { ScoutBlob, Button, Icon, Capsule, FactList, VoiceControl, Composer, SummaryPill, Card, Overline, ChatBubble, StatusDot } = DS;

const SCRIPT = [
  { who: 'scout', text: 'Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?' },
  { who: 'user', text: 'Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.', facts: [{ id: 'ort', label: 'Stuttgart' }, { id: 'budget', label: 'Bis 400 € / Monat' }, { id: 'band', label: 'Geteilter Raum · 4 Personen' }] },
  { who: 'scout', text: 'Welche Tage passen euch zum Proben?' },
  { who: 'user', text: 'Donnerstags ab 19 Uhr wäre gut.', facts: [{ id: 'zeit', label: 'Donnerstags ab 19 Uhr' }] },
  { who: 'scout', text: 'Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?' },
  { who: 'user', text: 'Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.', facts: [{ id: 'equip', label: 'Schlagzeug darf im Raum bleiben' }] },
  { who: 'user', text: 'Und beim Budget lieber maximal 350 Euro.', facts: [{ id: 'budget', label: 'Bis 350 € / Monat' }] },
  { who: 'scout', text: 'Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?', end: true },
];

function Welcome({ go, name, narrow, voiceOff, showHint }) {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 24px 40px' }}>
      <ScoutBlob size={narrow ? 128 : 168} style={{ marginBottom: narrow ? 36 : 56 }} />
      <div style={{ fontSize: 19, color: 'var(--rs-ink-2)' }}>Hey {name}.</div>
      <h1 style={{ margin: '14px 0 0', fontSize: narrow ? 38 : 'clamp(38px,6vw,64px)', lineHeight: 1.08, fontWeight: 300, letterSpacing: '-.02em', maxWidth: 640, textWrap: 'balance' }}>Finden wir euren Proberaum.</h1>
      <Button size="lg" icon={<Icon name="mic" size={20} />} style={{ marginTop: 48 }} onClick={() => { if (voiceOff) { go('discovery', { mode: 'text' }); showHint('Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus.'); } else go('discovery', { mode: 'voice' }); }}>Mit Scout sprechen</Button>
      <Button variant="ghost" icon={<Icon name="keyboard" size={20} />} style={{ marginTop: 22, fontSize: 16 }} onClick={() => go('discovery', { mode: 'text' })}>Lieber schreiben</Button>
      <div style={{ marginTop: 'min(12vh,110px)', fontSize: 15, color: 'var(--rs-ink-5)' }}>Du erzählst. Dein Scout kümmert sich.</div>
    </div>
  );
}

function Discovery({ go, mode, setMode, facts, setFacts, transcript, setTranscript, toggleTranscript, narrow, showHint }) {
  const [step, setStep] = React.useState(0);
  const [capsule, setCapsule] = React.useState(null);
  const [micOn, setMicOn] = React.useState(true);
  const [draft, setDraft] = React.useState('');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const ctrl = narrow ? 60 : 76;
  const line = SCRIPT[Math.min(step, SCRIPT.length - 1)];
  const timers = React.useRef([]);
  const after = (ms, fn) => timers.current.push(setTimeout(fn, ms));
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const applyFacts = (fs, done) => {
    fs.forEach((f, i) => {
      after(300 + i * 1100, () => setCapsule(f.label));
      after(900 + i * 1100, () => { setCapsule(null); setFacts(prev => prev.some(p => p.id === f.id) ? prev.map(p => p.id === f.id ? { ...p, label: f.label, changed: true } : p) : prev.concat([{ ...f }])); after(1200, () => setFacts(prev => prev.map(p => ({ ...p, changed: false })))); });
    });
    after(600 + fs.length * 1100, done);
  };
  const advance = React.useCallback(() => {
    const cur = SCRIPT[step];
    if (!cur) return;
    setTranscript(t => t.concat([cur]));
    if (cur.end) { after(1400, () => go('brief')); return; }
    if (cur.facts) applyFacts(cur.facts, () => setStep(s => s + 1)); else after(mode === 'voice' ? 2600 : 600, () => setStep(s => s + 1));
  }, [step, mode]);
  React.useEffect(() => { if (mode === 'voice' || line.who === 'scout') advance(); }, [step, mode]);

  const isScout = line.who === 'scout';
  const suggestion = mode === 'text' && !isScout ? line.text : null;
  const send = (t) => { setDraft(''); advance(); };
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `16px 24px ${narrow && facts.length ? 96 : 32}px`, position: 'relative' }}>
      <ScoutBlob size={narrow ? (mode === 'voice' ? 120 : 88) : (mode === 'voice' ? 150 : 96)} state={isScout ? 'speaking' : 'listening'} style={{ marginBottom: 28, transition: 'width .6s,height .6s' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--rs-ink-4)', minHeight: 22 }}><span style={{ fontWeight: 500, color: 'var(--rs-ink-2)' }}>{isScout ? 'Dein Scout' : 'Du'}</span>{isScout ? null : <><span style={{ color: 'var(--rs-ink-8)' }}>·</span><span>Ich höre zu</span></>}</div>
      <div style={{ minHeight: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <p key={step} style={{ margin: '12px 0 0', fontSize: narrow ? (mode === 'voice' ? 28 : 24) : (mode === 'voice' ? 'clamp(28px,3.6vw,46px)' : 'clamp(24px,3vw,36px)'), lineHeight: 1.16, fontWeight: 300, letterSpacing: '-.015em', maxWidth: !narrow && facts.length ? 'min(760px, calc(100vw - 660px))' : 760, textWrap: 'balance', color: 'var(--rs-ink-bright)', animation: 'rsFadeUp .5s ease both' }}>{mode === 'text' && !isScout ? '' : line.text}</p>
      </div>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>{capsule && <Capsule key={capsule}>{capsule}</Capsule>}</div>
      {mode === 'voice' ? <>
        <div style={{ marginTop: 36, display: 'flex', gap: narrow ? 20 : 34, alignItems: 'flex-start' }}>
          <VoiceControl tone="accent" size={ctrl} active={micOn} label={micOn ? 'Mikro an' : 'Mikro aus'} onClick={() => setMicOn(m => !m)}><Icon name={micOn ? 'mic' : 'mic-off'} size={26} /></VoiceControl>
          <VoiceControl size={ctrl} label="Mitschrift" onClick={toggleTranscript}><Icon name="transcript" size={24} /></VoiceControl>
          <VoiceControl size={ctrl} tone="danger" label="Gespräch beenden" onClick={() => go('welcome')}><Icon name="close" size={24} /></VoiceControl>
        </div>
        <Button variant="link" size="2xs" style={{ marginTop: 26, color: 'var(--rs-ink-6)', textDecoration: 'none', fontSize: 14 }} onClick={() => setMode('text')}>Zum Schreiben wechseln</Button>
      </> : <div style={{ marginTop: 22, width: 'min(640px,100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {suggestion && <Button variant="tint" size="2xs" style={{ fontWeight: 400, height: 'auto', padding: '8px 14px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => send(suggestion)}>{suggestion}</Button>}
        <Composer value={draft} onChange={setDraft} onSubmit={() => { const t = draft.trim(); if (!t) return; if (isScout) { showHint('Der Scout ist noch nicht fertig. Gleich kannst du antworten.'); return; } const ref = line.text.toLowerCase(); const hits = t.toLowerCase().split(/\s+/).filter(w => w.length > 3 && ref.includes(w)).length; if (hits >= 2) send(t); else showHint('Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich.'); }} onVoice={() => setMode('voice')} placeholder={isScout ? 'Dein Scout spricht …' : 'Antwort an deinen Scout …'} />
        <div style={{ display: 'flex', gap: 18 }}><Button variant="ghost" size="2xs" style={{ color: 'var(--rs-ink-6)', fontSize: 14 }} onClick={toggleTranscript}>Mitschrift</Button><Button variant="ghost" size="2xs" style={{ color: 'var(--rs-ink-6)', fontSize: 14 }} onClick={() => go('welcome')}>Gespräch beenden</Button></div>
      </div>}
      {facts.length > 0 && !narrow && <FactList facts={facts} style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', animation: 'rsFadeUp .5s ease both' }} />}
      {facts.length > 0 && narrow && <BottomSheet title={facts.length + (facts.length === 1 ? ' Wunsch gemerkt' : ' Wünsche gemerkt')} open={sheetOpen} onToggle={() => setSheetOpen(o => !o)}>{sheetOpen && <FactList facts={facts} variant="compact" style={{ width: '100%', padding: '6px 0 0', background: 'none', border: 0 }} title="" />}</BottomSheet>}
    </div>
  );
}

/** Mobile bottom sheet: compact pill ("5 Wünsche gemerkt") or full-width card (Suchauftrag review). */
function BottomSheet({ title, open, onToggle, card, children }) {
  return (
    <div style={{ position: 'absolute', zIndex: 6, left: card ? 0 : 12, right: card ? 0 : 12, bottom: card ? 0 : 12, borderRadius: card ? '26px 26px 0 0' : 20, background: 'rgba(18,14,12,.92)', border: '1px solid var(--rs-border-panel)', backdropFilter: 'var(--blur-sheet)', padding: card ? '22px 22px 26px' : '8px 14px 8px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '78%', overflow: 'auto', boxShadow: '0 -20px 60px rgba(0,0,0,.4)', textAlign: 'left', transition: 'left .6s cubic-bezier(.22,.8,.2,1),right .6s,bottom .6s,border-radius .6s,padding .6s' }}>
      {card ? <div style={{ fontSize: 22, padding: '6px 4px' }}>{title}</div> : <button onClick={onToggle} aria-expanded={open} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 0, background: 'none', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, padding: '6px 4px', cursor: 'pointer', textAlign: 'left' }}><span>{title}</span><Icon name="chevron-up" size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }} /></button>}
      {children}
    </div>
  );
}

function Brief({ go, facts, setFacts, narrow }) {
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState({});
  const save = () => { setFacts(f => f.map(x => drafts[x.id] !== undefined && drafts[x.id].trim() ? { ...x, label: drafts[x.id].trim() } : x)); setEditing(false); setDrafts({}); };
  const actions = editing ? (
    <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', animation: 'rsFadeUp .3s ease both' }}><Button size="sm" onClick={save}>Übernehmen</Button><Button variant="secondary" size="sm" onClick={() => { setEditing(false); setDrafts({}); }}>Abbrechen</Button></div>
  ) : (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'rsFadeUp .45s ease both' }}>
      <Button size="md" block onClick={() => go('scouting')}>Scout losschicken</Button>
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--rs-ink-4)', textAlign: 'center' }}>Ich suche und frage selbstständig an.<br />Eine verbindliche Zusage gibst nur du.</div>
      <div style={{ display: 'flex', gap: 18 }}><Button variant="link" size="2xs" style={{ color: 'var(--rs-ink-2)', fontSize: 15 }} onClick={() => setEditing(true)}>Noch etwas ändern</Button><Button variant="ghost" size="2xs" style={{ color: 'var(--rs-ink-6)', fontSize: 15 }} onClick={() => go('discovery')}>Zurück zum Gespräch</Button></div>
    </div>
  );
  if (narrow) return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 24px 40px', position: 'relative' }}>
      <ScoutBlob size={96} />
      <h1 style={{ margin: '22px 0 0', fontSize: 34, lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em' }}>So suche ich für euch.</h1>
      <BottomSheet card title="Euer Suchauftrag"><FactList facts={facts} variant="compact" title="" editing={editing} drafts={drafts} onDraftChange={(id, v) => setDrafts(d => ({ ...d, [id]: v }))} style={{ width: '100%', padding: 0, background: 'none', border: 0 }} />{actions}</BottomSheet>
    </div>
  );
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 24px 40px', animation: 'rsFadeUp .7s ease both' }}>
      <ScoutBlob size={96} />
      <h1 style={{ margin: '22px 0 26px', fontSize: 'clamp(34px,4.6vw,52px)', lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em' }}>So suche ich für euch.</h1>
      <FactList variant="card" facts={facts} onEdit={() => setEditing(true)} editing={editing} drafts={drafts} onDraftChange={(id, v) => setDrafts(d => ({ ...d, [id]: v }))}>{actions}</FactList>
    </div>
  );
}

Object.assign(window, { Welcome, Discovery, Brief, BottomSheet, SCRIPT });
