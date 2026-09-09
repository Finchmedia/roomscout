const DS4 = window.RoomScoutDesignSystem_e8f376;
const { ScoutBlob: Blob4, Button: Btn4, Icon: Ic4, Card: Crd4, Overline: Ovl4, Badge: Bdg4, FactList: Facts4, SummaryPill: Pill4 } = DS4;

const CANDS = [
  { id: 'west', name: 'Raum in Stuttgart-West', short: 'Stuttgart-West', price: '280 € / Monat', priceNum: 280, time: 'Mittwochs, 19–22 Uhr', timeLower: 'mittwochs 19–22 Uhr', storage: 'Schlagzeug kann im Raum bleiben', storageOk: true, way: '12 Min. mit der Stadtbahn', size: 'ca. 28 m² · geteilt mit einer Band', note: 'Günstigster Raum, aber nur mittwochs frei.', photo: 'assets/proberaum.png' },
  { id: 'esslingen', name: 'Raum in Esslingen', short: 'Esslingen', price: '320 € / Monat', priceNum: 320, time: 'Donnerstags, 19–23 Uhr', timeLower: 'donnerstags 19–23 Uhr', storage: 'Schlagzeug kann im Raum bleiben', storageOk: true, way: '25 Min. mit der S-Bahn', size: 'ca. 35 m² · geteilt mit zwei Bands', note: 'Euer Wunschtag, dafür im Umland.', photo: null },
  { id: 'ost', name: 'Raum in Stuttgart-Ost', short: 'Stuttgart-Ost', price: '350 € / Monat', priceNum: 350, time: 'Donnerstags, ab 20 Uhr', timeLower: 'donnerstags ab 20 Uhr', storage: 'Schlagzeug müsste abgebaut werden', storageOk: false, way: '18 Min. mit der Stadtbahn', size: 'ca. 22 m² · geteilt mit drei Bands', note: 'Am Budgetlimit, und das Schlagzeug kann nicht bleiben.', photo: null },
];

/* 7b · Sackgasse: the Scout can't proceed; the band picks a compromise. */
function DeadEnd({ go, facts, setFacts, setAp, setTranscript, addActivity, logChange }) {
  const budgetNum = Number(((facts.find(f => f.id === 'budget') || {}).label || '350').replace(/\D/g, '')) || 350;
  const opts = [
    { k: 'budget', t: 'Budget bis ' + (budgetNum + 50) + ' €', s: 'Erweitert die Suche in Stuttgart um weitere Räume.', fid: 'budget', label: 'Bis ' + (budgetNum + 50) + ' € / Monat', line: 'Alles klar, bis ' + (budgetNum + 50) + ' Euro. Ich suche erneut in Stuttgart.' },
    { k: 'umland', t: 'Umland einbeziehen', s: 'Esslingen, Ludwigsburg, Fellbach · 20 bis 30 Minuten Weg.', fid: 'ort', label: 'Stuttgart & Umland', line: 'Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach.' },
    { k: 'zeit', t: 'Mittwoch doch erlauben', s: 'Der Raum in Stuttgart-West wäre dann verfügbar. Donnerstag bleibt gemerkt.', fid: 'zeit', label: 'Mittwoch oder Donnerstag ab 19 Uhr', line: 'Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an.' },
  ];
  const pick = o => { setFacts(f => f.map(x => x.id === o.fid ? { ...x, label: o.label, changed: true } : x)); setTranscript(t => t.concat([{ who: 'scout', text: o.line }])); addActivity({ text: 'Suchauftrag angepasst: ' + o.label }); logChange('Suchauftrag angepasst: ' + o.label); setAp({ kind: 'compromise', target: o.k, line: o.line }); go('scouting'); };
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '16px 24px 32px', animation: 'rsFadeUp .5s ease both' }}>
      <Blob4 size={110} style={{ marginBottom: 30 }} />
      <h1 style={{ margin: 0, fontSize: 'clamp(32px,4.6vw,52px)', lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em', textWrap: 'balance' }}>Da komme ich gerade nicht weiter.</h1>
      <Crd4 size="lg" tone="soft" style={{ marginTop: 26, width: 'min(700px,100%)', padding: '28px 30px' }}>
        <Ovl4>Raum in Stuttgart-West</Ovl4>
        <div style={{ marginTop: 10, fontSize: 'clamp(19px,2vw,24px)', lineHeight: 1.35, fontWeight: 300 }}>Der Anbieter kann Donnerstag nicht anbieten. Weitere Räume in Stuttgart, die zu eurem Suchauftrag passen, habe ich aktuell nicht gefunden.</div>
        <div style={{ marginTop: 22, fontSize: 15, color: 'var(--rs-ink-4)' }}>Was wäre für euch denkbar? Ich passe den Suchauftrag nur an, wenn ihr es sagt.</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map(o => <OptionRow key={o.k} title={o.t} sub={o.s} onClick={() => pick(o)} />)}
        </div>
      </Crd4>
      <Btn4 variant="link" style={{ marginTop: 20, fontSize: 15 }} onClick={() => { setAp({ kind: 'keep', line: 'Alles klar, ich suche im Hintergrund weiter und melde mich.' }); go('scouting'); }}>Nichts ändern, weiter suchen lassen</Btn4>
    </div>
  );
}
function OptionRow({ title, sub, onClick }) {
  const [h, setH] = React.useState(false);
  return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--rs-border-panel)', background: h ? 'rgba(255,255,255,.09)' : 'var(--rs-surface-subtle)', color: 'var(--rs-ink)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}><span><span style={{ display: 'block', fontSize: 17 }}>{title}</span><span style={{ display: 'block', marginTop: 2, fontSize: 14, color: 'var(--rs-ink-4)' }}>{sub}</span></span><Ic4 name="chevron-right" size={18} /></button>;
}

/* 7c · Kandidaten: three rooms side by side; the band decides where the Scout asks. */
function Candidates({ go, facts, setOffer, setAp, addActivity, narrow }) {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const budgetNum = Number(((facts.find(f => f.id === 'budget') || {}).label || '350').replace(/\D/g, '')) || 350;
  const ort = (facts.find(f => f.id === 'ort') || {}).label || 'Stuttgart';
  const list = CANDS.map(c => ({ ...c, fits: c.priceNum <= budgetNum, inArea: c.id !== 'esslingen' || /Umland/.test(ort) }));
  const best = list.filter(c => c.fits && c.storageOk && c.inArea).sort((a, b) => a.priceNum - b.priceNum)[0];
  const pick = c => { setOffer(c); addActivity({ text: 'Angebot angefragt: ' + c.short }); setAp({ kind: 'follow', line: 'Ich frage beim ' + c.name + ' nach einem Angebot und kläre die Details.' }); go('scouting'); };
  const row = (icon, text, muted) => <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: muted ? 'var(--rs-ink-4)' : 'inherit' }}>{icon}{text}</div>;
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 24px 32px' }}>
      <Blob4 size={72} style={{ marginBottom: 22 }} />
      <h1 style={{ margin: 0, fontSize: 'clamp(32px,4.6vw,52px)', lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em', textWrap: 'balance' }}>Drei Räume, die in Frage kommen.</h1>
      <p style={{ margin: '12px 0 0', fontSize: 17, color: 'var(--rs-ink-4)' }}>Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage.</p>
      <div style={{ marginTop: 28, width: 'min(1180px,100%)', display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0,1fr))', gap: 14, textAlign: 'left', animation: 'rsFadeUp .6s .1s ease both' }}>
        {list.map(c => { const isBest = best && best.id === c.id; return (
          <Crd4 key={c.id} size="lg" padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', borderColor: isBest ? 'var(--rs-border-accent)' : undefined }}>
            {isBest && <Bdg4 style={{ position: 'absolute', top: 14, left: 14, zIndex: 2 }}>Mein Vorschlag</Bdg4>}
            {c.photo ? <img src={'../../' + c.photo} alt="" style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover' }} /> : <div style={{ height: 150, background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--rs-ink-6)' }}>Foto folgt vom Anbieter</div>}
            <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div><div style={{ fontSize: 19 }}>{c.name}</div><div style={{ marginTop: 4, fontSize: 30, letterSpacing: '-.02em' }}>{c.price}</div><div style={{ marginTop: 2, fontSize: 13.5, color: c.fits ? 'var(--rs-ink-6)' : 'var(--rs-amber)' }}>{c.fits ? 'Im Budget' : 'Über eurem Budget (' + budgetNum + ' €)'}</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 15, paddingTop: 12, borderTop: '1px solid var(--rs-border-divider)' }}>
                {row(<Ic4 name="clock" size={18} color="var(--rs-ink-2)" style={{ marginTop: 1 }} />, c.time)}
                {row(c.storageOk ? <Ic4 name="check" size={18} color="var(--rs-orange)" style={{ marginTop: 1 }} /> : <Ic4 name="close" size={18} color="var(--rs-amber)" style={{ marginTop: 1 }} />, c.storage)}
                {row(<Ic4 name="pin" size={18} color="var(--rs-ink-2)" style={{ marginTop: 1 }} />, c.way)}
                {row(<Ic4 name="home" size={18} color="var(--rs-ink-2)" style={{ marginTop: 1 }} />, c.size, true)}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: 'var(--rs-ink-2)', paddingTop: 10, borderTop: '1px solid var(--rs-border-divider)' }}><span style={{ marginTop: 5, width: 10, height: 10, borderRadius: '46% 54% 52% 48%/55% 45% 55% 45%', background: 'var(--rs-orange)', flex: 'none', boxShadow: '0 0 8px rgba(255,105,38,.5)' }} />{c.note}</div>
              <div style={{ flex: 1 }} />
              <Btn4 size="sm" variant={isBest ? 'primary' : 'secondary'} block style={{ height: 48, fontWeight: 600, color: '#fff' }} onClick={() => pick(c)}>Diesen Raum anfragen</Btn4>
            </div>
          </Crd4>); })}
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn4 variant="link" style={{ fontSize: 15 }} onClick={() => { setAp({ kind: 'keep', line: 'Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt.' }); go('scouting'); }}>Keiner passt, weiter suchen</Btn4>
        <Pill4 size="sm" chevron open={briefOpen} onClick={() => setBriefOpen(o => !o)} style={{ height: 40 }}>Stuttgart · bis {budgetNum} €</Pill4>
      </div>
      {briefOpen && <Facts4 variant="compact" facts={facts} style={{ marginTop: 10 }} />}
    </div>
  );
}

Object.assign(window, { DeadEnd, Candidates, CANDS });
