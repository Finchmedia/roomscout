const DS3 = window.RoomScoutDesignSystem_e8f376;
const { Card: SCard, NavItem: SNav, NavGroupLabel: SGroup, Icon: SIc, Switch: SSw, RadioCard: SRadio, Stepper: SStep, Overline: SOvl, Button: SBtn, StatusDot: SDot, Notice: SNotice, Badge: SBadge, TextInput: SInput, IconButton: SIcBtn, Avatar: SAvatar } = DS3;

const SRC_META = { roomscout: { name: 'roomscout.dev', desc: 'Kontrolliertes Demo-Portal', logo: true }, musiker: { name: 'Musiker in deiner Stadt', desc: 'Stuttgart · Öffentliche Anzeigen', icon: 'users' }, bandnet: { name: 'Bandnet Hamburg', desc: 'Hamburg · Andere Region', icon: 'music' } };
const SqBtn = ({ children, onClick, primary, danger, disabled, style }) => <button onClick={onClick} disabled={disabled} style={{ height: 46, padding: '0 22px', borderRadius: 12, border: primary || danger ? 0 : '1px solid var(--rs-border-control-strong)', background: primary ? (disabled ? 'rgba(255,105,38,.4)' : 'var(--rs-orange)') : danger ? 'var(--rs-red)' : 'var(--rs-surface-subtle)', color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: primary || danger ? 600 : 400, cursor: disabled ? 'default' : 'pointer', ...style }}>{children}</button>;
const H1 = ({ children }) => <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-.02em' }}>{children}</h1>;
const Lead = ({ children }) => <p style={{ margin: '10px 0 0', fontSize: 19, color: 'var(--rs-ink-4)' }}>{children}</p>;
const Row = ({ children, style }) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--rs-border-divider)', ...style }}>{children}</div>;
const Saved = ({ show, text = 'Gespeichert' }) => show ? <span style={{ fontSize: 13, color: 'var(--rs-ink-6)', animation: 'rsFadeUp .2s ease both' }}>{text}</span> : null;

function SourceRow({ s, flags, toggle, openConn }) {
  const [open, setOpen] = React.useState(s.id === 'roomscout');
  const [saved, setSaved] = React.useState(false);
  const m = SRC_META[s.id];
  const status = s.kind === 'portal' ? (s.access === 'connected' ? ['Verbunden', 'success'] : ['Anmeldung nötig', 'warning']) : s.enabled ? (flags.publicSearch ? ['Öffentlich', 'muted'] : ['In dieser Demo nicht aktiv', 'muted']) : ['Ausgeschlossen', 'muted'];
  return (
    <div style={{ borderRadius: 18, background: s.enabled ? 'rgba(255,255,255,.03)' : 'transparent', border: `1px solid ${s.enabled ? 'var(--rs-border-card-soft)' : 'transparent'}`, marginBottom: 8, transition: 'background .25s,border-color .25s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr) auto auto auto', alignItems: 'center', gap: 18, padding: '16px 16px 16px 14px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid var(--rs-border-control)', background: 'var(--rs-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.logo ? <img src="../../assets/logo-roomscout.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} /> : <SIc name={m.icon} size={22} />}</div>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 19 }}>{m.name}</div><div style={{ marginTop: 2, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>{m.desc}</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SDot tone={status[1]}>{status[0]}</SDot><Saved show={saved} /></div>
        <SSw checked={s.enabled} onChange={() => { toggle(s.id); setSaved(true); setTimeout(() => setSaved(false), 1500); }} label={m.name} />
        <SIcBtn variant="bare" size={36} label="Details" aria-expanded={open} onClick={() => setOpen(o => !o)}><SIc name="chevron-down" size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} /></SIcBtn>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .26s cubic-bezier(.3,.7,.2,1)' }}><div style={{ overflow: 'hidden', minHeight: 0 }}><div style={{ margin: '0 16px', padding: '16px 8px 18px', borderTop: '1px solid var(--rs-border-divider)', display: 'flex', justifyContent: 'space-between', gap: 20, fontSize: 15, lineHeight: 1.6, color: 'var(--rs-ink-2)', flexWrap: 'wrap' }}>
        <div>
          {s.id === 'roomscout' && <><div style={{ color: 'var(--rs-ink)' }}>Portalprofil: Herzbuben</div><div>Anzeigen lesen und Nachrichten austauschen</div></>}
          {s.id === 'musiker' && <>Öffentliche Anzeigen können berücksichtigt werden. Der Kontaktweg hängt von der Anzeige ab.{!flags.publicSearch && <div style={{ marginTop: 6 }}><SBadge variant="muted">In dieser Demo nicht aktiv</SBadge></div>}</>}
          {s.id === 'bandnet' && 'Hamburg liegt außerhalb eurer Suche. Eine Anmeldung ist dafür nicht nötig.'}
          {!s.enabled && <div style={{ marginTop: 6, color: 'var(--rs-ink-6)' }}>Keine neuen Anfragen über diese Quelle. Vorhandene Gespräche bleiben sichtbar.</div>}
        </div>
        {s.kind === 'portal' && <SBtn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', padding: '6px 4px', fontSize: 15, textDecorationColor: 'rgba(255,220,190,.4)' }} onClick={openConn}>{s.access === 'connected' ? 'Verbindung verwalten' : 'Erneut anmelden'} <SIc name="arrow-up-right" size={14} /></SBtn>}
      </div></div></div>
    </div>
  );
}

function SourcesPage({ d, A, setSheet }) {
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const [q, setQ] = React.useState('');
  const usable = d.sources.filter(s => s.enabled && (s.kind === 'portal' || d.flags.publicSearch));
  const extra = [{ name: 'Proberaum-Börse Süd', region: 'Baden-Württemberg', state: 'Nicht angebunden' }, { name: 'Bandraum München', region: 'München · Andere Region', state: 'Nicht angebunden' }].filter(x => !q || (x.name + x.region).toLowerCase().includes(q.toLowerCase()));
  return <>
    <H1>Wo darf dein Scout suchen?</H1>
    <Lead>{d.hasOrder ? 'Für eure Suche in Stuttgart.' : 'Quellen gelten für eine konkrete Suche.'}</Lead>
    {!d.hasOrder && <div style={{ marginTop: 28, padding: '24px 26px', borderRadius: 18, background: 'var(--rs-surface-subtle)', border: '1px solid var(--rs-border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}><div><div style={{ fontSize: 18 }}>Lege zuerst einen Suchauftrag an.</div><div style={{ marginTop: 4, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Quellen gelten immer für eine konkrete Suche. Deine Portalzugänge bleiben davon unabhängig.</div></div><SBtn size="sm" onClick={A.back}>Zum Scout</SBtn></div>}
    {d.hasOrder && <>
      <div style={{ marginTop: 26, padding: '22px 0', borderTop: '1px solid var(--rs-border-divider)', borderBottom: '1px solid var(--rs-border-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div><div style={{ fontSize: 20 }}>Passende Quellen automatisch auswählen</div><div style={{ marginTop: 4, fontSize: 15, color: 'var(--rs-ink-4)' }}>Deine Ausschlüsse bleiben erhalten.</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Saved show={saved} /><SSw checked={d.autoSources} onChange={v => { A.setAutoSources(v); setSaved(true); setTimeout(() => setSaved(false), 1500); }} label="Passende Quellen automatisch auswählen" /></div>
      </div>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><SOvl>Deine Quellen</SOvl><div style={{ fontSize: 14, color: 'var(--rs-ink-6)' }}>Für diese Suche</div></div>
      {!usable.length && <SNotice style={{ marginTop: 14, padding: '14px 18px' }} action={<SBtn size="2xs" onClick={() => A.toggleSource('roomscout')}>Quelle auswählen</SBtn>}>Aktuell ist keine nutzbare Quelle ausgewählt. Dein Scout kann so nicht weitersuchen.</SNotice>}
      <div style={{ marginTop: 12 }}>{d.sources.map(s => <SourceRow key={s.id} s={s} flags={d.flags} toggle={A.toggleSource} openConn={() => setSheet('conn')} />)}</div>
      <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid var(--rs-border-divider)', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 20, alignItems: 'start' }}>
        <SIc name="mail" size={26} style={{ marginTop: 4 }} />
        <div><div style={{ fontSize: 18 }}>Deine Scout-Adresse</div><div style={{ marginTop: 4, fontSize: 17, userSelect: 'all' }}>{d.name.toLowerCase()}@scout.roomscout.dev</div><div style={{ marginTop: 6, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Für Portal-Anmeldungen und Antworten an deinen Scout.</div></div>
        <SqBtn onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ minWidth: 120 }}>{copied ? 'Kopiert' : 'Kopieren'}</SqBtn>
      </div>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}><SBtn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', padding: '6px 0', fontSize: 15 }} onClick={() => setMore(m => !m)}>{more ? 'Weitere Quellen ausblenden' : 'Weitere Quellen anzeigen'}</SBtn><div style={{ fontSize: 14, color: 'var(--rs-ink-6)' }}>Eine Quelle auszuschließen löscht keinen Portal-Account.</div></div>
      {more && <SCard size="md" tone="faint" style={{ marginTop: 16, padding: '20px 22px', background: 'rgba(255,255,255,.03)', animation: 'rsFadeUp .2s ease both' }}>
        <SInput value={q} onChange={setQ} placeholder="Quelle oder Region suchen …" label="Quellen durchsuchen" />
        <div style={{ marginTop: 8 }}>{extra.map(m => <div key={m.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 16, alignItems: 'center', padding: '14px 4px', borderBottom: '1px solid var(--rs-border-divider-soft)' }}><div><div style={{ fontSize: 16 }}>{m.name}</div><div style={{ fontSize: 13.5, color: 'var(--rs-ink-6)', marginTop: 2 }}>{m.region}</div></div><SDot tone="muted" style={{ fontSize: 14 }}>{m.state}</SDot><SBtn variant="secondary" size="2xs" disabled style={{ minWidth: 130, fontSize: 14 }}>Vormerken</SBtn></div>)}{!extra.length && <div style={{ padding: '14px 4px', fontSize: 14.5, color: 'var(--rs-ink-6)' }}>Keine Quelle gefunden. Die Liste zeigt nur die vorhandenen Demo-Quellen.</div>}</div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--rs-ink-6)' }}>Demo-Quellen. Keine vollständige Liste aller Portale.</div>
      </SCard>}
    </>}
  </>;
}

function AutonomyPage({ d, A }) {
  const [draft, setDraft] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const [detA, setDetA] = React.useState(false); const [detB, setDetB] = React.useState(false); const [lim, setLim] = React.useState(false);
  const R = draft || d.rules; const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(d.rules);
  const invalid = !(Number.isInteger(Number(R.perDay)) && Number(R.perDay) > 0);
  const set = patch => setDraft({ ...R, ...patch });
  const SwRow = ({ k, label }) => <Row style={{ padding: '14px 0', fontSize: 17 }}><span>{label}</span><SSw checked={!!R[k]} onChange={v => set({ [k]: v })} label={label} /></Row>;
  return <>
    <H1>So arbeitet dein Scout</H1><Lead>Du bestimmst, wie selbstständig ich vorgehe.</Lead>
    <div role="radiogroup" style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
      <SRadio checked={R.mode === 'autopilot'} onSelect={() => set({ mode: 'autopilot' })} title="Autopilot" description="Suchen, anfragen und Details klären." />
      <SRadio checked={R.mode === 'review'} onSelect={() => set({ mode: 'review' })} title="Mit Rücksprache" description="Nachrichten vor dem Versand prüfen." />
    </div>
    <div style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><SOvl>Was ich selbstständig erledigen darf</SOvl><SBtn variant="ghost" size="2xs" style={{ color: 'var(--rs-ink-6)', fontSize: 13.5, padding: '2px 4px' }} onClick={() => setDetA(x => !x)}>Details</SBtn></div>
    {detA && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--rs-ink-4)', lineHeight: 1.6, animation: 'rsFadeUp .2s ease both' }}>Anschreiben umfasst Erstanfragen und Nachfragen zu Verfügbarkeit, Preis und Ausstattung. Besichtigungen werden nur vorgeschlagen, nie verbindlich zugesagt. Eine eigene Suchanzeige wäre öffentlich sichtbar und enthält nur freigegebene Informationen.</div>}
    <SwRow k="contact" label="Anbieter anschreiben" /><SwRow k="viewings" label="Besichtigungen vorschlagen" /><SwRow k="publishAd" label="Eigene Suchanzeige veröffentlichen" />
    <div style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><SOvl>Was ich teilen darf</SOvl><SBtn variant="ghost" size="2xs" style={{ color: 'var(--rs-ink-6)', fontSize: 13.5, padding: '2px 4px' }} onClick={() => setDetB(x => !x)}>Details</SBtn></div>
    {detB && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--rs-ink-4)', lineHeight: 1.6, animation: 'rsFadeUp .2s ease both' }}>Bandprofil: Bandname, Besetzung, Musikrichtung, gewünschte Probezeiten und die Scout-Adresse. Privat: persönliche Telefonnummern und genaue Wohnadressen. Diese Freigabe gilt unabhängig vom Arbeitsmodus.</div>}
    <SwRow k="shareProfile" label="Bandprofil weitergeben" /><SwRow k="sharePrivate" label="Private Kontaktdaten weitergeben" />
    <SOvl style={{ marginTop: 30 }}>Grenzen</SOvl>
    <Row style={{ padding: '14px 0', fontSize: 17, flexWrap: 'wrap' }}><span>Neue Anbieter pro Tag</span><div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}><SStep value={R.perDay} onChange={v => set({ perDay: v })} label="Neue Anbieter pro Tag" /><SBtn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', fontSize: 15, padding: '6px 2px' }} onClick={() => setLim(x => !x)}>Weitere Grenzen <SIc name="chevron-right" size={14} style={{ transform: lim ? 'rotate(90deg)' : 'none', transition: 'transform .25s' }} /></SBtn></div></Row>
    {invalid && <div role="alert" style={{ marginTop: 8, fontSize: 14, color: 'var(--rs-red-text)' }}>Bitte eine ganze Zahl größer als 0 eingeben.</div>}
    <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--rs-ink-6)' }}>Gemeint sind neue kontaktierte Anbieter, nicht die Nachrichten in einer laufenden Unterhaltung.</div>
    {lim && <div style={{ marginTop: 12, padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card-soft)', fontSize: 15, lineHeight: 1.7, color: 'var(--rs-ink-2)', animation: 'rsFadeUp .2s ease both' }}><div><span style={{ color: 'var(--rs-ink-6)' }}>Suchzeitraum:</span> bis ihr den Suchauftrag beendet oder ein Angebot annehmt.</div><div><span style={{ color: 'var(--rs-ink-6)' }}>Geltende Stopps:</span> Suche jederzeit im Hauptbereich pausierbar; verbindliche Zusagen nie automatisch.</div><div><span style={{ color: 'var(--rs-ink-6)' }}>Budget:</span> gehört zum Suchauftrag.</div></div>}
    <SCard tone="rust" size="md" style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px' }}><SIc name="lock" size={26} color="var(--rs-orange-light)" /><div><div style={{ fontSize: 17, fontWeight: 500 }}>Verbindliche Entscheidungen bleiben bei dir.</div><div style={{ marginTop: 3, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Verträge, Buchungen und Zahlungen brauchen immer deine Freigabe.</div></div></SCard>
    <div style={{ marginTop: 22, minHeight: 52, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
      {saved && <span style={{ fontSize: 14.5, color: 'var(--rs-ink-4)', marginRight: 'auto', animation: 'rsFadeUp .2s ease both' }}>Handlungsspielraum aktualisiert</span>}
      {dirty && <><SqBtn onClick={() => setDraft(null)} style={{ height: 48 }}>Abbrechen</SqBtn><SqBtn primary disabled={invalid} onClick={() => { A.saveRules({ ...R, perDay: Number(R.perDay) }); setDraft(null); setSaved(true); setTimeout(() => setSaved(false), 2600); }} style={{ height: 48 }}>Änderungen speichern</SqBtn></>}
    </div>
  </>;
}

const CATS = { band: 'Eure Band', alltag: 'Alltag & Wege', ausstattung: 'Ausstattung' };
const KICON = { band: 'users', budget: null, ort: 'pin', zeit: 'clock', equip: 'drum' };
function KnowledgePage({ d, A, go }) {
  const [tab, setTab] = React.useState('band');
  const [editId, setEditId] = React.useState(null); const [editText, setEditText] = React.useState('');
  const [menuId, setMenuId] = React.useState(null); const [originId, setOriginId] = React.useState(null);
  const [undo, setUndo] = React.useState(null); const [logOpen, setLogOpen] = React.useState(false); const [importOpen, setImportOpen] = React.useState(false);
  const rows = d.knowledge.filter(k => k.cat === tab && k.status !== 'retired');
  const icon = k => k.factId === 'budget' ? <span style={{ fontSize: 20 }}>€</span> : <SIc name={KICON[k.factId] || (k.cat === 'band' ? 'music' : k.cat === 'ausstattung' ? 'drum' : 'home')} size={22} strokeWidth={1.5} />;
  return <>
    <H1>Was ich über euch weiß</H1><Lead>Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke.</Lead>
    <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '20px 24px', borderRadius: 16, border: '1px solid var(--rs-border-panel)', background: 'rgba(255,255,255,.03)' }}><div style={{ fontSize: 18, lineHeight: 1.45 }}>{d.summary}</div><SIcBtn variant="bare" size={40} label="Zugrunde liegende Angaben bearbeiten" onClick={() => setTab('band')}><SIc name="edit" size={20} /></SIcBtn></div>
    <div role="tablist" style={{ marginTop: 22, display: 'flex', gap: 6, borderBottom: '1px solid var(--rs-border-divider)' }}>{Object.entries(CATS).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ height: 44, padding: '0 20px', border: 0, background: 'none', color: tab === k ? 'var(--rs-ink)' : 'var(--rs-ink-6)', fontFamily: 'inherit', fontSize: 17, cursor: 'pointer', borderBottom: `2px solid ${tab === k ? 'var(--rs-orange)' : 'transparent'}`, marginBottom: -1 }}>{l}</button>)}</div>
    <SOvl style={{ marginTop: 22 }}>{CATS[tab]}</SOvl>
    {!rows.length && <div style={{ marginTop: 14, padding: '22px 24px', borderRadius: 16, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card-soft)', fontSize: 17, color: 'var(--rs-ink-2)' }}>Dazu weiß ich noch nichts. Erzähl es mir im Gespräch.</div>}
    <div style={{ marginTop: 6 }}>{rows.map(k => <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '14px 8px', borderBottom: '1px solid var(--rs-border-divider)', position: 'relative' }}>
      <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rs-ink-2)' }}>{icon(k)}</span>
      <div style={{ minWidth: 0 }}>
        {editId === k.id ? <><form onSubmit={e => { e.preventDefault(); A.updateKnowledge(k.id, editText.trim()); setEditId(null); }} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><input value={editText} onChange={e => setEditText(e.target.value)} aria-label="Angabe bearbeiten" autoFocus style={{ flex: 1, minWidth: 220, height: 42, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,200,160,.3)', background: 'var(--rs-surface-inset)', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 16 }} /><SBtn type="submit" size="2xs" style={{ height: 42, fontSize: 14 }}>Speichern</SBtn><SBtn type="button" variant="secondary" size="2xs" style={{ height: 42, fontSize: 14 }} onClick={() => setEditId(null)}>Abbrechen</SBtn></form>{k.factId && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--rs-ink-6)' }}>Diese Angabe ist Teil eures Suchauftrags und wird dort ebenfalls aktualisiert.</div>}</>
        : <><div style={{ fontSize: 17 }}>{k.text}</div>{k.status === 'assumed' ? <span style={{ display: 'inline-flex', marginTop: 6, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--rs-border-accent)', background: 'var(--rs-surface-accent-tint-soft)', fontSize: 13, color: 'var(--rs-orange-tint)' }}>Noch zu bestätigen</span> : <div style={{ marginTop: 2, fontSize: 13.5, color: 'var(--rs-ink-6)' }}>{k.origin}</div>}{originId === k.id && <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--rs-ink-4)', animation: 'rsFadeUp .2s ease both' }}>Herkunft: {k.origin}. Verwendet für: {k.factId ? 'Suche und Anfragen' : 'Einordnung von Anzeigen'}.</div>}</>}
      </div>
      {k.status === 'assumed' ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><SBtn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', fontSize: 15 }} onClick={() => A.updateKnowledgeStatus(k.id, 'confirmed')}>Stimmt</SBtn><SBtn variant="ghost" size="2xs" style={{ fontSize: 15 }} onClick={() => A.updateKnowledgeStatus(k.id, 'retired')}>Nicht wichtig</SBtn></div>
      : editId !== k.id && <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}><SIcBtn variant="bare" size={40} label="Bearbeiten" onClick={() => { setEditId(k.id); setEditText(k.text); setMenuId(null); }}><SIc name="edit" size={18} /></SIcBtn><SIcBtn variant="bare" size={40} label="Mehr" aria-expanded={menuId === k.id} onClick={() => setMenuId(m => m === k.id ? null : k.id)}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="6" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18" cy="12" r="1.7" /></svg></SIcBtn>
        {menuId === k.id && <div role="menu" style={{ position: 'absolute', right: 0, top: 44, zIndex: 5, minWidth: 210, padding: 6, borderRadius: 12, background: 'rgba(20,15,12,.97)', border: '1px solid var(--rs-border-panel)', boxShadow: 'var(--shadow-toast)', display: 'flex', flexDirection: 'column', animation: 'rsFadeUp .15s ease both' }}><SBtn variant="ghost" size="2xs" style={{ justifyContent: 'flex-start', color: 'var(--rs-ink)', fontSize: 14.5, padding: '9px 12px' }} onClick={() => { A.updateKnowledgeStatus(k.id, 'retired'); setUndo(k); setMenuId(null); }}>Nicht mehr verwenden</SBtn><SBtn variant="ghost" size="2xs" style={{ justifyContent: 'flex-start', color: 'var(--rs-ink)', fontSize: 14.5, padding: '9px 12px' }} onClick={() => { setOriginId(o => o === k.id ? null : k.id); setMenuId(null); }}>Herkunft ansehen</SBtn></div>}
      </div>}
    </div>)}</div>
    {undo && <div role="status" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--rs-border-card)', fontSize: 14.5, animation: 'rsFadeUp .2s ease both' }}><span>„{undo.text}“ wird nicht mehr verwendet.</span><SBtn variant="ghost" size="2xs" style={{ color: 'var(--rs-orange-light)', fontWeight: 500, fontSize: 14.5 }} onClick={() => { A.updateKnowledgeStatus(undo.id, 'confirmed'); setUndo(null); }}>Rückgängig</SBtn></div>}
    <SBtn variant="link" size="2xs" style={{ marginTop: 16, color: 'var(--rs-ink)', fontSize: 15, padding: '6px 0' }} onClick={() => setLogOpen(o => !o)}>{logOpen ? 'Änderungen ausblenden' : 'Änderungen ansehen'}</SBtn>
    {logOpen && <div style={{ marginTop: 10, padding: '14px 20px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card-soft)', animation: 'rsFadeUp .2s ease both' }}>{!d.knowledgeLog.length && <div style={{ fontSize: 14.5, color: 'var(--rs-ink-6)', padding: '4px 0' }}>Noch keine Änderungen in dieser Demo.</div>}{d.knowledgeLog.map((l, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--rs-border-divider-soft)', fontSize: 14.5 }}><span>{l.text}</span><span style={{ color: 'var(--rs-ink-6)', whiteSpace: 'nowrap' }}>{l.when}</span></div>)}</div>}
    <div style={{ marginTop: 26, paddingTop: 24, borderTop: '1px solid var(--rs-border-divider)', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 20, alignItems: 'center' }}><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></svg><div><div style={{ fontSize: 18 }}>Dein bisheriger Kontext kann mitkommen</div><div style={{ marginTop: 4, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Musik-Kontext aus ChatGPT oder Claude übernehmen.</div></div><SqBtn onClick={() => setImportOpen(true)}>Kontext importieren</SqBtn></div>
    <SBtn variant="link" size="2xs" style={{ marginTop: 22, color: 'var(--rs-ink)', fontSize: 15, padding: '6px 0' }} onClick={() => go('privacy')}>Gespeicherte Informationen verwalten</SBtn>
    {importOpen && <ImportDialog close={() => setImportOpen(false)} apply={items => { A.addKnowledge(items); setImportOpen(false); }} />}
  </>;
}

const IMPORT_PROMPT = 'Fasse ausschließlich den musikbezogenen Kontext zusammen, den du tatsächlich über mich und meine Band kennst: Besetzung, Instrumente, Musikrichtung, Proberaumwünsche, Budget, Verfügbarkeit und relevante Wege. Erfinde nichts, kennzeichne Unsicheres und lasse Passwörter, Kontaktdaten und sachfremde persönliche Informationen weg. Falls dir kein solcher Kontext vorliegt, sage das ausdrücklich.';
const EXAMPLE = 'Wir sind eine fünfköpfige Band aus Stuttgart (zwei Gitarren, Bass, Schlagzeug, Gesang) und spielen Hardrock und Alternative. Wir proben meist abends nach 19 Uhr und kommen mit dem Auto, ein Parkplatz wäre hilfreich. Beim Budget bin ich unsicher, vermutlich bis 300 € im Monat.';
const IMPORT_CANDS = [{ id: 'i1', cat: 'band', text: 'Fünfköpfige Besetzung: zwei Gitarren, Bass, Schlagzeug, Gesang', conflict: 'Widerspricht „Geteilter Raum · 4 Personen“ aus dem Gespräch.' }, { id: 'i2', cat: 'band', text: 'Hardrock und Alternative' }, { id: 'i3', cat: 'alltag', text: 'Anreise mit dem Auto, Parkplatz hilfreich' }, { id: 'i4', cat: 'alltag', text: 'Proben meist abends nach 19 Uhr' }, { id: 'i5', cat: 'band', text: 'Budget unsicher, vermutlich bis 300 €', conflict: 'Euer Suchauftrag sagt bis 350 €. Bleibt unverändert.' }];
function ImportDialog({ close, apply }) {
  const [step, setStep] = React.useState(1); const [text, setText] = React.useState(''); const [free, setFree] = React.useState(false); const [picks, setPicks] = React.useState({ i2: true, i3: true, i4: true }); const [copied, setCopied] = React.useState(false);
  const n = Object.values(picks).filter(Boolean).length;
  return <>
    <div onClick={close} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(6,4,3,.6)', animation: 'rsFadeUp .2s ease both' }} />
    <div role="dialog" aria-modal="true" style={{ position: 'absolute', zIndex: 21, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(640px,calc(100% - 48px))', maxHeight: 'calc(100% - 48px)', overflow: 'auto', background: 'rgba(18,14,11,.98)', border: '1px solid var(--rs-border-panel)', borderRadius: 22, padding: '30px 32px', boxShadow: '0 30px 80px rgba(0,0,0,.5)', animation: 'rsFadeUp .25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><SOvl>Schritt {step} von 3</SOvl><h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 500 }}>{['Prompt kopieren', 'Kontext einfügen', 'Angaben prüfen'][step - 1]}</h2></div><SIcBtn variant="subtle" size={40} label="Schließen" onClick={close}><SIc name="close" size={18} /></SIcBtn></div>
      {step === 1 && <><div style={{ marginTop: 18, fontSize: 15, color: 'var(--rs-ink-4)' }}>Kopiere diesen Prompt in ChatGPT oder Claude und lass dir den musikbezogenen Kontext zusammenfassen.</div><div style={{ marginTop: 12, padding: '16px 18px', borderRadius: 14, background: 'var(--rs-surface-subtle)', border: '1px solid var(--rs-border-card)', fontSize: 14.5, lineHeight: 1.6, userSelect: 'all' }}>{IMPORT_PROMPT}</div><div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><SqBtn onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ minWidth: 150 }}>{copied ? 'Kopiert' : 'Prompt kopieren'}</SqBtn><SqBtn primary onClick={() => setStep(2)}>Weiter</SqBtn></div></>}
      {step === 2 && <><label style={{ display: 'block', marginTop: 18, fontSize: 14, color: 'var(--rs-ink-6)' }}>Musik-Kontext einfügen</label><textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Zusammenfassung hier einfügen …" style={{ marginTop: 6, width: '100%', padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,220,190,.2)', background: 'var(--rs-surface-inset)', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.55, resize: 'vertical' }} /><div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--rs-ink-6)' }}>Bitte keine Zugangsdaten oder sensiblen Informationen einfügen. Der Text wird nach dem Import nicht gespeichert.</div><div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><SqBtn onClick={() => setText(EXAMPLE)}>Beispiel einsetzen</SqBtn><div style={{ display: 'flex', gap: 10 }}><SqBtn onClick={() => setStep(1)}>Zurück</SqBtn><SqBtn primary disabled={!text.trim()} onClick={() => { setFree(text.trim() !== EXAMPLE); setStep(3); }}>Angaben prüfen</SqBtn></div></div></>}
      {step === 3 && (free ? <><div style={{ marginTop: 18, padding: '16px 18px', borderRadius: 14, background: 'var(--rs-surface-subtle)', border: '1px solid var(--rs-border-card)', fontSize: 15, lineHeight: 1.55, color: 'var(--rs-ink-2)' }}>Freitext wird in diesem Prototyp nicht automatisch ausgewertet. Für die Demo steht das vorbereitete Beispiel bereit; eigene Angaben kannst du im Gespräch oder direkt in der Wissensliste ergänzen.</div><div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}><SqBtn onClick={() => setStep(2)}>Zurück</SqBtn><SqBtn primary onClick={() => { setText(EXAMPLE); setFree(false); }}>Beispiel verwenden</SqBtn></div></>
      : <><div style={{ marginTop: 18, fontSize: 15, color: 'var(--rs-ink-4)' }}>Simulierte Auswertung des Beispiels. Wähle, was dein Scout sich merken soll.</div><div style={{ marginTop: 12 }}>{IMPORT_CANDS.map(c => <label key={c.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 14, alignItems: 'start', padding: '12px 6px', borderBottom: '1px solid var(--rs-border-divider-soft)', cursor: 'pointer' }}><input type="checkbox" checked={!!picks[c.id]} onChange={e => setPicks(p => ({ ...p, [c.id]: e.target.checked }))} style={{ marginTop: 4, width: 18, height: 18, accentColor: '#ff6926' }} /><div><div style={{ fontSize: 16 }}>{c.text}</div><div style={{ fontSize: 13, color: 'var(--rs-ink-6)', marginTop: 2 }}>{CATS[c.cat]}</div>{c.conflict && <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--rs-amber)' }}><span style={{ marginTop: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--rs-amber)', flex: 'none' }} />{c.conflict}</div>}</div></label>)}</div><div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 14, color: 'var(--rs-ink-6)' }}>{n} ausgewählt</span><div style={{ display: 'flex', gap: 10 }}><SqBtn onClick={() => setStep(2)}>Zurück</SqBtn><SqBtn primary disabled={!n} onClick={() => apply(IMPORT_CANDS.filter(c => picks[c.id]).map(c => ({ id: 'imp_' + c.id, cat: c.cat, text: c.text, origin: 'Aus importiertem Kontext', status: 'confirmed' })))}>Ausgewählte Angaben übernehmen</SqBtn></div></div></>)}
    </div>
  </>;
}

function ProfilePage({ d, A }) {
  const [draft, setDraft] = React.useState(d.name); const [saved, setSaved] = React.useState(false);
  const ini = draft.trim() === 'Herzbuben' ? 'HB' : draft.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'HB';
  return <>
    <H1>Dein Profil</H1><Lead>Wie soll dein Scout euch ansprechen?</Lead>
    <form onSubmit={e => { e.preventDefault(); A.setName(draft.trim()); setSaved(true); setTimeout(() => setSaved(false), 2200); }} style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 24, alignItems: 'center', paddingBottom: 26, borderBottom: '1px solid var(--rs-border-divider)' }}>
      <SAvatar size={72} initials={ini} />
      <div><label style={{ display: 'block', fontSize: 13, color: 'var(--rs-ink-6)', marginBottom: 6 }}>Anzeigename</label><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><input value={draft} onChange={e => setDraft(e.target.value)} aria-label="Anzeigename" style={{ flex: 1, minWidth: 220, height: 48, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,220,190,.2)', background: 'var(--rs-surface-inset)', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 17 }} /><SqBtn primary disabled={!draft.trim() || draft.trim() === d.name} style={{ height: 48 }}>Speichern</SqBtn></div>{saved && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--rs-ink-4)', animation: 'rsFadeUp .2s ease both' }}>Name gespeichert. Ansprache und Initialen sind aktualisiert.</div>}</div>
    </form>
    <Row style={{ padding: '22px 0' }}><div><div style={{ fontSize: 17 }}>Demo-Login</div><div style={{ marginTop: 3, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Lokale Beispielidentität „herzbuben“ · keine echte Anmeldung</div></div><SBadge variant="muted" style={{ fontSize: 13.5, padding: '5px 12px' }}>Designprototyp</SBadge></Row>
    <div style={{ padding: '22px 0', fontSize: 14.5, color: 'var(--rs-ink-4)', lineHeight: 1.6 }}>Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namensänderung nicht umbenannt.</div>
  </>;
}

function NotifPage({ d, A }) {
  const n = d.notif; const set = p => A.setNotif({ ...n, ...p });
  const rows = [['decision', 'Wenn eine Entscheidung nötig ist', 'Rückfragen des Anbieters, Terminabweichungen'], ['offer', 'Wenn ein Angebot eingeht', 'Konkrete Konditionen zum Prüfen'], ['digest', 'Tägliche Zusammenfassung', 'Was der Scout heute erledigt hat']];
  const Seg = ({ v, label }) => <button role="radio" aria-checked={n.channel === v} onClick={() => set({ channel: v })} style={{ height: 40, padding: '0 18px', borderRadius: 9, border: 0, background: n.channel === v ? 'rgba(255,255,255,.1)' : 'transparent', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', transition: 'background .15s' }}>{label}</button>;
  return <>
    <H1>Wann soll ich mich melden?</H1><Lead>Wichtiges erreicht dich immer in der App.</Lead>
    <div style={{ marginTop: 26 }}>{rows.map(([k, l, s]) => <Row key={k}><div><div style={{ fontSize: 17 }}>{l}</div><div style={{ marginTop: 2, fontSize: 14, color: 'var(--rs-ink-6)' }}>{s}</div></div><SSw checked={!!n[k]} onChange={v => set({ [k]: v })} label={l} /></Row>)}</div>
    <SOvl style={{ marginTop: 28 }}>Kanal</SOvl>
    <div role="radiogroup" style={{ marginTop: 12, display: 'inline-flex', padding: 4, borderRadius: 12, border: '1px solid var(--rs-border-panel)', background: 'rgba(0,0,0,.2)' }}><Seg v="app" label="In der App" /><Seg v="mail" label="Scout-Adresse (simuliert)" /></div>
    <div style={{ marginTop: 18, fontSize: 14.5, color: 'var(--rs-ink-4)', lineHeight: 1.6 }}>Präferenzen werden lokal gespeichert. Es wird keine Browser-Berechtigung angefragt und keine echte E-Mail versendet. Notwendige Entscheidungen bleiben in der App sichtbar, auch wenn Benachrichtigungen aus sind.</div>
  </>;
}

function BillingPage({ d }) {
  const [tariff, setTariff] = React.useState(false); const [pay, setPay] = React.useState(false);
  const Info = ({ children }) => <div style={{ marginTop: 14, padding: '18px 22px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid var(--rs-border-card-soft)', animation: 'rsFadeUp .2s ease both' }}>{children}</div>;
  const LineItem = ({ icon, t, s, btn, onClick }) => <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 20, alignItems: 'center', padding: '20px 0', borderBottom: '1px solid var(--rs-border-divider)' }}><SIc name={icon} size={26} strokeWidth={1.5} /><div><div style={{ fontSize: 17 }}>{t}</div><div style={{ marginTop: 2, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>{s}</div></div>{btn && <SqBtn onClick={onClick} style={{ height: 44, padding: '0 20px' }}>{btn}</SqBtn>}</div>;
  return <>
    <H1>Tarif &amp; Nutzung</H1><Lead>Dein Zugang, deine Aktivität und deine Abrechnung.</Lead>
    <SOvl style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid var(--rs-border-divider)' }}>Dein Zugang</SOvl>
    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, paddingBottom: 22, borderBottom: '1px solid var(--rs-border-divider)' }}><div><div style={{ fontSize: 22 }}>Demo-Zugang</div><div style={{ marginTop: 4, fontSize: 15, color: 'var(--rs-ink-4)' }}>Kein kostenpflichtiges Abonnement aktiv.</div></div><SqBtn onClick={() => setTariff(t => !t)}>Tarife ansehen</SqBtn></div>
    {tariff && <Info><div style={{ fontSize: 17 }}>Tarife sind noch nicht festgelegt.</div><div style={{ marginTop: 4, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>In diesem Prototyp kannst du RoomScout ausprobieren. Es wird nichts berechnet.</div></Info>}
    <SOvl style={{ marginTop: 24 }}>Aktivität im September</SOvl>
    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
      <div style={{ padding: '6px 0' }}><div style={{ fontSize: 40, fontWeight: 500, letterSpacing: '-.02em' }}>{d.usage.searches}</div><div style={{ marginTop: 2, fontSize: 16, color: 'var(--rs-ink-4)' }}>{d.usage.searches === 1 ? 'Suchauftrag' : 'Suchaufträge'}</div></div>
      <div style={{ padding: '6px 0 6px 28px', borderLeft: '1px solid rgba(255,220,190,.12)' }}><div style={{ fontSize: 40, fontWeight: 500, letterSpacing: '-.02em' }}>{d.usage.contacted}</div><div style={{ marginTop: 2, fontSize: 16, color: 'var(--rs-ink-4)' }}>Anbieter kontaktiert</div></div>
      <div style={{ padding: '6px 0 6px 28px', borderLeft: '1px solid rgba(255,220,190,.12)' }}><div style={{ fontSize: 22, paddingTop: 12, color: 'var(--rs-ink-2)' }}>Noch nicht erfasst</div><div style={{ marginTop: 6, fontSize: 16, color: 'var(--rs-ink-4)' }}>Gespräche mit Scout</div></div>
    </div>
    <div style={{ marginTop: 10, fontSize: 14, color: 'var(--rs-ink-6)', paddingBottom: 22, borderBottom: '1px solid var(--rs-border-divider)' }}>Aktivitätsübersicht, keine Abrechnungseinheiten.</div>
    <LineItem icon="card" t="Zahlungsdaten" s="Keine Zahlungsmethode hinterlegt" btn="Verwalten" onClick={() => setPay(p => !p)} />
    <LineItem icon="home" t="Rechnungsadresse" s="Noch nicht hinterlegt" btn="Hinzufügen" onClick={() => setPay(p => !p)} />
    {pay && <Info><div style={{ fontSize: 17 }}>Zahlungsverwaltung ist noch nicht eingerichtet.</div><div style={{ marginTop: 4, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Hier würdest du später deine Zahlungs- und Rechnungsdaten verwalten.</div></Info>}
    <SOvl style={{ marginTop: 24 }}>Rechnungen</SOvl>
    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 20, alignItems: 'center' }}><SIc name="doc" size={26} strokeWidth={1.5} /><div><div style={{ fontSize: 17 }}>Noch keine Rechnungen</div><div style={{ marginTop: 2, fontSize: 14.5, color: 'var(--rs-ink-4)' }}>Hier findest du später deine Belege.</div></div></div>
    <div style={{ marginTop: 28, textAlign: 'right', fontSize: 14, color: 'var(--rs-ink-6)' }}>Produktkonzept · Noch keine Zahlungsintegration</div>
  </>;
}

function PrivacyPage({ d, go, showToast }) {
  const Item = ({ t, s, btn, onClick, first }) => <Row style={{ padding: '18px 0', borderTop: first ? '1px solid var(--rs-border-divider)' : 0 }}><div><div style={{ fontSize: 17 }}>{t}</div><div style={{ marginTop: 2, fontSize: 14.5, color: 'var(--rs-ink-4)', lineHeight: 1.6 }}>{s}</div></div>{btn && <SqBtn onClick={onClick} style={{ height: 42, padding: '0 18px', fontSize: 14.5 }}>{btn}</SqBtn>}</Row>;
  const connected = d.sources.filter(s => s.kind === 'portal' && s.access === 'connected').length;
  return <>
    <H1>Deine Daten, deine Kontrolle</H1><Lead>Was RoomScout in dieser Demo lokal speichert.</Lead>
    <div style={{ marginTop: 26 }}>
      <Item first t="Gespeicherte Angaben" s={d.knowledge.filter(k => k.status !== 'retired').length + ' Angaben über eure Band und Suche'} btn="Gespeicherte Angaben ansehen" onClick={() => go('knowledge')} />
      <Item t="Gesprächsverlauf" s="Mitschrift eurer Gespräche mit dem Scout, in der App einsehbar" />
      <Item t="Portalzugänge" s={connected + (connected === 1 ? ' verbundener Portalzugang, simuliert' : ' verbundene Portalzugänge, simuliert')} btn="Portalzugänge verwalten" onClick={() => go('sources')} />
      <Item t="Export" s="Exportiert ausschließlich die lokalen Demo-Daten dieses Prototyps als JSON." btn="Demo-Daten exportieren" onClick={() => showToast('Demo-Daten als JSON exportiert (simuliert).')} />
      <Item t="Konto löschen" s="Im späteren Produkt würde hier die endgültige Löschung aller Kontodaten angestoßen. In dieser Demo gibt es dafür noch keine Funktion; der Demo-Neustart ersetzt sie nicht." />
      <div style={{ padding: '18px 0' }}><div style={{ fontSize: 17 }}>Beteiligte Dienstleister</div><div style={{ marginTop: 2, fontSize: 14.5, color: 'var(--rs-ink-4)', lineHeight: 1.6 }}>Für Text und Auswertung, Quellenbeobachtung, Scout-Postfächer, Portal-Zugänge sowie Sprache: Convex, Firecrawl, AgentMail, Browserbase und OpenAI. Welche Daten dabei verarbeitet werden, hängt von der konkreten Funktion ab und wäre im Produkt einzeln erklärt.</div></div>
    </div>
  </>;
}

/* Right-hand sheet: portal connection (info · confirm disconnect · login simulation). */
function ConnSheet({ d, A, close }) {
  const src = d.sources.find(s => s.id === 'roomscout'); const [mode, setMode] = React.useState('info'); const [msg, setMsg] = React.useState(null);
  const ok = src.access === 'connected';
  return <>
    <div onClick={close} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(6,4,3,.55)', animation: 'rsFadeUp .2s ease both' }} />
    <div role="dialog" aria-modal="true" style={{ position: 'absolute', zIndex: 21, top: 0, right: 0, bottom: 0, width: 'min(480px,100%)', background: 'rgba(18,14,11,.98)', borderLeft: '1px solid var(--rs-border-panel)', padding: '34px 34px 30px', overflow: 'auto', display: 'flex', flexDirection: 'column', animation: 'rsFadeUp .25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: '-.01em' }}>Verbindung zu roomscout.dev</h2><SIcBtn variant="subtle" size={40} label="Schließen" onClick={close}><SIc name="close" size={18} /></SIcBtn></div>
      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 16, lineHeight: 1.5 }}>
        {[['Portalprofil', 'Herzbuben'], ['Zustand', <SDot tone={ok ? 'success' : 'warning'} style={{ fontSize: 16, color: 'var(--rs-ink)' }}>{ok ? 'Verbunden' : 'Anmeldung abgelaufen'}</SDot>], ['Letzter erfolgreicher Zugriff', src.lastAccess || 'Heute · Demo-Lauf']].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--rs-border-divider)' }}><span style={{ color: 'var(--rs-ink-6)' }}>{k}</span><span>{v}</span></div>)}
        <div style={{ color: 'var(--rs-ink-4)', fontSize: 15 }}>{ok ? 'Dein Scout kann Anzeigen lesen und private Nachrichten im Portal austauschen.' : 'Ohne gültige Anmeldung kann dein Scout keine privaten Portalnachrichten lesen oder senden.'}</div>
      </div>
      <div style={{ flex: 1 }} />
      {ok && mode === 'info' && <SqBtn onClick={() => setMode('confirm')} style={{ marginTop: 24, height: 48 }}>Verbindung trennen</SqBtn>}
      {mode === 'confirm' && <div style={{ marginTop: 24, padding: '18px 20px', borderRadius: 14, background: 'var(--rs-surface-subtle)', border: '1px solid var(--rs-border-panel)', animation: 'rsFadeUp .2s ease both' }}><div style={{ fontSize: 15.5, lineHeight: 1.5 }}>RoomScout verliert den gespeicherten Zugang. Dein Account auf dem Portal bleibt bestehen.</div><div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><SqBtn onClick={() => setMode('info')} style={{ height: 44 }}>Verbunden bleiben</SqBtn><SqBtn danger onClick={() => { A.setAccess('roomscout', 'disconnected'); setMode('info'); setMsg('Verbindung getrennt.'); }} style={{ height: 44 }}>Verbindung trennen</SqBtn></div></div>}
      {!ok && mode === 'info' && <><div style={{ marginTop: 24, fontSize: 15, color: 'var(--rs-ink-2)' }}>Zum Lesen oder Senden privater Nachrichten musst du dich verbinden.</div><SqBtn primary onClick={() => setMode('login')} style={{ marginTop: 14, height: 48 }}>Anmeldung öffnen</SqBtn></>}
      {mode === 'login' && <div style={{ marginTop: 24, padding: 20, borderRadius: 14, background: 'var(--rs-surface-subtle)', border: '1px dashed rgba(255,200,160,.35)', animation: 'rsFadeUp .2s ease both' }}><SOvl tone="accent">Demo-Anmeldesimulation</SOvl><div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55, color: 'var(--rs-ink-2)' }}>Dies ist keine echte Login-Seite von roomscout.dev. Es werden keine Zugangsdaten abgefragt oder gespeichert. Die Anmeldung wird lokal simuliert.</div><div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><SqBtn onClick={() => setMode('info')} style={{ height: 44 }}>Abbrechen</SqBtn><SqBtn primary onClick={() => { A.setAccess('roomscout', 'connected'); setMode('info'); setMsg('Verbunden. Dein Scout kann wieder Nachrichten lesen.'); }} style={{ height: 44 }}>Demo-Anmeldung abschließen</SqBtn></div></div>}
      {msg && <div role="status" style={{ marginTop: 14, fontSize: 14.5, color: 'var(--rs-ink-4)', animation: 'rsFadeUp .2s ease both' }}>{msg}</div>}
    </div>
  </>;
}

function Settings({ d, A, page, setPage, back, session }) {
  const [sheet, setSheet] = React.useState(null); const [toast, setToast] = React.useState(null);
  const showToast = t => { setToast(t); setTimeout(() => setToast(null), 2200); };
  const nav = [['sources', 'globe', 'Quellen & Zugänge'], ['autonomy', 'sliders', 'Handlungsspielraum'], ['knowledge', 'doc', 'Was dein Scout weiß']];
  const acct = [['profile', 'user', 'Profil'], ['notifications', 'bell', 'Benachrichtigungen'], ['billing', 'card', 'Tarif & Nutzung'], ['privacy', 'shield', 'Datenschutz']];
  const P = { sources: <SourcesPage d={d} A={A} setSheet={setSheet} />, autonomy: <AutonomyPage d={d} A={A} />, knowledge: <KnowledgePage d={d} A={A} go={setPage} />, profile: <ProfilePage d={d} A={A} />, notifications: <NotifPage d={d} A={A} />, billing: <BillingPage d={d} />, privacy: <PrivacyPage d={d} go={setPage} showToast={showToast} /> }[page];
  return (
    <div style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 36px 0', animation: 'rsFadeUp .35s ease both' }}>
      <SCard tone="panel" size="panel" padding={0} style={{ flex: 1, minHeight: 0, maxWidth: 1380, width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '296px minmax(0,1fr)', overflow: 'hidden', position: 'relative' }}>
        <nav style={{ padding: '36px 26px 30px', borderRight: '1px solid var(--rs-border-divider-soft)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto', scrollbarWidth: 'none' }}>
          <SBtn variant="ghost" icon={<SIc name="arrow-left" size={20} />} style={{ color: 'var(--rs-ink)', fontSize: 16, padding: '8px 10px', justifyContent: 'flex-start', gap: 12 }} onClick={back}>Zurück zum Scout</SBtn>
          {session && <div style={{ margin: '14px 10px 0', display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, lineHeight: 1.4, color: 'var(--rs-ink-4)' }}><span style={{ marginTop: 5, width: 7, height: 7, borderRadius: '50%', background: 'var(--rs-orange)', flex: 'none' }} />{session}</div>}
          <SGroup style={{ margin: '34px 10px 10px' }}>Dein Scout</SGroup>
          {nav.map(([id, ic, l]) => <SNav key={id} current={page === id} icon={<SIc name={ic} size={20} />} onClick={() => setPage(id)} style={{ marginBottom: 4 }}>{l}</SNav>)}
          <SGroup>Dein Konto</SGroup>
          {acct.map(([id, ic, l]) => <SNav key={id} current={page === id} icon={<SIc name={ic} size={20} />} onClick={() => setPage(id)} style={{ marginBottom: 4 }}>{l}</SNav>)}
          <div style={{ flex: 1 }} />
          <div style={{ height: 1, background: 'var(--rs-border-divider)', margin: '24px 0 20px' }} />
          <div style={{ padding: '0 10px' }}><div style={{ fontSize: 16, fontWeight: 500 }}>{d.name}</div><div style={{ fontSize: 14, color: 'var(--rs-ink-6)', marginTop: 2 }}>Persönlicher Bereich</div></div>
        </nav>
        <section key={page} style={{ minHeight: 0, overflow: 'auto', scrollbarWidth: 'thin', padding: '42px 46px 40px', animation: 'rsFadeUp .2s ease-out both' }}>{P}</section>
        {sheet === 'conn' && <ConnSheet d={d} A={A} close={() => setSheet(null)} />}
        {toast && <div role="status" style={{ position: 'absolute', zIndex: 40, left: '50%', bottom: 22, transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 12, background: 'rgba(28,20,14,.96)', border: '1px solid rgba(255,200,160,.22)', fontSize: 14, whiteSpace: 'nowrap', animation: 'rsFadeUp .2s ease both' }}>{toast}</div>}
      </SCard>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--rs-ink-6)', padding: '14px 0 12px' }}>Designprototyp · Beispieldaten</div>
    </div>
  );
}
Object.assign(window, { Settings });
