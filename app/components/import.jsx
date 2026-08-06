// import.jsx — CSV trade importer
const { useState: useStateImp, useRef: useRefImp } = React;

function padI(n) { return n < 10 ? '0' + n : '' + n; }

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const delim = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
  const splitLine = line => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === delim && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = splitLine(lines[0]).map(h => h.toLowerCase());
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function findCol(headers, names) {
  for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; }
  return -1;
}
function normDate(s) {
  s = (s || '').trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) { const [y, m, d] = s.split('-'); return y + '-' + padI(+m) + '-' + padI(+d); }
  const m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; return y + '-' + padI(+mo) + '-' + padI(+d); }
  return null;
}
function toNum(s) {
  if (s == null || s === '') return NaN;
  return parseFloat(('' + s).replace(/[\s$€]/g, '').replace('−', '-').replace(',', '.'));
}
// accounting-style money: "$75.00" -> 75, "$(212.50)" -> -212.50
function toMoneyParen(s) {
  if (s == null || s === '') return NaN;
  const neg = /\(.*\)/.test(s);
  const n = toNum(('' + s).replace(/[()]/g, ''));
  return isNaN(n) ? NaN : (neg ? -Math.abs(n) : n);
}
// "MM/DD/YYYY HH:MM:SS" (or just MM/DD/YYYY) -> "YYYY-MM-DD"
function normDateUS(s) {
  s = (s || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let [, mo, d, y] = m; if (y.length === 2) y = '20' + y;
  return y + '-' + padI(+mo) + '-' + padI(+d);
}
function normSymbolFill(s) {
  s = (s || '').toUpperCase().trim();
  if (s.startsWith('MES')) return 'MES';
  if (s.startsWith('ES')) return 'ES';
  return 'MES';
}
// detects the per-fill broker export (symbol, qty, buyPrice, sellPrice, pnl, boughtTimestamp, soldTimestamp, ...)
function isFillsFormat(headers) {
  return findCol(headers, ['qty']) >= 0 && findCol(headers, ['pnl']) >= 0 &&
    (findCol(headers, ['boughttimestamp']) >= 0 || findCol(headers, ['soldtimestamp']) >= 0);
}
// groups raw per-fill rows into one aggregated row per (date, symbol), summing qty and pnl
function groupFills(headers, rows) {
  const idx = {
    symbol: findCol(headers, ['symbol']),
    qty: findCol(headers, ['qty']),
    pnl: findCol(headers, ['pnl']),
    bought: findCol(headers, ['boughttimestamp']),
    sold: findCol(headers, ['soldtimestamp']),
  };
  const groups = new Map();
  rows.forEach((r, i) => {
    const date = normDateUS(r[idx.bought]) || normDateUS(r[idx.sold]);
    const symbol = normSymbolFill(r[idx.symbol]);
    const qty = toNum(r[idx.qty]);
    const pnl = toMoneyParen(r[idx.pnl]);
    const key = (date || '?') + '|' + symbol;
    if (!groups.has(key)) groups.set(key, { date, symbol, contracts: 0, gross: 0, firstLine: i + 2, raw: r, anyPnl: false });
    const g = groups.get(key);
    if (!isNaN(qty)) g.contracts += qty;
    if (!isNaN(pnl)) { g.gross += pnl; g.anyPnl = true; }
  });
  return Array.from(groups.values()).sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(g => {
    const errors = [];
    if (!g.date) errors.push('date');
    if (!g.anyPnl) errors.push('résultat');
    return { line: g.firstLine, raw: g.raw, date: g.date, symbol: g.symbol,
      contracts: Math.max(1, Math.round(g.contracts) || 1), gross: +g.gross.toFixed(2), mindset: 2, notes: '', errors };
  });
}

function ImportModal({ onClose, initialText }) {
  const ctx = React.useContext(window.AppCtx);
  const [text, setText] = useStateImp(initialText || '');
  const [refId, setRefId] = useStateImp(() => {
    const m = ctx.accounts.find(a => a.role === 'master');
    return m ? m.id : (ctx.accounts[0] ? ctx.accounts[0].id : null);
  });
  const refAcc = ctx.accounts.find(a => a.id === refId) || ctx.accounts.find(a => a.role === 'master');
  function defaultApplied(ref) {
    const includeChal = ref && ref.status === 'challenge';
    const out = {};
    ctx.accounts.forEach(a => { out[a.id] = a.id === (ref && ref.id) || a.status !== 'challenge' || includeChal; });
    return out;
  }
  const [applied, setApplied] = useStateImp(() => defaultApplied(refAcc));
  function selectRef(id) {
    setRefId(id);
    setApplied(defaultApplied(ctx.accounts.find(a => a.id === id)));
  }
  function toggleApplied(id) {
    if (refAcc && id === refAcc.id) return;
    setApplied(p => ({ ...p, [id]: !p[id] }));
  }

  const parsed = React.useMemo(() => {
    if (!text.trim()) return null;
    const { headers, rows } = parseCSV(text);
    if (isFillsFormat(headers)) {
      const out = groupFills(headers, rows);
      return { headers, out, missingRes: false, missingDate: false, fillsFormat: true };
    }
    const idx = {
      date: findCol(headers, ['date']),
      instr: findCol(headers, ['instrument', 'symbole', 'actif', 'symbol']),
      contrats: findCol(headers, ['contrats', 'contrat', 'contracts', 'taille', 'lots', 'quantite', 'quantité']),
      res: findCol(headers, ['resultat', 'résultat', 'result', 'pnl', 'performance', 'profit', 'gain', 'montant', 'brut']),
      mental: findCol(headers, ['mental', 'note mentale', 'mindset', 'note']),
      notes: findCol(headers, ['notes', 'commentaire', 'remarque', 'note(s)']),
    };
    const out = rows.map((r, i) => {
      const date = normDate(r[idx.date]);
      const res = toNum(r[idx.res]);
      let symbol = (r[idx.instr] || 'MES').toUpperCase().trim();
      if (symbol !== 'ES') symbol = 'MES';
      let contracts = Math.round(toNum(r[idx.contrats]));
      if (!contracts || contracts < 1) contracts = 1;
      let mindset = Math.round(toNum(r[idx.mental]));
      if (!(mindset >= 1 && mindset <= 3)) mindset = 2;
      const notes = idx.notes >= 0 ? (r[idx.notes] || '') : '';
      const errors = [];
      if (!date) errors.push('date');
      if (isNaN(res)) errors.push('résultat');
      return { line: i + 2, raw: r, date, symbol, contracts, gross: isNaN(res) ? 0 : +res.toFixed(2), mindset, notes, errors };
    });
    return { headers, out, missingRes: idx.res < 0, missingDate: idx.date < 0 };
  }, [text]);

  const valid = parsed ? parsed.out.filter(r => !r.errors.length) : [];
  const invalid = parsed ? parsed.out.filter(r => r.errors.length) : [];

  function legsFor(symbol, contracts, gross) {
    const refCoef = refAcc ? (refAcc.role === 'master' ? 1 : refAcc.coef) : 1;
    return ctx.accounts.filter(a => applied[a.id]).map(a => {
      const isRef = refAcc && a.id === refAcc.id;
      const aCoef = a.role === 'master' ? 1 : a.coef;
      const rel = isRef ? 1 : aCoef / (refCoef || 1);
      const c = isRef ? contracts : Math.max(1, Math.round(contracts * rel));
      const g = isRef ? gross : +(gross * rel).toFixed(2);
      const fees = +(window.accountFee(a, symbol) * c).toFixed(2);
      return { accountId: a.id, coef: rel, contracts: c, gross: g, fees, pnl: +(g - fees).toFixed(2) };
    });
  }

  function doImport() {
    const list = valid.map(r => {
      const accs = legsFor(r.symbol, r.contracts, r.gross);
      return { symbol: r.symbol, contracts: r.contracts, date: r.date,
      gross: r.gross, mindset: r.mindset, notes: r.notes, accounts: accs, refAccountId: window.computeRefAccountId(accs, ctx.accounts), hasChart: false };
    });
    ctx.addTrades(list);
    onClose();
    ctx.nav('journal');
  }


  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,18,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 760, boxShadow: '0 24px 70px -20px rgba(20,20,18,.45)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Importer des trades (CSV)</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink-3)' }}>Déposez un fichier CSV n'importe où sur la page, ou collez son contenu ci-dessous.</p>
          </div>
          <button className="tj-iconbtn" onClick={onClose}><window.Icon name="close" size={18} /></button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Compte de référence pour cet import</label>
            <select value={refId || ''} onChange={e => selectRef(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13.5, background: 'var(--surface-2)', color: 'var(--ink)' }}>
              {ctx.accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.role === 'master' ? ' (Maître)' : ' · ×' + a.coef}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>Les montants du fichier sont appliqués tels quels à ce compte ; les autres comptes cochés sont recalculés selon leur coefficient relatif.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Appliquer aux comptes</h3>
              <button type="button" className="tj-textbtn" style={{ fontSize: 11.5 }}
                onClick={() => setApplied(() => { const o = {}; ctx.accounts.forEach(a => { o[a.id] = refAcc && a.id === refAcc.id; }); return o; })}>
                Ce compte uniquement (pas de mise à l'échelle)
              </button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--ink-3)' }}>Les comptes challenge ne sont pas cochés par défaut, sauf si le compte de référence est lui-même un challenge.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ctx.accounts.slice().sort((x, y) => (x.status === 'challenge' ? 1 : 0) - (y.status === 'challenge' ? 1 : 0)).map((a, idx, arr) => {
                const isMaster = a.role === 'master';
                const isRef = refAcc && a.id === refAcc.id;
                const on = !!applied[a.id];
                const firstChallenge = a.status === 'challenge' && (idx === 0 || arr[idx - 1].status !== 'challenge');
                return (
                  <React.Fragment key={a.id}>
                  {firstChallenge && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 2px', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}><window.Icon name="target" size={12} /> Comptes en challenge</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 11, border: '1px solid ' + (on ? 'var(--ink)' : 'var(--border)'), background: on ? 'var(--surface)' : 'var(--surface-2)', opacity: on ? 1 : .65 }}>
                    <button onClick={() => toggleApplied(a.id)} disabled={isRef}
                      style={{ width: 22, height: 22, borderRadius: 7, border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border-strong)'), background: on ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isRef ? 'default' : 'pointer' }}>
                      {on && <window.Icon name="check" size={14} stroke={3} />}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <window.AccountDot color={a.color} />
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</span>
                      {isMaster && <window.Badge tone="ink" style={{ fontSize: 10 }}>Maître</window.Badge>}
                      {a.status === 'challenge' && <window.Badge tone="warn" style={{ fontSize: 10 }}>Challenge</window.Badge>}
                      {isRef && <window.Badge style={{ fontSize: 10 }}>Réf.</window.Badge>}
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{isMaster || isRef ? '—' : '×' + a.coef}</span>
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
            Colonnes attendues : date · instrument (MES/ES) · contrats · resultat ($) · mental (1-3) · notes
            <br />Ou export par fill (symbol, qty, pnl, boughtTimestamp, soldTimestamp, …) — les fills du même jour sont regroupés automatiquement.
          </div>
          {!text.trim() && (
            <div style={{ padding: '18px 14px', borderRadius: 10, border: '1px dashed var(--border-strong)', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
              Déposez un fichier CSV n'importe où sur la page pour continuer.
            </div>
          )}

          {parsed && (parsed.missingDate || parsed.missingRes) && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 13 }}>
              Colonne manquante : {parsed.missingDate ? 'date ' : ''}{parsed.missingRes ? 'resultat' : ''}. Vérifiez l'entête.
            </div>
          )}
          {parsed && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <strong style={{ color: 'var(--profit)' }}>{valid.length}</strong> trade{valid.length > 1 ? 's' : ''} prêt{valid.length > 1 ? 's' : ''} à importer
              {invalid.length > 0 && <> · <strong style={{ color: 'var(--loss)' }}>{invalid.length}</strong> en erreur (ignoré{invalid.length > 1 ? 's' : ''})</>}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <window.Button variant="ghost" onClick={onClose}>Annuler</window.Button>
          <window.Button variant="primary" icon="check" onClick={doImport} style={{ opacity: valid.length ? 1 : .5, pointerEvents: valid.length ? 'auto' : 'none' }}>
            Importer {valid.length} trade{valid.length > 1 ? 's' : ''}
          </window.Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ImportModal });
