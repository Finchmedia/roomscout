const DS5 = window.RoomScoutDesignSystem_e8f376;
const { Card: OCard, NavItem: ONav, NavGroupLabel: OGroup, Icon: OIc, Switch: OSw, Overline: OOvl, Button: OBtn, StatusDot: ODot, Badge: OBadge, Wordmark: OMark, Avatar: OAvatar, IconButton: OIcBtn, DataTable: OTable } = DS5;

const GREEN = 'success', AMBER = 'warning', GREY = 'rgba(255,255,255,.3)';
const OPAGES = { overview: ['bars', 'Übersicht'], sources: ['database', 'Quellen'], tasks: ['tasks', 'Aufträge'], integrations: ['plug', 'Integrationen'], flags: ['flag', 'Feature-Flags'], diag: ['pulse', 'Diagnose'] };
const LOGOS = { convex: 'logo-convex.svg', firecrawl: 'logo-firecrawl.svg', agentmail: 'logo-agentmail.png', openai: 'logo-openai.svg', browserbase: 'logo-browserbase.png' };
const FLAG_LABEL = { voice: 'Voice Scout', publicSearch: 'Öffentliche Quellensuche' };
const FLAG_EFFECT = { voice: 'Aus: keine neuen Demo-Voice-Sessions. Laufende Gespräche werden nicht abgeschnitten, Text bleibt nutzbar.', publicSearch: 'An: nur vorhandene fiktive Demo-Daten. Aus: öffentliche Quellen bleiben als Präferenz gespeichert, gelten aber als „In dieser Demo nicht aktiv“.' };
const OH1 = ({ children }) => <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-.02em' }}>{children}</h1>;
const OLead = ({ children }) => <p style={{ margin: '10px 0 0', fontSize: 19, color: 'var(--rs-ink-4)' }}>{children}</p>;
const SqBtn2 = ({ children, onClick, primary, style }) => <button onClick={onClick} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: primary ? 0 : '1px solid var(--rs-border-control-strong)', background: primary ? 'var(--rs-orange)' : 'var(--rs-surface-subtle)', color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: primary ? 600 : 400, cursor: 'pointer', ...style }}>{children}</button>;
const Logo = ({ id }) => LOGOS[id] ? <img src={'../../assets/partners/' + LOGOS[id]} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 5 }} /> : <OIc name="card" size={22} />;

/* Operator source row: technical linkage, expandable. Portal switch = Demo-Zugang verbunden/abgelaufen; public-source switch = Flag „Öffentliche Quellensuche“. */
function OpSourceRow({ x, flags, A }) {
  const [open, setOpen] = React.useState(x.id === 'roomscout');
  const portal = x.kind === 'portal';
  const on = portal ? x.access === 'connected' : !!flags.publicSearch;
  const tone = portal ? (on ? GREEN : AMBER) : (on ? GREEN : GREY);
  const label = portal ? (on ? 'Angebunden · Demo-Zugang' : 'Zugang braucht Anmeldung') : (on ? 'Öffentliche Anzeigen · Demo-Daten' : 'Nicht aktiv (Flag aus)');
  const desc = portal ? x.region + ' · Kontrolliertes Demo-Portal' : x.region + ' · Öffentliche Anzeigen';
  const icon = x.id === 'roomscout' ? <img src="../../assets/logo-roomscout.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} /> : <OIc name={x.id === 'musiker' ? 'users' : 'music'} size={22} />;
  return (
    <div style={{ borderRadius: 18, background: on ? 'rgba(255,255,255,.03)' : 'transparent', border: `1px solid ${on ? 'var(--rs-border-card-soft)' : 'transparent'}`, marginBottom: 8, transition: 'background .25s,border-color .25s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr) auto auto auto', alignItems: 'center', gap: 18, padding: '16px 16px 16px 14px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid var(--rs-border-control)', background: 'var(--rs-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 19 }}>{x.name}</div><div style={{ marginTop: 2, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>{desc}</div></div>
        <ODot tone={tone}>{label}</ODot>
        <OSw checked={on} onChange={v => portal ? A.setAccess('roomscout', v ? 'connected' : 'expired') : A.setFlags({ ...flags, publicSearch: v })} label={portal ? 'Demo-Zugang' : 'Öffentliche Quellensuche'} />
        <OIcBtn variant="bare" size={36} label="Details" aria-expanded={open} onClick={() => setOpen(o => !o)}><OIc name="chevron-down" size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} /></OIcBtn>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .26s cubic-bezier(.3,.7,.2,1)' }}><div style={{ overflow: 'hidden', minHeight: 0 }}><div style={{ margin: '0 16px', padding: '16px 8px 18px', borderTop: '1px solid var(--rs-border-divider)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '8px 24px', fontSize: 15, lineHeight: 1.6, color: 'var(--rs-ink-2)' }}>
        <div><span style={{ color: 'var(--rs-ink-6)' }}>Region:</span> {x.region}</div>
        <div><span style={{ color: 'var(--rs-ink-6)' }}>Anbindung:</span> {portal ? 'Portal-Sitzung über Browserbase' : 'Öffentliche Anzeigen (Firecrawl)'}</div>
        <div><span style={{ color: 'var(--rs-ink-6)' }}>Letzter Demo-Check:</span> {portal ? (x.lastAccess || 'Heute · Demo-Lauf') : '—'}</div>
        <div style={{ gridColumn: '1/-1', color: 'var(--rs-ink-4)', fontSize: 14.5 }}>{portal ? 'Der Schalter simuliert den Demo-Zugang: aus = Anmeldung abgelaufen, die Band sieht einen Hinweis in ihren Zugängen.' : 'Der Schalter entspricht dem Feature-Flag „Öffentliche Quellensuche“ und gilt für alle öffentlichen Quellen.'}</div>
      </div></div></div>
    </div>
  );
}

function Operator({ d, A, page, setPage, back }) {
  const [diag, setDiag] = React.useState(false); const [filter, setFilter] = React.useState('all'); const [openTask, setOpenTask] = React.useState(null); const [openInt, setOpenInt] = React.useState(null); const [flagDraft, setFlagDraft] = React.useState(null); const [flagsSaved, setFlagsSaved] = React.useState(false);
  const inc = !!d.incident, open = inc && !d.incidentResolved, resolved = inc && !!d.incidentResolved;
  const F = flagDraft || d.flags;
  const mk = (id, name, status, detail) => { const m = { done: ['Abgeschlossen', GREEN], expired: ['Anmeldung abgelaufen', AMBER], blocked: ['Wartet auf Zugang', GREY], planned: ['Geplant', GREY], resumed: ['Fortgesetzt (einmalig)', GREEN] }[status]; return { id, name, status: m[0], tone: m[1], diag: status === 'expired', attention: status === 'expired', detail }; };
  const tasks = [mk('t1', 'Neue Anzeigen prüfen', 'done', 'Öffentliche Anzeigen auf roomscout.dev wurden im Demo-Lauf geprüft. Ein passender Raum in Stuttgart-West wurde markiert.'), mk('t2', 'Portal-Nachrichten lesen', open ? 'expired' : (inc || d.contacted ? 'done' : 'planned'), open ? '' : 'Antworten im Portal werden über den verbundenen Demo-Zugang gelesen.'), mk('t3', 'Anfrage vorbereiten', open ? 'blocked' : (resolved ? 'resumed' : (d.contacted ? 'done' : 'planned')), open ? 'Wartet, bis der Portalzugang erneut verbunden ist. Es wird keine Anfrage doppelt gesendet.' : (resolved ? 'Nach der erneuerten Anmeldung einmalig fortgesetzt.' : 'Anfrage an den Anbieter im Rahmen des Handlungsspielraums der Band.'))];
  const ints = [
    { id: 'convex', name: 'Convex AI Gateway', role: 'Text & Auswertung', status: 'Bereit', tone: GREEN, config: 'Konfiguriert', test: 'Erfolgreich (Demo)', note: 'Verarbeitet Gesprächstext und Faktenextraktion im Demo-Lauf.' },
    { id: 'firecrawl', name: 'Firecrawl', role: 'Quellen beobachten', status: 'Konfiguriert', tone: GREY, config: 'Konfiguriert', test: 'Noch kein Demo-Test', note: 'Eine konfigurierte Integration ist kein Nachweis für einen erfolgreichen Live-Test.' },
    { id: 'agentmail', name: 'AgentMail', role: 'Scout-Postfächer', status: 'Bereit', tone: GREEN, config: 'Konfiguriert', test: 'Erfolgreich (Demo)', note: 'Stellt die Scout-Adressen bereit, über die Portal-Benachrichtigungen ankommen.' },
    { id: 'browserbase', name: 'Browserbase', role: 'Portal-Zugänge', status: open ? 'Prüfen' : 'Bereit', tone: open ? AMBER : GREEN, config: 'Konfiguriert', test: open ? '1 Portalzugang braucht eine neue Anmeldung' : 'Erfolgreich (Demo)', note: open ? 'Ein abgelaufener Portal-Login ist kein Ausfall von Browserbase insgesamt.' : 'Hält die Portal-Sitzungen für Lesen und Senden von Nachrichten.' },
    { id: 'openai', name: 'OpenAI direkt', role: 'Voice & Embeddings', status: 'Bereit', tone: GREEN, config: 'Konfiguriert', test: 'Erfolgreich (Demo)', note: 'Sprachein- und -ausgabe sowie Embeddings für die Einordnung von Anzeigen.' },
  ];
  const events = inc ? [['09:41', 'Portal-Benachrichtigung über neue Nachricht erhalten'], ['09:41', 'Öffnen der Portal-Nachricht fehlgeschlagen: Anmeldung abgelaufen'], ['09:42', 'Aufgabe „Portal-Nachrichten lesen“ als „Anmeldung abgelaufen“ markiert'], ['09:42', 'Aufgabe „Anfrage vorbereiten“ wartet auf Zugang'], ['09:42', 'Hinweis in den Zugängen der Band angezeigt']].concat(resolved ? [['Jetzt', 'Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt']] : []) : [];
  const flagEffects = ['voice', 'publicSearch'].filter(k => !!F[k] !== !!d.flags[k]).map(k => FLAG_LABEL[k] + ' → ' + (F[k] ? 'an' : 'aus') + '. ' + (k === 'voice' ? (F[k] ? 'Neue Demo-Voice-Sessions sind wieder möglich.' : 'Keine neuen Demo-Voice-Sessions; Suchwissen und laufende Gespräche bleiben erhalten.') : (F[k] ? 'Öffentliche Demo-Quellen werden für Nutzer aktiv. Kein Zugriff auf echte Portale.' : 'Öffentliche Quellen werden in den Nutzereinstellungen als nicht aktiv gekennzeichnet.')));
  const cols = [{ key: 'name', label: 'Vorgang', width: '1.3fr' }, { key: 'src', label: 'Quelle', muted: true }, { key: 'status', label: 'Status', width: '1.2fr' }, { key: 'next', label: 'Nächster Schritt' }];
  const taskRows = list => list.map(t => ({ name: t.name, src: 'roomscout.dev', status: <ODot tone={t.tone} style={{ fontSize: 16, color: 'var(--rs-ink)' }}>{t.status}</ODot>, next: t.diag ? <SqBtn2 onClick={() => setDiag(true)} style={{ height: 40, padding: '0 18px', borderRadius: 10 }}>Diagnose</SqBtn2> : <OBtn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', padding: '6px 0', fontSize: 15, textDecoration: openTask === t.id ? 'underline' : 'none' }} onClick={() => setOpenTask(o => o === t.id ? null : t.id)}>Details <OIc name="chevron-right" size={14} /></OBtn>, _highlight: t.diag, _detail: openTask === t.id ? t.detail : null }));
  const TaskTable = ({ list }) => <><OTable columns={cols} rows={taskRows(list)} />{list.filter(t => openTask === t.id).map(t => <div key={t.id} style={{ padding: '10px 14px 14px', fontSize: 14.5, color: 'var(--rs-ink-4)', lineHeight: 1.6, borderBottom: '1px solid var(--rs-border-divider-soft)', animation: 'rsFadeUp .2s ease both' }}>{t.detail}</div>)}</>;

  const pages = {
    overview: <>
      <OH1>Betrieb im Blick</OH1><OLead>Provider, Quellen und wartende Aufgaben.</OLead>
      {open ? <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px', borderRadius: 14, background: 'var(--rs-surface-amber-tint)', border: '1px solid rgba(224,161,58,.45)', animation: 'rsFadeUp .25s ease both' }}><div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 17 }}><span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--rs-amber)', color: '#1a1208', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>!</span>1 Aufgabe braucht Aufmerksamkeit</div><OBtn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', fontSize: 16 }} onClick={() => { setFilter('attention'); setPage('tasks'); }}>Ansehen <OIc name="chevron-right" size={16} /></OBtn></div>
      : <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card-soft)', fontSize: 15, color: 'var(--rs-ink-4)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rs-green)' }} />Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden.</div>}
      <OOvl style={{ marginTop: 26 }}>Integrationen</OOvl>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>{ints.slice(0, 4).map(t => <button key={t.id} onClick={() => { setPage('integrations'); setOpenInt(t.id); }} style={{ textAlign: 'left', padding: '18px 20px', borderRadius: 16, border: '1px solid var(--rs-border-card)', background: 'rgba(255,255,255,.03)', color: 'var(--rs-ink)', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Logo id={t.id} /></span><div><div style={{ fontSize: 16.5, fontWeight: 500 }}>{t.name}</div><div style={{ fontSize: 14, color: 'var(--rs-ink-4)', marginTop: 1 }}>{t.role}</div></div></div><ODot tone={t.tone}>{t.status}</ODot></button>)}</div>
      <div style={{ marginTop: 14, paddingBottom: 18, borderBottom: '1px solid var(--rs-border-divider)', display: 'flex', alignItems: 'center', gap: 14, fontSize: 16 }}><Logo id="openai" /><span>OpenAI direkt</span><span style={{ color: 'var(--rs-ink-6)' }}>·</span><span style={{ color: 'var(--rs-ink-4)' }}>Voice &amp; Embeddings</span><ODot tone={GREEN} style={{ marginLeft: 8 }}>Bereit</ODot></div>
      <OOvl style={{ marginTop: 24 }}>Aufgaben</OOvl>
      <div style={{ marginTop: 10 }}><TaskTable list={tasks} /></div>
      <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid var(--rs-border-divider)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
        <div><OOvl>Betriebsregeln</OOvl><div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--rs-border-divider-soft)', fontSize: 16 }}><span>Parallele Browser-Sessions</span><span style={{ color: 'var(--rs-ink-4)' }}>2</span></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', fontSize: 16 }}><span>Erneute Versuche</span><span style={{ color: 'var(--rs-ink-4)' }}>Mit zunehmendem Abstand</span></div><div style={{ marginTop: 6, fontSize: 13, color: 'var(--rs-ink-6)' }}>Illustrative Betriebsregeln, keine echten Worker-Pools.</div></div>
        <div style={{ borderLeft: '1px solid var(--rs-border-divider)', paddingLeft: 30 }}><OOvl>Feature-Flags</OOvl>{['voice', 'publicSearch'].map(k => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--rs-border-divider-soft)', fontSize: 16 }}><div>{FLAG_LABEL[k]}{k === 'publicSearch' && <div style={{ fontSize: 13.5, color: 'var(--rs-ink-6)', marginTop: 2 }}>Demo auf roomscout.dev begrenzt</div>}</div><ODot tone={d.flags[k] ? GREEN : GREY}>{d.flags[k] ? 'An' : 'Aus'}</ODot></div>)}<OBtn variant="link" size="2xs" style={{ marginTop: 10, color: 'var(--rs-ink)', padding: '4px 0', fontSize: 14.5 }} onClick={() => setPage('flags')}>Flags bearbeiten</OBtn></div>
      </div>
    </>,
    sources: <>
      <OH1>Quellen</OH1><OLead>Technische Anbindung der Demo-Quellen, unabhängig von Nutzerpräferenzen.</OLead>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><OOvl>Angebundene Quellen</OOvl><div style={{ fontSize: 14, color: 'var(--rs-ink-6)' }}>Demo-Lauf</div></div>
      <div style={{ marginTop: 12 }}>{d.sources.map(x => <OpSourceRow key={x.id} x={x} flags={d.flags} A={A} />)}</div>
      <div style={{ marginTop: 16, fontSize: 14.5, color: 'var(--rs-ink-6)', lineHeight: 1.6 }}>Der Demo-Lauf ist auf roomscout.dev begrenzt. Persönliche Quellenpräferenzen der Nutzer (z. B. „Bandnet für meine Suche ausschließen“) verändern diesen Status nicht.</div>
    </>,
    tasks: <>
      <OH1>Aufträge</OH1><OLead>Vorgänge des laufenden Demo-Auftrags.</OLead>
      <div style={{ marginTop: 22, display: 'flex', gap: 6 }}>{[['all', 'Alle'], ['attention', 'Braucht Aufmerksamkeit']].map(([v, l]) => <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)} style={{ height: 38, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,220,190,.2)', background: filter === v ? 'rgba(255,105,38,.3)' : 'var(--rs-surface-subtle)', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 14.5, cursor: 'pointer' }}>{l}</button>)}</div>
      <div style={{ marginTop: 16 }}><TaskTable list={filter === 'attention' ? tasks.filter(t => t.attention) : tasks} />{filter === 'attention' && !tasks.some(t => t.attention) && <div style={{ padding: '18px 14px', fontSize: 15, color: 'var(--rs-ink-6)' }}>Keine Aufgabe braucht Aufmerksamkeit.</div>}</div>
    </>,
    integrations: <>
      <OH1>Integrationen</OH1><OLead>Rolle und lokaler Demo-Status je Provider. Keine Schlüssel, keine Secrets.</OLead>
      <div style={{ marginTop: 26 }}>{ints.map(i => <div key={i.id} style={{ borderBottom: '1px solid var(--rs-border-divider)' }}>
        <button onClick={() => setOpenInt(o => o === i.id ? null : i.id)} aria-expanded={openInt === i.id} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1fr auto', gap: 14, alignItems: 'center', padding: '16px 10px', border: 0, background: 'none', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 16, textAlign: 'left', cursor: 'pointer', borderRadius: 10 }}><span style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500 }}><span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Logo id={i.id} /></span>{i.name}</span><span style={{ color: 'var(--rs-ink-4)' }}>{i.role}</span><ODot tone={i.tone} style={{ fontSize: 16, color: 'var(--rs-ink)' }}>{i.status}</ODot><OIc name="chevron-down" size={16} style={{ transform: openInt === i.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /></button>
        {openInt === i.id && <div style={{ padding: '4px 10px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '10px 24px', fontSize: 14.5, lineHeight: 1.6, animation: 'rsFadeUp .2s ease both' }}><div><span style={{ color: 'var(--rs-ink-6)' }}>Konfiguration:</span> {i.config}</div><div><span style={{ color: 'var(--rs-ink-6)' }}>Letzter Demo-Test:</span> {i.test}</div><div style={{ gridColumn: '1/-1', color: 'var(--rs-ink-4)' }}>{i.note}</div></div>}
      </div>)}</div>
    </>,
    flags: <>
      <OH1>Feature-Flags</OH1><OLead>Lokale Demo-Änderungen, keine Deployments.</OLead>
      <div style={{ marginTop: 26 }}>{['voice', 'publicSearch'].map(k => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '18px 0', borderBottom: '1px solid var(--rs-border-divider)' }}><div><div style={{ fontSize: 17 }}>{FLAG_LABEL[k]}</div><div style={{ marginTop: 3, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>{FLAG_EFFECT[k]}</div></div><OSw checked={!!F[k]} onChange={v => { setFlagDraft({ ...F, [k]: v }); setFlagsSaved(false); }} label={FLAG_LABEL[k]} /></div>)}</div>
      <div style={{ marginTop: 14, fontSize: 14.5, color: 'var(--rs-ink-6)' }}>Demo auf roomscout.dev begrenzt. Es startet kein echter Crawl.</div>
      {flagDraft && flagEffects.length > 0 && <div style={{ marginTop: 22, padding: '18px 22px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card)', animation: 'rsFadeUp .2s ease both' }}><OOvl>Wirkung vor dem Speichern</OOvl><ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 15, lineHeight: 1.7, color: 'var(--rs-ink-2)' }}>{flagEffects.map(e => <li key={e}>{e}</li>)}</ul><div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}><SqBtn2 onClick={() => setFlagDraft(null)}>Abbrechen</SqBtn2><SqBtn2 primary onClick={() => { A.setFlags({ ...F }); setFlagDraft(null); setFlagsSaved(true); setTimeout(() => setFlagsSaved(false), 2600); }}>Lokal speichern</SqBtn2></div></div>}
      {flagsSaved && <div role="status" style={{ marginTop: 16, fontSize: 14.5, color: 'var(--rs-ink-4)', animation: 'rsFadeUp .2s ease both' }}>Flags lokal gespeichert.</div>}
    </>,
    diag: <>
      <OH1>Diagnose</OH1><OLead>Verständliche Ereignisse aus den lokalen Demo-Daten.</OLead>
      {!inc ? <div style={{ marginTop: 26, padding: '22px 24px', borderRadius: 16, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card-soft)', fontSize: 16, color: 'var(--rs-ink-2)' }}>Keine offenen Störungen. Über die Demo-Steuerung lässt sich eine Beispielstörung laden.</div>
      : <><div style={{ marginTop: 26 }}>{events.map(([w, t], i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--rs-border-divider-soft)', fontSize: 15.5 }}><span style={{ color: 'var(--rs-ink-6)' }}>{w}</span><span>{t}</span></div>)}</div>{open && <SqBtn2 onClick={() => setDiag(true)} style={{ marginTop: 20 }}>Diagnose-Sheet öffnen</SqBtn2>}</>}
    </>,
  };

  return (
    <div style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'rsFadeUp .35s ease both' }}>
      <header style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><OMark /><OBadge variant="outline">Intern</OBadge></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><div style={{ height: 42, padding: '0 18px', borderRadius: 999, border: '1px solid var(--rs-border-card-strong)', background: 'var(--rs-surface-subtle)', display: 'flex', alignItems: 'center' }}><ODot tone={GREEN} style={{ gap: 10, color: 'var(--rs-ink)' }}>Entwicklung</ODot></div><OAvatar initials="OP" /></div>
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: '4px 36px 0', display: 'flex', flexDirection: 'column' }}>
        <OCard tone="panel" size="panel" padding={0} style={{ flex: 1, minHeight: 0, maxWidth: 1380, width: '100%', margin: '0 auto', position: 'relative', display: 'grid', gridTemplateColumns: '296px minmax(0,1fr)', overflow: 'hidden' }}>
          <nav style={{ padding: '36px 26px 30px', borderRight: '1px solid var(--rs-border-divider-soft)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto', scrollbarWidth: 'none' }}>
            <OBtn variant="ghost" icon={<OIc name="arrow-left" size={20} />} style={{ color: 'var(--rs-ink)', fontSize: 16, padding: '8px 10px', justifyContent: 'flex-start', gap: 12 }} onClick={back}>Zur App</OBtn>
            <OGroup style={{ margin: '34px 10px 10px' }}>Betrieb</OGroup>
            {Object.entries(OPAGES).map(([id, [ic, l]]) => <ONav key={id} current={page === id} icon={<OIc name={ic} size={20} />} onClick={() => setPage(id)} style={{ marginBottom: 4, ...(page === id ? { background: 'rgba(120,58,22,.45)', borderColor: 'rgba(255,140,90,.35)' } : {}) }}>{l}</ONav>)}
            <div style={{ flex: 1 }} /><div style={{ height: 1, background: 'var(--rs-border-divider)', margin: '24px 0 20px' }} /><div style={{ padding: '0 10px', fontSize: 15, color: 'var(--rs-ink-4)' }}>Nur für Betreiber</div>
          </nav>
          <section key={page} style={{ minHeight: 0, overflow: 'auto', scrollbarWidth: 'thin', padding: '42px 46px 40px', animation: 'rsFadeUp .2s ease-out both' }}>{pages[page]}</section>
          {diag && <>
            <div onClick={() => setDiag(false)} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(6,4,3,.55)', animation: 'rsFadeUp .2s ease both' }} />
            <div role="dialog" aria-modal="true" style={{ position: 'absolute', zIndex: 21, top: 0, right: 0, bottom: 0, width: 'min(500px,100%)', background: 'rgba(18,14,11,.98)', borderLeft: '1px solid var(--rs-border-panel)', padding: 34, overflow: 'auto', display: 'flex', flexDirection: 'column', animation: 'rsFadeUp .25s ease both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 26, fontWeight: 500 }}>Diagnose</h2><OIcBtn variant="subtle" size={40} label="Schließen" onClick={() => setDiag(false)}><OIc name="close" size={18} /></OIcBtn></div>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 16, lineHeight: 1.5 }}>
                {[['Vorgang', 'Portal-Nachrichten lesen'], ['Portal', 'roomscout.dev · Profil Herzbuben'], ['Zustand', <ODot tone={open ? AMBER : GREEN} style={{ fontSize: 16, color: 'var(--rs-ink)' }}>{open ? 'Anmeldung abgelaufen' : 'Verbunden (erneuert)'}</ODot>]].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--rs-border-divider)' }}><span style={{ color: 'var(--rs-ink-6)' }}>{k}</span><span>{v}</span></div>)}
                {[['Ursache', 'Die gespeicherte Anmeldung ist abgelaufen.'], ['Auswirkung', 'Private Portalnachrichten können momentan nicht gelesen werden. Die Suche nach Anzeigen läuft weiter.'], ['Nächster Schritt', 'Portalzugang erneut verbinden. Die Band sieht dazu einen Hinweis in ihren Zugängen.']].map(([k, v]) => <div key={k}><div style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--rs-ink-6)' }}>{k}</div><div style={{ marginTop: 4 }}>{v}</div></div>)}
                <div><div style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--rs-ink-6)' }}>Ereignisfolge</div><div style={{ marginTop: 6 }}>{events.map(([w, t], i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,220,190,.06)', fontSize: 14.5 }}><span style={{ color: 'var(--rs-ink-6)' }}>{w}</span><span>{t}</span></div>)}</div></div>
              </div>
              <div style={{ flex: 1 }} />
              {open && <div style={{ marginTop: 24, padding: '16px 18px', borderRadius: 14, border: '1px dashed rgba(255,200,160,.35)', background: 'rgba(255,255,255,.03)' }}><OOvl tone="accent">Simulation</OOvl><div style={{ marginTop: 6, fontSize: 14.5, color: 'var(--rs-ink-4)', lineHeight: 1.55 }}>Setzt den Beispielzugang lokal auf „Verbunden“ und gibt die wartende Demo-Aufgabe einmalig frei. Bereits abgeschlossene Anfragen werden nicht erneut ausgelöst.</div><SqBtn2 primary onClick={A.renewLogin} style={{ marginTop: 14, width: '100%', height: 46 }}>Anmeldung als erneuert simulieren</SqBtn2></div>}
              {resolved && <div role="status" style={{ marginTop: 20, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.</div>}
            </div>
          </>}
        </OCard>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--rs-ink-6)', padding: '14px 0 12px' }}>Interner Status · Darstellung mit Beispieldaten</div>
      </div>
    </div>
  );
}
Object.assign(window, { Operator });
