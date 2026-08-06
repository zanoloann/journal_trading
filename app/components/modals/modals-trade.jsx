// modals-trade.jsx — Add/Edit Trade modal
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;
const { Modal, Field, inputStyle, eligible } = window;

// ---------------- Add Trade ----------------
function AddTradeModal({ onClose, tradeId }) {
  const ctx = React.useContext(window.AppCtx);
  const master = ctx.accounts.find(a => a.role === 'master');
  const editing = tradeId != null;
  const existing = editing ? ctx.trades.find(t => t.id === tradeId) : null;
  const [f, setF] = useStateM(existing ? {
    symbol: existing.symbol, date: existing.date, contracts: existing.contracts,
    gross: existing.gross, mindset: existing.mindset, notes: existing.notes || '',
  } : {
    symbol: 'MES', date: '2026-06-11', contracts: 1,
    gross: '', mindset: 2, notes: '',
  });
  const [applied, setApplied] = useStateM(() => {
    const init = {};
    ctx.accounts.forEach(a => {
      const leg = existing && existing.accounts.find(l => l.accountId === a.id);
      init[a.id] = { on: existing ? !!leg : true, coef: leg ? leg.coef : a.coef };
    });
    return init;
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const grossBase = Number(f.gross) || 0;
  const contractsBase = Number(f.contracts) || 0;

  const legs = ctx.accounts.filter(a => applied[a.id].on).map(a => {
    const coef = a.role === 'master' ? 1 : Number(applied[a.id].coef) || 0;
    const contracts = a.role === 'master' ? contractsBase : Math.max(1, Math.round(contractsBase * coef));
    const gross = +(grossBase * coef).toFixed(2);
    const fees = +(window.accountFee(a, f.symbol) * contracts).toFixed(2);
    return { accountId: a.id, coef, contracts, gross, fees, pnl: +(gross - fees).toFixed(2) };
  });
  const totalNet = legs.reduce((s, l) => s + l.pnl, 0);
  const totalFees = legs.reduce((s, l) => s + l.fees, 0);

  function save() {
    const payload = {
      symbol: f.symbol, contracts: contractsBase,
      date: f.date, gross: grossBase, mindset: f.mindset, notes: f.notes, accounts: legs, refAccountId: window.computeRefAccountId(legs, ctx.accounts), hasChart: existing ? existing.hasChart : false,
    };
    if (editing) ctx.updateTrade(tradeId, payload);
    else ctx.addTrade(payload);
    onClose();
  }

  return (
    <Modal onClose={onClose} width={680} title={editing ? 'Modifier le trade' : 'Nouveau trade'} subtitle="SP500 future · les frais (1,04 $/contrat) sont déduits automatiquement"
      footer={<><window.Button variant="ghost" onClick={onClose}>Annuler</window.Button><window.Button variant="primary" icon="check" onClick={save} style={{ opacity: legs.length ? 1 : .5, pointerEvents: legs.length ? 'auto' : 'none' }}>{editing ? 'Enregistrer les modifications' : 'Enregistrer le trade'}</window.Button></>}>
      {ctx.accounts.length === 0 && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <window.Icon name="alert" size={16} /> Aucun compte. Créez d'abord un compte dans l'onglet « Comptes » pour enregistrer un trade.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Instrument" hint={f.symbol === 'ES' ? 'E-mini S&P' : 'Micro E-mini S&P'}>
          <window.Segmented value={f.symbol} onChange={v => set('symbol', v)} options={[{ value: 'MES', label: 'MES' }, { value: 'ES', label: 'ES' }]} />
        </Field>
        <Field label="Date"><input type="date" style={inputStyle} value={f.date} onChange={e => set('date', e.target.value)} /></Field>
        <Field label="Nombre de contrats"><input type="number" min="1" step="1" style={inputStyle} value={f.contracts} onChange={e => set('contracts', e.target.value)} /></Field>
      </div>

      {/* result + mindset */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
        <Field label="Résultat brut sur le maître ($)" hint="Saisir une valeur négative pour une perte">
          <input type="number" step="0.01" style={{ ...inputStyle, fontSize: 16, fontWeight: 700, color: grossBase > 0 ? 'var(--profit)' : grossBase < 0 ? 'var(--loss)' : 'var(--ink)' }} value={f.gross} onChange={e => set('gross', e.target.value)} placeholder="ex. 420 ou -180" />
        </Field>
        <Field label="Note mentale">
          <window.Segmented value={f.mindset} onChange={v => set('mindset', v)} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{window.MINDSET_LABEL[f.mindset]}</div>
        </Field>
      </div>

      {/* account selection */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Appliquer aux comptes</h3>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{legs.length} comptes · frais −{window.fmtNum(totalFees, 2)} $</span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--ink-3)' }}>
          Cochez les comptes sur lesquels appliquer ce trade et ajustez leur coefficient.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ctx.accounts.map((a) => {
            const isMaster = a.role === 'master';
            const ap = applied[a.id];
            const on = ap.on;
            const coef = isMaster ? 1 : Number(ap.coef) || 0;
            const cAcc = isMaster ? contractsBase : Math.max(1, Math.round(contractsBase * coef));
            const net = on ? +(grossBase * coef).toFixed(2) - window.accountFee(a, f.symbol) * cAcc : 0;
            return (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 11, border: '1px solid ' + (on ? 'var(--ink)' : 'var(--border)'), background: on ? 'var(--surface)' : 'var(--surface-2)', opacity: on ? 1 : .65 }}>
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
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>×</span>
                  <input type="number" step="1" min="1" disabled={isMaster} value={isMaster ? 1 : ap.coef}
                    onChange={e => setApplied(p => ({ ...p, [a.id]: { ...p[a.id], coef: e.target.value } }))}
                    style={{ width: 52, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', textAlign: 'center', background: isMaster ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--ink)' }} />
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)', minWidth: 56 }}>{on ? cAcc + ' cont.' : ''}</span>
                </div>
                <window.PnL value={+net.toFixed(2)} style={{ fontWeight: 700, fontSize: 13.5, minWidth: 72, textAlign: 'right' }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, marginTop: 12, padding: '10px 14px', borderRadius: 11, background: 'var(--ink)', color: '#fff' }}>
          <span style={{ fontSize: 13, opacity: .7 }}>Total frais <strong style={{ opacity: 1 }}>−{window.fmtNum(totalFees, 2)} $</strong></span>
          <span style={{ fontSize: 13 }}>Impact net total <strong style={{ color: totalNet >= 0 ? '#7ee0aa' : '#ff9d9b', fontVariantNumeric: 'tabular-nums' }}>{(totalNet >= 0 ? '+' : '−') + window.fmtNum(Math.abs(totalNet), 0) + ' $'}</strong></span>
        </div>
        <div style={{ marginTop: 14 }}><window.ChartPlaceholder height={110} label="déposer une capture du graphique" /></div>
        <div style={{ marginTop: 14 }}>
          <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Contexte, exécution, leçons…" /></Field>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { AddTradeModal });
