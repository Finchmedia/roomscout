const DS0 = window.RoomScoutDesignSystem_e8f376;
const { AppHeader, StatusDot: HDot, IconButton: HBtn, Icon: HIc, ProfileMenu, Toast: HToast, Hint: HHint, ChatBubble: HBubble } = DS0;

const FINAL_FACTS = [{ id: 'ort', label: 'Stuttgart' }, { id: 'budget', label: 'Bis 350 € / Monat' }, { id: 'band', label: 'Geteilter Raum · 4 Personen' }, { id: 'zeit', label: 'Donnerstags ab 19 Uhr' }, { id: 'equip', label: 'Schlagzeug darf im Raum bleiben' }];
const SOURCES0 = [{ id: 'roomscout', name: 'roomscout.dev', region: 'Stuttgart', enabled: true, access: 'connected', kind: 'portal', lastAccess: null }, { id: 'musiker', name: 'Musiker in deiner Stadt', region: 'Stuttgart', enabled: true, access: 'public', kind: 'public' }, { id: 'bandnet', name: 'Bandnet Hamburg', region: 'Hamburg', enabled: false, access: 'public', kind: 'public' }];
const RULES0 = { mode: 'autopilot', contact: true, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false, perDay: 5 };
const KNOW0 = [{ id: 'k_genre', cat: 'band', text: 'Hardrock und Alternative', origin: 'Demo-Bandprofil', status: 'confirmed' }, { id: 'k_mates', cat: 'band', text: 'Ähnliche Musikrichtung bei Mitnutzern wichtig', origin: 'Annahme deines Scouts', status: 'assumed' }, { id: 'k_amps', cat: 'ausstattung', text: 'Verstärker bringt ihr selbst mit', origin: 'Aus dem Gespräch', status: 'confirmed' }];
const FACT_CAT = { ort: 'alltag', budget: 'band', band: 'band', zeit: 'alltag', equip: 'ausstattung' };
const CHAPTERS = [['welcome', '1 · Willkommen'], ['discovery', '2 · Gespräch'], ['brief', '3 · Suchauftrag'], ['scouting', '4 · Autopilot'], ['clarification', '5 · Rückfrage'], ['dead_end', '5b · Sackgasse'], ['candidates', '5c · Kandidaten'], ['offer', '6 · Angebot'], ['offer_review', '7 · Prüfung'], ['complete', '8 · Abschluss']];
const now = () => { const d = new Date(); return 'Heute, ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };

function App() {
  const [stage, setStage] = React.useState('welcome');
  const [mode, setMode] = React.useState('voice');
  const [facts, setFacts] = React.useState([]);
  const [transcript, setTranscript] = React.useState([]);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [view, setView] = React.useState('scout');
  const [settingsPage, setSettingsPage] = React.useState('sources');
  const [opPage, setOpPage] = React.useState('overview');
  const [toast, setToast] = React.useState(null);
  const [hint, setHint] = React.useState(null);
  const [mobile, setMobile] = React.useState(false);
  const [name, setName] = React.useState('Herzbuben');
  const [sources, setSources] = React.useState(SOURCES0);
  const [autoSources, setAutoSources] = React.useState(true);
  const [rules, setRules] = React.useState(RULES0);
  const [flags, setFlags] = React.useState({ voice: true, publicSearch: false });
  const [knowledge, setKnowledge] = React.useState(KNOW0);
  const [knowledgeLog, setKnowledgeLog] = React.useState([]);
  const [notif, setNotif] = React.useState({ decision: true, offer: true, digest: false, channel: 'app' });
  const [incident, setIncident] = React.useState(false);
  const [incidentResolved, setIncidentResolved] = React.useState(false);
  const [offer, setOffer] = React.useState(CANDS[0]);
  const [offerStale, setOfferStale] = React.useState(false);
  const [ap, setAp] = React.useState({ kind: 'start' });
  const [status, setStatus] = React.useState('');
  const [activity, setActivity] = React.useState([]);
  const [pending, setPending] = React.useState(null);
  const [waitingFor, setWaitingFor] = React.useState(null);
  const hintT = React.useRef(null);

  const showHint = t => { setHint(t); clearTimeout(hintT.current); hintT.current = setTimeout(() => setHint(null), 4200); };
  const addActivity = a => setActivity(x => x.some(y => y.text === a.text) ? x : x.concat([a]));
  const logChange = text => setKnowledgeLog(l => l.concat([{ text, when: now() }]));
  const notify = text => { if (view !== 'scout') setToast(text); };
  const isAutopilot = stage === 'scouting';

  const go = (next, opts = {}) => {
    if (opts.reset) { setFacts([]); setTranscript([]); setActivity([]); setPending(null); setWaitingFor(null); setOffer(CANDS[0]); setOfferStale(false); setPaused(false); }
    if (opts.mode) setMode(opts.mode);
    if (['brief', 'scouting', 'clarification', 'dead_end', 'candidates', 'offer', 'offer_review', 'complete'].includes(next) && facts.length === 0) setFacts(FINAL_FACTS);
    if (next === 'scouting' && stage !== 'scouting' && !['clarification', 'dead_end', 'candidates'].includes(stage)) { setAp({ kind: 'start' }); setActivity([ACT.start]); setPending(null); setWaitingFor(null); }
    if (next === 'clarification') notify('Dein Scout hat eine Rückfrage');
    if (next === 'dead_end') notify('Dein Scout braucht eine Entscheidung');
    if (next === 'candidates') notify('Dein Scout hat Räume zum Vergleichen');
    if (next === 'offer') notify('Ein Angebot ist eingegangen');
    setStage(next); setMenuOpen(false);
  };
  const openSettings = p => { setView('settings'); if (p) setSettingsPage(p); setMenuOpen(false); setTranscriptOpen(false); if (isAutopilot && pending) setToast('Dein Scout wartet auf deine Freigabe'); };
  const backToScout = () => { setView('scout'); setToast(null); setMenuOpen(false); };
  const setAccess = (id, access) => { setSources(s => s.map(x => x.id === id ? { ...x, access, lastAccess: access === 'connected' ? now() : x.lastAccess } : x)); if (incident && access === 'connected') setIncidentResolved(true); if (waitingFor === 'access' && access === 'connected') { setWaitingFor(null); setAp({ kind: 'retry' }); } };
  const toggleSource = id => { setSources(s => s.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x)); if (waitingFor === 'source') { setWaitingFor(null); setAp({ kind: 'retry' }); } };
  const updateFact = (id, label) => { setFacts(f => f.map(x => x.id === id ? { ...x, label, changed: true } : x)); if (['offer', 'offer_review'].includes(stage)) setOfferStale(true); logChange('Angabe korrigiert: ' + label); setTimeout(() => setFacts(f => f.map(x => ({ ...x, changed: false }))), 1200); };
  const knowledgeItems = facts.map(f => ({ id: 'f_' + f.id, factId: f.id, cat: FACT_CAT[f.id], text: f.label, origin: 'Aus dem Gespräch · Teil eures Suchauftrags', status: 'confirmed' })).concat(knowledge.filter(k => k.id !== 'k_amps' || facts.some(f => f.id === 'equip')));
  const summary = (() => { const f = id => facts.find(x => x.id === id); const band = f('band'), ort = f('ort'), eq = f('equip'); if (!band && !ort && !eq) return 'Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch.'; let s = 'Ihr seid eine ' + (band && /4|vier/i.test(band.label) ? 'vierköpfige ' : '') + 'Band' + (ort ? ' aus ' + ort.label.replace(/ & Umland/, '') : '') + '.'; const p = []; if (band) p.push('sucht einen ' + (/geteilt/i.test(band.label) ? 'geteilten ' : '') + 'Proberaum'); if (eq && /schlagzeug/i.test(eq.label)) p.push('möchtet euer Schlagzeug dort lassen'); if (p.length) s += ' Ihr ' + p.join(' und ') + '.'; return s; })();
  const inFlow = ['scouting', 'clarification', 'dead_end', 'candidates', 'offer', 'offer_review', 'complete'].includes(stage);
  const hasOrder = facts.length > 0 && !['welcome', 'discovery'].includes(stage);
  const settingsData = { name, sources, autoSources, rules, flags, knowledge: knowledgeItems, knowledgeLog, summary, notif, hasOrder, usage: { searches: inFlow ? 1 : 0, contacted: activity.some(a => a.text === ACT.contacted.text) ? 1 : 0 } };
  const settingsActions = { back: backToScout, toggleSource, setAutoSources, setAccess, saveRules: r => { setRules(r); logChange('Handlungsspielraum aktualisiert'); if (pending && r.mode === 'autopilot' && r.contact) { setPending(null); setWaitingFor(null); setAp({ kind: 'contact' }); } }, setName, setNotif,
    updateKnowledge: (id, text) => { const k = knowledgeItems.find(x => x.id === id); if (k && k.factId) updateFact(k.factId, text); else { setKnowledge(ks => ks.map(x => x.id === id ? { ...x, text } : x)); logChange('Angabe korrigiert: ' + text); } },
    updateKnowledgeStatus: (id, status) => { setKnowledge(ks => ks.map(x => x.id === id ? { ...x, status } : x)); const k = knowledge.find(x => x.id === id); if (k) logChange((status === 'retired' ? 'Nicht mehr verwendet: ' : status === 'confirmed' ? 'Bestätigt: ' : '') + k.text); },
    addKnowledge: items => { setKnowledge(ks => ks.concat(items)); logChange(items.length + ' Angaben aus Beispiel-Kontext übernommen'); } };
  const opData = { sources, flags, incident, incidentResolved, contacted: activity.some(a => a.text === ACT.contacted.text) };
  const opActions = { setFlags, setAccess, renewLogin: () => setAccess('roomscout', 'connected') };
  const loadIncident = () => { setIncident(true); setIncidentResolved(false); setSources(s => s.map(x => x.id === 'roomscout' ? { ...x, access: 'expired' } : x)); setView('operator'); setOpPage('overview'); setMenuOpen(false); };

  const S = { welcome: Welcome, discovery: Discovery, brief: Brief, scouting: Autopilot, clarification: Clarification, dead_end: DeadEnd, candidates: Candidates, offer: Offer, offer_review: Review, complete: Complete }[stage];
  const screenProps = { go, name, narrow: mobile, mode, setMode, facts, setFacts, transcript, setTranscript, toggleTranscript: () => setTranscriptOpen(o => !o), paused, showHint, voiceOff: !flags.voice, ap, setAp, status, setStatus, activity, addActivity, rules, sources, flags, pending, setPending, waitingFor, setWaitingFor, openSettings, offer, setOffer, offerStale, logChange };
  const narrow = mobile;
  const session = isAutopilot ? (paused ? 'Suche pausiert' : 'Scout ist unterwegs') : null;

  const stageFrame = mobile ? { position: 'absolute', left: '50%', top: '50%', width: 390, height: 'min(844px, calc(100% - 32px))', transform: 'translate(-50%,-50%)', borderRadius: 44, border: '1px solid rgba(255,220,190,.2)' } : { position: 'absolute', inset: 0 };
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', background: 'var(--surface-page)' }} onClick={() => menuOpen && setMenuOpen(false)}>
      <div style={{ ...stageFrame, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)', transition: 'width .4s,height .4s,border-radius .4s' }}>
        <div className="rs-bg" /><div className="rs-grain" />
        {view !== 'operator' && <div style={{ position: 'relative', zIndex: 12, flex: 'none' }}>
          <AppHeader narrow={narrow} initials={name === 'Herzbuben' ? 'HB' : name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()} onAvatar={e => { e.stopPropagation(); setMenuOpen(o => !o); }} right={isAutopilot && view === 'scout' ? <><HDot pulse={!paused} tone={paused ? 'muted' : 'accent'}>{narrow ? '' : (paused ? 'Suche pausiert' : 'Scout ist unterwegs')}</HDot><HBtn size={narrow ? 38 : 42} label={paused ? 'Suche fortsetzen' : 'Suche pausieren'} onClick={() => setPaused(p => !p)}><HIc name={paused ? 'play' : 'pause'} size={16} /></HBtn></> : null} />
          {menuOpen && <div style={{ position: 'absolute', right: narrow ? 18 : 36, top: narrow ? 56 : 66 }} onClick={e => e.stopPropagation()}><ProfileMenu name={name} items={[{ label: 'Einstellungen', icon: <HIc name="sliders" size={17} />, onClick: () => openSettings() }, ...(view === 'settings' ? [{ label: 'Zurück zum Scout', icon: <HIc name="arrow-left" size={17} />, onClick: backToScout }] : [])]} /></div>}
        </div>}
        <main style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, overflow: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', display: view === 'scout' ? 'block' : 'none' }}>
          <S {...screenProps} />
        </main>
        {view === 'settings' && <Settings d={settingsData} A={settingsActions} page={settingsPage} setPage={setSettingsPage} back={backToScout} session={session} />}
        {view === 'operator' && <Operator d={opData} A={opActions} page={opPage} setPage={setOpPage} back={backToScout} />}
        {toast && view !== 'scout' && <div style={{ position: 'absolute', zIndex: 14, right: 24, top: 96 }}><HToast onAction={backToScout} onDismiss={() => setToast(null)}>{toast}</HToast></div>}
        {hint && <div style={{ position: 'absolute', zIndex: 8, left: '50%', bottom: 22, transform: 'translateX(-50%)', maxWidth: 'min(560px,calc(100% - 32px))' }}><HHint>{hint}</HHint></div>}
        {transcriptOpen && (
          <div style={{ position: 'absolute', zIndex: 9, top: 0, right: 0, bottom: 0, width: 'min(420px,100%)', background: 'var(--rs-surface-drawer)', borderLeft: '1px solid var(--rs-border-card-soft)', display: 'flex', flexDirection: 'column', animation: 'rsFadeUp .3s ease both' }}>
            <div style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flex: 'none' }}><div style={{ fontSize: 17, fontWeight: 500 }}>Mitschrift</div><HBtn variant="subtle" size={40} label="Mitschrift schließen" onClick={() => setTranscriptOpen(false)}><HIc name="close" size={18} /></HBtn></div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {transcript.length === 0 && <div style={{ fontSize: 14, color: 'var(--rs-ink-6)' }}>Noch keine Äußerungen.</div>}
              {transcript.map((m, i) => <HBubble key={i} who={m.who} compact label={m.who === 'scout' ? 'Dein Scout' : 'Du'} style={{ maxWidth: '88%' }}>{m.text}</HBubble>)}
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', zIndex: 10, left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 12px', borderRadius: 12, background: 'rgba(10,8,7,.88)', border: '1px solid var(--rs-border-neutral)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--rs-ink-6)', backdropFilter: 'blur(8px)', flexWrap: 'wrap', maxWidth: 'calc(100% - 32px)' }} onClick={e => e.stopPropagation()}>
        <span style={{ marginRight: 6 }}>Prototyp · Beispieldaten</span>
        <select value={view === 'scout' ? stage : view} onChange={e => { const v = e.target.value; if (v === 'settings') openSettings(); else if (v === 'operator') { setView('operator'); setMenuOpen(false); } else { setView('scout'); go(v); } }} aria-label="Kapitel" style={{ height: 30, borderRadius: 8, border: 0, background: 'rgba(255,255,255,.06)', color: 'var(--rs-ink)', font: 'inherit', padding: '0 6px', cursor: 'pointer' }}>{CHAPTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}<option value="settings">Einstellungen</option><option value="operator">Betreiberansicht</option></select>
        <button onClick={() => { setView('scout'); go('welcome', { reset: true }); }} aria-label="Zurück zum Anfang" title="Zurück zum Anfang" style={{ width: 30, height: 30, borderRadius: 8, border: 0, background: 'rgba(255,255,255,.06)', color: 'var(--rs-ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HIc name="restart" size={14} /></button>
        <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,.12)', margin: '0 2px' }} />
        {[['Mobil', () => setMobile(m => !m), mobile], ['Einstellungen', () => openSettings()], ['Betreiberansicht', () => { setView('operator'); setMenuOpen(false); }], ['Beispielstörung laden', loadIncident]].map(([l, fn, on]) => <button key={l} onClick={fn} aria-pressed={on} style={{ height: 30, padding: '0 8px', borderRadius: 8, border: 0, background: on ? 'rgba(255,105,38,.35)' : 'rgba(255,255,255,.06)', color: 'var(--rs-ink)', font: 'inherit', cursor: 'pointer' }}>{l}</button>)}
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
