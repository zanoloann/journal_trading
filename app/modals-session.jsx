// modals-session.jsx — New Session (batch add) modal + CSV perf parser
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;
const { Modal, Field, inputStyle, eligible } = window;

// ---------------- New Session (batch add) ----------------
// Parse broker export CSV (Performance.csv format):
// symbol(MESU6/ESU6) ... qty(col G) ... pnl(col J, $ or $(x)) ... boughtTimestamp(col K, MM/DD/YYYY ...)
function parsePerfCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { days: [], rowCount: 0, error: lines.length ? null : 'Fichier vide' };
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const ci = {
    symbol: header.indexOf('symbol') >= 0 ? header.indexOf('symbol') : 0,
    qty: header.indexOf('qty') >= 0 ? header.indexOf('qty') : 6,
    pnl: header.indexOf('pnl') >= 0 ? header.indexOf('pnl') : 9,
    bought: header.indexOf('boughttimestamp') >= 0 ? header.indexOf('boughttimestamp') : 10,
  };
  const parsePnl = (s) => {
    if (s == null) return NaN;
    let v = ('' + s).trim();
    const neg = /\(/.test(v) || /-/.test(v);
    v = v.replace(/[()$\s-]/g, '').replace(/,/g, '');
    const n = parseFloat(v);
    return isNaN(n) ? NaN : (neg ? -n : n);
  };
  const parseDate = (s) => {
    if (!s) return null;
    const d = ('' + s).trim().split(/\s+/)[0];
    const m = d.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (!m) { // maybe already ISO
      const iso = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (iso) return iso[1] + '-' + ('0' + iso[2]).slice(-2) + '-' + ('0' + iso[3]).slice(-2);
      return null;
    }
    let [, mm, dd, yy] = m; if (yy.length === 2) yy = '20' + yy;
    return yy + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2);
  };
  const parseSym = (s) => { const u = ('' + (s || '')).trim().toUpperCase(); return u.startsWith('MES') ? 'MES' : u.startsWith('ES') ? 'ES' : 'MES'; };
  const byDay = {};
  let rowCount = 0;
  lines.slice(1).forEach(line => {
    const cols = line.split(',');
    const date = parseDate(cols[ci.bought]);
    const gross = parsePnl(cols[ci.pnl]);
    const contracts = Math.max(1, Math.round(parseFloat(('' + (cols[ci.qty] || '1')).replace(',', '.')) || 1));
    const symbol = parseSym(cols[ci.symbol]);
    if (!date || isNaN(gross)) return;
    rowCount++;
    (byDay[date] = byDay[date] || []).push({ symbol, contracts, gross: +gross.toFixed(2) });
  });
  const days = Object.keys(byDay).sort().map(date => ({ date, trades: byDay[date] }));
  return { days, rowCount, error: rowCount ? null : 'Aucune ligne valide — vérifiez le format du fichier' };
}

function SessionModal({ onClose }) {
  const ctx = React.useContext(window.AppCtx);
  const fileRef = useRefM(null);
  const [imported, setImported] = useStateM(null); // null | [{date, trades, mindset, applied}]
  const [importErr, setImportErr] = useStateM('');
  const [dragOver, setDragOver] = useStateM(false);
  const [date, setDate] = useStateM(window.todayIso());
  const [noTrade, setNoTrade] = useStateM(false);
  const [replay, setReplay] = useStateM(false);
  const [sessionNotes, setSessionNotes] = useStateM('');
  const [ntMindset, setNtMindset] = useStateM(2);
  const [rows, setRows] = useStateM([{ symbol: 'MES', contracts: 1, gross: '', mindset: 2 }]);
  const [entryMode, setEntryMode] = useStateM('coef'); // 'coef' (maître × coef) | 'manual' (montant/compte → coef calculé)
  const [manual, setManual] = useStateM({ symbol: 'MES', contracts: 1, mindset: 2, amounts: {} });
  const [applied, setApplied] = useStateM(() => {
    const init = {};
    ctx.accounts.forEach(a => { init[a.id] = { on: a.status !== 'challenge', coef: a.coef }; });
    return init;
  });

  function defaultApplied() {
    const init = {};
    ctx.accounts.forEach(a => { init[a.id] = { on: a.status !== 'challenge', coef: a.coef }; });
    return init;
  }
  function ingestFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type && !/csv|text/.test(file.type)) {
      setImportErr('Format non supporté — déposez un fichier .csv'); setImported(null); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = parsePerfCSV(reader.result);
      if (res.error) { setImportErr(res.error); setImported(null); }
      else { setImportErr(''); setImported(res.days.map(d => ({ ...d, mindset: 2, applied: defaultApplied() }))); }
    };
    reader.readAsText(file);
  }
  function onFile(e) {
    ingestFile(e.target.files[0]);
    e.target.value = '';
  }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    ingestFile(file);
  }
  const setDayMindset = (i, v) => setImported(days => days.map((d, j) => j === i ? { ...d, mindset: v } : d));
  const toggleDayAcc = (i, id) => setImported(days => days.map((d, j) => j === i ? { ...d, applied: { ...d.applied, [id]: { ...d.applied[id], on: !d.applied[id].on } } } : d));
  function legsForAccounts(appliedMap, grossBase, contractsBase, symbol) {
    return ctx.accounts.filter(a => appliedMap[a.id] && appliedMap[a.id].on).map(a => {
      const coef = a.role === 'master' ? 1 : Number(appliedMap[a.id].coef) || 1;
      const contracts = a.role === 'master' ? contractsBase : Math.max(1, Math.round(contractsBase * coef));
      const gross = +(grossBase * coef).toFixed(2);
      const fees = +(window.accountFee(a, symbol) * contracts).toFixed(2);
      return { accountId: a.id, coef, contracts, gross, fees, pnl: +(gross - fees).toFixed(2) };
    });
  }
  function saveImport() {
    const list = [];
    imported.forEach(d => {
      if (isWeekendIso(d.date)) return;
      const accs = ctx.accounts.filter(a => d.applied[a.id] && d.applied[a.id].on);
      if (!accs.length) return;
      d.trades.forEach(t => {
        const accs = legsForAccounts(d.applied, t.gross, t.contracts, t.symbol);
        list.push({ symbol: t.symbol, contracts: t.contracts, date: d.date, gross: t.gross, mindset: d.mindset, notes: '', accounts: accs, refAccountId: window.computeRefAccountId(accs, ctx.accounts), hasChart: false });
      });
    });
    if (list.length) ctx.addTrades(list);
    onClose();
  }

  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, { symbol: rs.length ? rs[rs.length - 1].symbol : 'MES', contracts: 1, gross: '', mindset: 2 }]);
  const removeRow = (i) => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs);

  const selected = ctx.accounts.filter(a => applied[a.id].on);
  const validRows = rows.filter(r => r.gross !== '' && !isNaN(Number(r.gross)));

  function legsFor(grossBase, contractsBase, symbol) {
    return selected.map(a => {
      const coef = a.role === 'master' ? 1 : Number(applied[a.id].coef) || 0;
      const contracts = a.role === 'master' ? contractsBase : Math.max(1, Math.round(contractsBase * coef));
      const gross = +(grossBase * coef).toFixed(2);
      const fees = +(window.accountFee(a, symbol) * contracts).toFixed(2);
      return { accountId: a.id, coef, contracts, gross, fees, pnl: +(gross - fees).toFixed(2) };
    });
  }

  const masterAcc = ctx.accounts.find(a => a.role === 'master');
  // manual entry: per-account amount → coefficient computed from master amount
  const manualSel = ctx.accounts.filter(a => applied[a.id].on && manual.amounts[a.id] !== '' && manual.amounts[a.id] != null && !isNaN(Number(manual.amounts[a.id])));
  const manualMasterAcc = (masterAcc && manualSel.some(a => a.id === masterAcc.id)) ? masterAcc : manualSel[0];
  const masterAmount = manualMasterAcc ? Number(manual.amounts[manualMasterAcc.id]) : 0;
  function manualLegs() {
    return manualSel.map(a => {
      const amount = Number(manual.amounts[a.id]);
      const coef = (a.id === (manualMasterAcc && manualMasterAcc.id)) ? 1 : (masterAmount ? +(amount / masterAmount).toFixed(4) : 0);
      const contracts = a.id === (manualMasterAcc && manualMasterAcc.id) ? (Number(manual.contracts) || 1) : Math.max(1, Math.round((Number(manual.contracts) || 1) * Math.abs(coef)));
      const fees = +(window.accountFee(a, manual.symbol) * contracts).toFixed(2);
      return { accountId: a.id, coef, contracts, gross: +amount.toFixed(2), fees, pnl: +(amount - fees).toFixed(2), manual: true };
    });
  }
  // day net on master (sum of rows) + total net all accounts
  let masterNet = 0, allNet = 0, feesTotal = 0, masterGross = 0;
  validRows.forEach(r => {
    const g = Number(r.gross), c = Number(r.contracts) || 1;
    masterGross += g;
    masterNet += g - window.accountFee(masterAcc, r.symbol) * c;
    legsFor(g, c, r.symbol).forEach(l => { allNet += l.pnl; feesTotal += l.fees; });
  });

  function save() {
    if (replay && noTrade) {
      const leg = { accountId: window.REPLAY_ACCOUNT_ID, coef: 1, contracts: 0, gross: 0, fees: 0, pnl: 0 };
      ctx.addTrades([{ symbol: 'MES', contracts: 0, date, gross: 0, mindset: ntMindset, notes: sessionNotes, replay: true, refAccountId: null, accounts: [leg], hasChart: false, noTrade: true }]);
      onClose();
      return;
    }
    if (replay) {
      const list = validRows.map(r => {
        const grossBase = Number(r.gross), contractsBase = Number(r.contracts) || 1;
        const fee = +(window.FEE * contractsBase).toFixed(2);
        const leg = { accountId: window.REPLAY_ACCOUNT_ID, coef: 1, contracts: contractsBase, gross: grossBase, fees: fee, pnl: +(grossBase - fee).toFixed(2) };
        return { symbol: r.symbol, contracts: contractsBase, date, gross: grossBase, mindset: r.mindset, notes: sessionNotes, replay: true, refAccountId: null, accounts: [leg], hasChart: false };
      });
      if (list.length) ctx.addTrades(list);
      onClose();
      return;
    }
    if (isWeekend) return;
    if (noTrade) {
      ctx.addTrades([{ date, noTrade: true, notes: sessionNotes, mindset: ntMindset, accounts: [] }]);
      onClose();
      return;
    }
    if (entryMode === 'manual') {
      const legs = manualLegs();
      if (legs.length) ctx.addTrades([{ symbol: manual.symbol, contracts: Number(manual.contracts) || 1, date, gross: masterAmount, mindset: manual.mindset, notes: '', accounts: legs, refAccountId: window.computeRefAccountId(legs, ctx.accounts), hasChart: false }]);
      onClose();
      return;
    }
    const list = validRows.map(r => {
      const grossBase = Number(r.gross), contractsBase = Number(r.contracts) || 1;
      const accs = legsFor(grossBase, contractsBase, r.symbol);
      return { symbol: r.symbol, contracts: contractsBase, date, gross: grossBase, mindset: r.mindset, notes: '', accounts: accs, refAccountId: window.computeRefAccountId(accs, ctx.accounts), hasChart: false };
    });
    if (list.length) ctx.addTrades(list);
    onClose();
  }

  const inS = { padding: '8px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)', boxSizing: 'border-box' };
  const dow = new Date(date + 'T00:00:00').getDay();
  const isWeekend = dow === 0 || dow === 6;
  const canSave = replay ? (noTrade ? true : validRows.length > 0) : (isWeekend ? false : (noTrade ? true : (entryMode === 'manual' ? (manualSel.length > 0 && masterAmount !== 0) : (validRows.length && selected.length))));

  // import review totals
  const isWeekendIso = (iso) => { const dw = new Date(iso + 'T00:00:00').getDay(); return dw === 0 || dw === 6; };
  const importTradeCount = imported ? imported.reduce((s, d) => s + (!isWeekendIso(d.date) && ctx.accounts.some(a => d.applied[a.id] && d.applied[a.id].on) ? d.trades.length : 0), 0) : 0;
  const importConflicts = imported ? imported.filter(d => ctx.trades.some(t => t.date === d.date && !t.noTrade)).length : 0;

  if (imported) {
    return (
      <Modal onClose={onClose} width={760} title="Importer une séance (CSV)" subtitle={imported.length + ' jour' + (imported.length > 1 ? 's' : '') + ' détecté' + (imported.length > 1 ? 's' : '') + ' · cochez les comptes utilisés pour chaque journée'}
        footer={<><window.Button variant="ghost" onClick={() => setImported(null)}>Retour</window.Button><window.Button variant="primary" icon="check" onClick={saveImport} style={{ opacity: importTradeCount ? 1 : .5, pointerEvents: importTradeCount ? 'auto' : 'none' }}>Importer {importTradeCount} trade{importTradeCount > 1 ? 's' : ''}</window.Button></>}>
        {importConflicts > 0 && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <window.Icon name="alert" size={16} /> {importConflicts} journée{importConflicts > 1 ? 's' : ''} possède{importConflicts > 1 ? 'nt' : ''} déjà des trades dans l'application. L'import ajoutera de nouveaux trades sans remplacer les existants.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {imported.map((d, i) => {
            const dayGross = d.trades.reduce((s, t) => s + t.gross, 0);
            const dDow = new Date(d.date + 'T00:00:00').getDay();
            const weekendDay = dDow === 0 || dDow === 6;
            const conflict = ctx.trades.some(t => t.date === d.date && !t.noTrade);
            const nbOn = ctx.accounts.filter(a => d.applied[a.id] && d.applied[a.id].on).length;
            return (
              <div key={i} style={{ border: '1px solid ' + (weekendDay ? 'var(--loss)' : 'var(--border)'), borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <window.Badge>{d.trades.length} trade{d.trades.length > 1 ? 's' : ''}</window.Badge>
                    {conflict && <window.Badge tone="warn">déjà présent</window.Badge>}
                    {weekendDay && <window.Badge tone="loss">week-end</window.Badge>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Brut <window.PnL value={dayGross} dec={2} /></span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {/* trades preview */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {d.trades.map((t, k) => (
                      <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12 }}>
                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.symbol}</strong>
                        <span style={{ color: 'var(--ink-3)' }}>{t.contracts}c</span>
                        <window.PnL value={t.gross} dec={2} style={{ fontWeight: 700 }} />
                      </span>
                    ))}
                  </div>
                  {/* mental */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Note mentale</span>
                    <window.Segmented size="sm" value={d.mindset} onChange={v => setDayMindset(i, v)} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
                  </div>
                  {/* account toggles */}
                  {weekendDay ? (
                    <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <window.Icon name="alert" size={15} /> Journée de week-end — non importable.
                    </div>
                  ) : (
                  <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 }}>Comptes utilisés ce jour <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {nbOn} sélectionné{nbOn > 1 ? 's' : ''}</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {ctx.accounts.slice().sort((x, y) => (x.status === 'challenge' ? 1 : 0) - (y.status === 'challenge' ? 1 : 0)).map(a => {
                      const on = d.applied[a.id] && d.applied[a.id].on;
                      return (
                        <button key={a.id} onClick={() => toggleDayAcc(i, a.id)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
                          border: '1px solid ' + (on ? 'var(--ink)' : 'var(--border)'), background: on ? 'var(--surface)' : 'var(--surface-2)',
                          color: on ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, opacity: on ? 1 : .7,
                        }}>
                          <span style={{ width: 16, height: 16, borderRadius: 5, border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border-strong)'), background: on ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <window.Icon name="check" size={11} stroke={3} />}</span>
                          <window.AccountDot color={a.color} />
                          {a.name}{a.role !== 'master' ? ' ×' + a.coef : ''}
                          {a.status === 'challenge' && <window.Badge tone="warn" style={{ fontSize: 9, padding: '1px 5px' }}>Ch.</window.Badge>}
                        </button>
                      );
                    })}
                  </div>
                  </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width={720} title="Nouvelle séance" subtitle="Saisissez les trades de la séance · frais 1,04 $/contrat déduits"
      footer={<><window.Button variant="ghost" onClick={onClose}>Annuler</window.Button><window.Button variant="primary" icon="check" onClick={save} style={{ opacity: canSave ? 1 : .5, pointerEvents: canSave ? 'auto' : 'none' }}>{noTrade ? ('Marquer No Trade' + (replay ? ' (replay)' : '')) : replay ? ('Enregistrer ' + (validRows.length || '') + ' replay' + (validRows.length > 1 ? 's' : '')) : (entryMode === 'manual' ? 'Enregistrer la séance' : ('Enregistrer ' + (validRows.length || '') + ' trade' + (validRows.length > 1 ? 's' : '')))}</window.Button></>}>
      {ctx.accounts.length === 0 && !noTrade && !replay && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <window.Icon name="alert" size={16} /> Aucun compte. Créez d'abord un compte dans l'onglet « Comptes ».
        </div>
      )}
      {isWeekend && !replay && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <window.Icon name="alert" size={16} /> Cette date tombe un week-end — aucun enregistrement possible. Choisissez un jour de semaine.
        </div>
      )}

      {/* import CSV (click or drag & drop) */}
      {!replay && (
      <div
        onClick={() => fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
        onDrop={onDrop}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: '20px 16px', borderRadius: 12, cursor: 'pointer', marginBottom: 16, transition: 'all .15s', border: '1.5px dashed ' + (dragOver ? 'var(--ink)' : 'var(--border-strong)'), background: dragOver ? 'var(--surface-2)' : 'transparent' }}>
        <window.Icon name="arrowUp" size={20} style={{ color: dragOver ? 'var(--ink)' : 'var(--ink-3)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{dragOver ? 'Déposez le fichier ici' : 'Glissez-déposez un CSV de positions'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>ou cliquez pour parcourir · .csv</span>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
      </div>
      )}
      {importErr && !replay && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <window.Icon name="alert" size={16} /> {importErr}
        </div>
      )}

      {/* Replay toggle — practice/backtest trades, isolated on a single fictitious account, excluded from all real P&L */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', padding: '12px 14px', borderRadius: 11, border: '1px solid ' + (replay ? 'var(--ink)' : 'var(--border)'), background: replay ? 'var(--surface-2)' : 'transparent', marginBottom: 10 }}>
        <button type="button" onClick={() => setReplay(v => !v)}
          style={{ width: 22, height: 22, borderRadius: 7, border: '1.5px solid ' + (replay ? 'var(--ink)' : 'var(--border-strong)'), background: replay ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {replay && <window.Icon name="check" size={14} stroke={3} />}
        </button>
        <span><span style={{ fontWeight: 700, fontSize: 13.5 }}>Replay</span> <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>— séance d'entraînement, compte fictif, sans impact sur vos comptes réels</span></span>
      </label>

      {/* No Trade toggle — combinable with Replay: pas de position prise pendant une séance de replay → R=0 */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', padding: '12px 14px', borderRadius: 11, border: '1px solid ' + (noTrade ? 'var(--ink)' : 'var(--border)'), background: noTrade ? 'var(--surface-2)' : 'transparent', marginBottom: 16 }}>
        <button type="button" onClick={() => setNoTrade(v => !v)}
          style={{ width: 22, height: 22, borderRadius: 7, border: '1.5px solid ' + (noTrade ? 'var(--ink)' : 'var(--border-strong)'), background: noTrade ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {noTrade && <window.Icon name="check" size={14} stroke={3} />}
        </button>
        <span><span style={{ fontWeight: 700, fontSize: 13.5 }}>No Trade</span> <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>— aucune position prise ce jour{replay ? ' (R = 0 sur le replay)' : ''}</span></span>
      </label>

      {noTrade ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'end' }}>
            <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Note mentale">
              <window.Segmented value={ntMindset} onChange={setNtMindset} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{window.MINDSET_LABEL[ntMindset]}</div>
            </Field>
          </div>
          <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Pourquoi pas de trade ? (pas de setup, news, repos…)" /></Field>
        </div>
      ) : replay ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Date"><input type="date" style={{ ...inputStyle, maxWidth: 220 }} value={date} onChange={e => setDate(e.target.value)} /></Field>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '104px 70px 1fr 116px 30px', gap: 10, padding: '0 2px 6px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              <span>Instrument</span><span>Contrats</span><span>Résultat brut ($)</span><span>Mental</span><span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r, i) => {
                const g = Number(r.gross) || 0;
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '104px 70px 1fr 116px 30px', gap: 10, alignItems: 'center' }}>
                    <window.Segmented size="sm" value={r.symbol} onChange={v => setRow(i, 'symbol', v)} options={[{ value: 'MES', label: 'MES' }, { value: 'ES', label: 'ES' }]} />
                    <input type="number" min="1" step="1" style={inS} value={r.contracts} onChange={e => setRow(i, 'contracts', e.target.value)} />
                    <input type="number" step="0.01" style={{ ...inS, fontWeight: 700, color: g > 0 ? 'var(--profit)' : g < 0 ? 'var(--loss)' : 'var(--ink)' }} value={r.gross} onChange={e => setRow(i, 'gross', e.target.value)} placeholder="ex. 62 ou -30" />
                    <window.Segmented size="sm" value={r.mindset} onChange={v => setRow(i, 'mindset', v)} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
                    <button className="tj-iconbtn tj-del" style={{ width: 30, height: 30 }} title="Retirer" onClick={() => removeRow(i)} disabled={rows.length === 1}><window.Icon name="trash" size={14} /></button>
                  </div>
                );
              })}
            </div>
            <button className="tj-addslave" style={{ marginTop: 10 }} onClick={addRow}><window.Icon name="plus" size={15} /> Ajouter un trade</button>
          </div>
          <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Contexte du replay…" /></Field>
        </div>
      ) : (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'end' }}>
        <Field label="Date de la séance"><input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', paddingBottom: 10 }}>Les réglages de comptes ci-dessous s'appliquent à tous les trades de la séance.</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
          {[['coef', 'Par coefficient'], ['manual', 'Par montant (manuel)']].map(([v, lbl]) => (
            <button key={v} onClick={() => setEntryMode(v)} style={{ border: 'none', cursor: 'pointer', borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: entryMode === v ? 'var(--surface)' : 'transparent', color: entryMode === v ? 'var(--ink)' : 'var(--ink-2)', boxShadow: entryMode === v ? '0 1px 3px rgba(20,20,18,.12)' : 'none' }}>{lbl}</button>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 12 }}>
          {entryMode === 'coef' ? 'Vous saisissez le maître ; les autres comptes = maître × coefficient.' : 'Vous saisissez le montant réel de chaque compte ; le coefficient est calculé.'}
        </span>
      </div>

      {entryMode === 'manual' && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '130px 90px 1fr', gap: 12, alignItems: 'end' }}>
          <Field label="Instrument"><window.Segmented size="sm" value={manual.symbol} onChange={v => setManual(m => ({ ...m, symbol: v }))} options={[{ value: 'MES', label: 'MES' }, { value: 'ES', label: 'ES' }]} /></Field>
          <Field label="Contrats (maître)"><input type="number" min="1" step="1" style={inS} value={manual.contracts} onChange={e => setManual(m => ({ ...m, contracts: e.target.value }))} /></Field>
          <Field label="Note mentale"><window.Segmented size="sm" value={manual.mindset} onChange={v => setManual(m => ({ ...m, mindset: v }))} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} /></Field>
        </div>
      )}

      {/* trade rows */}
      {entryMode === 'coef' && (
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Trades de la séance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '104px 70px 1fr 116px 30px', gap: 10, padding: '0 2px 6px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
          <span>Instrument</span><span>Contrats</span><span>Résultat brut ($)</span><span>Mental</span><span></span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => {
            const g = Number(r.gross) || 0;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '104px 70px 1fr 116px 30px', gap: 10, alignItems: 'center' }}>
                <window.Segmented size="sm" value={r.symbol} onChange={v => setRow(i, 'symbol', v)} options={[{ value: 'MES', label: 'MES' }, { value: 'ES', label: 'ES' }]} />
                <input type="number" min="1" step="1" style={inS} value={r.contracts} onChange={e => setRow(i, 'contracts', e.target.value)} />
                <input type="number" step="0.01" style={{ ...inS, fontWeight: 700, color: g > 0 ? 'var(--profit)' : g < 0 ? 'var(--loss)' : 'var(--ink)' }} value={r.gross} onChange={e => setRow(i, 'gross', e.target.value)} placeholder="ex. 62 ou -30" />
                <window.Segmented size="sm" value={r.mindset} onChange={v => setRow(i, 'mindset', v)} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
                <button className="tj-iconbtn tj-del" style={{ width: 30, height: 30 }} title="Retirer" onClick={() => removeRow(i)} disabled={rows.length === 1}><window.Icon name="trash" size={14} /></button>
              </div>
            );
          })}
        </div>
        <button className="tj-addslave" style={{ marginTop: 10 }} onClick={addRow}><window.Icon name="plus" size={15} /> Ajouter un trade</button>
      </div>
      )}

      {/* account selection (common to the session) */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Appliquer aux comptes</h3>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{selected.length} comptes</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ctx.accounts.slice().sort((x, y) => (x.status === 'challenge' ? 1 : 0) - (y.status === 'challenge' ? 1 : 0)).map((a, idx, arr) => {
            const isMaster = a.role === 'master';
            const ap = applied[a.id];
            const on = ap.on;
            const firstChallenge = a.status === 'challenge' && (idx === 0 || arr[idx - 1].status !== 'challenge');
            return (
              <React.Fragment key={a.id}>
              {firstChallenge && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 2px', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}><window.Icon name="target" size={12} /> Comptes en challenge</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 11, border: '1px solid ' + (on ? 'var(--ink)' : 'var(--border)'), background: on ? 'var(--surface)' : 'var(--surface-2)', opacity: on ? 1 : .65 }}>
                <button onClick={() => setApplied(p => ({ ...p, [a.id]: { ...p[a.id], on: !p[a.id].on } }))}
                  style={{ width: 22, height: 22, borderRadius: 7, border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border-strong)'), background: on ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {on && <window.Icon name="check" size={14} stroke={3} />}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <window.AccountDot color={a.color} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</span>
                  {isMaster && <window.Badge tone="ink" style={{ fontSize: 10 }}>Maître</window.Badge>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {entryMode === 'manual' ? (() => {
                    const amt = manual.amounts[a.id];
                    const hasAmt = amt !== '' && amt != null && !isNaN(Number(amt));
                    const isRef = manualMasterAcc && a.id === manualMasterAcc.id;
                    const cf = (hasAmt && !isRef && masterAmount) ? +(Number(amt) / masterAmount).toFixed(2) : (isRef ? 1 : null);
                    return (<>
                      <input type="number" step="0.01" placeholder="$ brut" value={amt == null ? '' : amt} disabled={!on}
                        onChange={e => setManual(m => ({ ...m, amounts: { ...m.amounts, [a.id]: e.target.value } }))}
                        style={{ width: 88, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', textAlign: 'right', background: on ? 'var(--surface)' : 'var(--surface-2)', color: 'var(--ink)' }} />
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 46 }}>{cf != null ? '×' + cf : ''}</span>
                    </>);
                  })() : (<>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>×</span>
                    <input type="number" step="1" min="1" disabled={isMaster} value={isMaster ? 1 : ap.coef}
                      onChange={e => setApplied(p => ({ ...p, [a.id]: { ...p[a.id], coef: e.target.value } }))}
                      style={{ width: 52, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', textAlign: 'center', background: isMaster ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--ink)' }} />
                  </>)}
                </div>
              </div>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, marginTop: 12, padding: '10px 14px', borderRadius: 11, background: 'var(--ink)', color: '#fff' }}>
          <span style={{ fontSize: 13, opacity: .7 }}>{validRows.length} trade{validRows.length > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 13 }}>Séance brute (maître) <strong style={{ color: masterGross >= 0 ? '#7ee0aa' : '#ff9d9b', fontVariantNumeric: 'tabular-nums' }}>{(masterGross >= 0 ? '+' : '−') + window.fmtNum(Math.abs(masterGross), 2) + ' $'}</strong></span>
        </div>
      </div>
      </>
      )}
    </Modal>
  );
}

Object.assign(window, { SessionModal });
