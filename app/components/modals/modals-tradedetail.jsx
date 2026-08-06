// modals-tradedetail.jsx — Trade Detail modal
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;
const { Modal, Field, inputStyle, eligible } = window;

// ---------------- Trade Detail ----------------
function TradeDetailModal({ tradeId, onClose }) {
  const ctx = React.useContext(window.AppCtx);
  const t = ctx.trades.find(x => x.id === tradeId);
  if (!t) return null;
  const net = t.accounts.reduce((s, a) => s + a.pnl, 0);
  const gross = t.accounts.reduce((s, a) => s + a.gross, 0);
  const fees = t.accounts.reduce((s, a) => s + a.fees, 0);
  const blurDefault = ctx.t.blurAmounts !== false;
  const [revealAll, setRevealAll] = useStateM(false);
  const [revealed, setRevealed] = useStateM({});
  const [editAcc, setEditAcc] = useStateM(null);
  const [editVal, setEditVal] = useStateM('');
  const shown = (id) => !blurDefault || revealAll || !!revealed[id];
  function startEdit(a) { setEditAcc(a.accountId); setEditVal(String(a.pnl)); }
  function commitEdit() {
    if (editAcc != null && editVal !== '' && !isNaN(Number(editVal))) ctx.updateTradeLeg(t.id, editAcc, Number(editVal));
    setEditAcc(null); setEditVal('');
  }
  return (
    <Modal onClose={onClose} width={640}
      title={(t.symbol === 'ES' ? 'ES · E-mini S&P' : 'MES · Micro E-mini')}
      subtitle={new Date(t.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      footer={<>
        <window.Button variant="ghost" icon="trash" style={{ marginRight: 'auto', color: 'var(--loss)' }}
          onClick={() => ctx.confirm({ title: 'Supprimer ce trade ?', message: 'Le trade ' + t.id + ' (' + t.symbol + ') sera retiré de tous les comptes concernés. Cette action est irréversible.', confirmLabel: 'Supprimer le trade', onConfirm: () => { ctx.deleteTrade(t.id); onClose(); } })}>Supprimer</window.Button>
        <window.Button variant="secondary" onClick={onClose}>Fermer</window.Button>
        <window.Button variant="primary" icon="edit" onClick={() => ctx.editTrade(t.id)}>Modifier</window.Button>
      </>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <window.Badge>{t.symbol}</window.Badge>
        <window.MindsetBadge value={t.mindset} showLabel />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {(() => {
          const mLeg = t.accounts.find(l => { const acc = ctx.accounts.find(x => x.id === l.accountId); return acc && acc.role === 'master'; });
          const mFees = mLeg ? mLeg.fees : +(window.FEE * t.contracts).toFixed(2);
          return [['Contrats (maître)', t.contracts], ['Brut maître', window.fmtMoney(t.gross)], ['Frais maître', '−' + window.fmtNum(mFees, 2) + ' $'], ['Net maître', window.fmtMoney(+(t.gross - mFees).toFixed(2))]];
        })().map(([l, v], i) => (          <div key={i} style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{l}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* gross / fees / net summary across all accounts */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[['Brut total', window.fmtMoney(gross), 'var(--ink)'], ['Frais', '−' + window.fmtNum(fees, 2) + ' $', 'var(--loss)'], ['Net total', null, null]].map(([l, v], i) => (
          <div key={i} style={{ flex: 1, padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{l}</div>
            {i === 2 ? <window.PnL value={net} dec={2} style={{ fontWeight: 700, fontSize: 16 }} /> : <div style={{ fontWeight: 700, fontSize: 16, color: v && i === 1 ? 'var(--loss)' : 'var(--ink)' }}>{v}</div>}
          </div>
        ))}
      </div>

      <window.ChartPlaceholder height={160} />

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Impact par compte</h3>
          {blurDefault && (
            <button className="tj-textbtn" style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => { setRevealAll(v => !v); setRevealed({}); }}>
              <window.Icon name={revealAll ? 'eyeOff' : 'eye'} size={14} />{revealAll ? 'Masquer' : 'Afficher'} les montants
            </button>
          )}
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--ink-3)' }}>Cliquez sur un montant pour l'afficher · double-cliquez pour le modifier (ce compte uniquement).</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {t.accounts.map(a => {
            const acc = ctx.accounts.find(x => x.id === a.accountId);
            if (!acc) return null;
            const visible = shown(a.accountId);
            const isEditing = editAcc === a.accountId;
            return (
              <div key={a.accountId} style={{ display: 'grid', gridTemplateColumns: '1.4fr .7fr .9fr auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <window.AccountDot color={acc.color} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{acc.name}</span>
                  {acc.role === 'master' && <window.Badge tone="ink" style={{ fontSize: 10 }}>Maître</window.Badge>}
                  {a.manual && <span title="Montant ajusté manuellement" style={{ fontSize: 10, fontWeight: 600, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 3 }}><window.Icon name="edit" size={11} />ajusté</span>}
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{a.contracts} cont.</span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>×{a.coef} · −{window.fmtNum(a.fees, 2)} $</span>
                {isEditing ? (
                  <input autoFocus type="number" step="0.01" value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditAcc(null); setEditVal(''); } }}
                    style={{ width: 90, justifySelf: 'end', padding: '6px 8px', border: '1px solid var(--info)', borderRadius: 8, fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', textAlign: 'right', background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--info) 18%, transparent)' }} />
                ) : (
                  <span onClick={() => !visible && setRevealed(p => ({ ...p, [a.accountId]: true }))}
                    onDoubleClick={() => startEdit(a)}
                    title={visible ? 'Double-cliquez pour modifier' : 'Cliquez pour afficher'}
                    style={{ justifySelf: 'end', minWidth: 78, textAlign: 'right', cursor: visible ? 'text' : 'pointer', userSelect: 'none', filter: visible ? 'none' : 'blur(6px)', transition: 'filter .15s' }}>
                    <window.PnL value={a.pnl} dec={2} style={{ fontWeight: 700, fontSize: 14 }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {t.notes && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Notes</h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', background: 'var(--surface-2)', padding: '14px 16px', borderRadius: 11 }}>{t.notes}</p>
        </div>
      )}
    </Modal>
  );
}

Object.assign(window, { TradeDetailModal });
