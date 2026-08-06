// journal.jsx — full trade list with filters, multi-select & bulk delete
const { useState: useStateJ } = React;

function Journal() {
  const ctx = React.useContext(window.AppCtx);
  const [q, setQ] = useStateJ('');
  const [result, setResult] = useStateJ('all');
  const [instr, setInstr] = useStateJ('all');
  const [sel, setSel] = useStateJ({}); // {id:true}
  const scope = ctx.scope;
  const pnlScope = scope;

  let list = window.tradesForScope(ctx.viewTrades, scope);
  list = list.filter(t => {
    const p = window.tradePnl(t, pnlScope);
    if (ctx.journalDateFilter && t.date !== ctx.journalDateFilter) return false;
    if (q && !(t.symbol.toLowerCase().includes(q.toLowerCase()) || ('' + t.mindset).includes(q))) return false;
    if (result === 'win' && p < 0) return false;
    if (result === 'loss' && p >= 0) return false;
    if (instr !== 'all' && t.symbol !== instr) return false;
    return true;
  });

  const total = list.reduce((s, t) => s + window.tradePnl(t, pnlScope), 0);
  const totalFees = list.reduce((s, t) => s + window.tradeFees(t, pnlScope), 0);
  const selIds = Object.keys(sel).filter(id => sel[id] && list.some(t => t.id === id));
  const allSelected = list.length > 0 && selIds.length === list.length;

  function toggle(id, e) { e.stopPropagation(); setSel(p => ({ ...p, [id]: !p[id] })); }
  function toggleAll() { if (allSelected) setSel({}); else { const m = {}; list.forEach(t => m[t.id] = true); setSel(m); } }
  function bulkDelete() {
    ctx.confirm({
      title: 'Supprimer ' + selIds.length + ' trade' + (selIds.length > 1 ? 's' : '') + ' ?',
      message: 'Les trades sélectionnés seront retirés de tous les comptes concernés. Cette action est irréversible.',
      confirmLabel: 'Supprimer la sélection',
      onConfirm: () => { ctx.deleteTrades(selIds); setSel({}); },
    });
  }

  const groups = {};
  list.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });

  // when the global "Replay" view is on, fold in each date's replay session alongside the real one —
  // additively (never replacing), including dates that have ONLY a replay session and no real trades.
  const replayGroups = {};
  if (ctx.showReplay) {
    window.tradesForScope(ctx.trades, 'replay').filter(t => !ctx.journalDateFilter || t.date === ctx.journalDateFilter).forEach(t => { (replayGroups[t.date] = replayGroups[t.date] || []).push(t); });
  }
  const dates = Array.from(new Set([...Object.keys(groups), ...Object.keys(replayGroups)])).sort((a, b) => a < b ? 1 : a > b ? -1 : 0);
  const cols = '30px 1.4fr .9fr .9fr 1fr .9fr .9fr 28px';

  // qualifying days (daily net >= threshold) per account with an inactivity rule, filtered by scope
  const qualDays = {};
  ctx.accounts.forEach(a => {
    if (!a.hasInactivity) return;
    if (scope !== 'all' && scope !== 'ref' && a.id !== scope) return;
    const minNet = Number(a.inactMinNet) || 0;
    const d = window.dailyPnl(ctx.trades, a.id);
    Object.values(d).forEach(day => { if (day.pnl >= minNet) (qualDays[day.date] = qualDays[day.date] || []).push(a); });
  });

  function Check({ on, onClick, dim }) {
    return (
      <button onClick={onClick} style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border-strong)'), background: on ? 'var(--ink)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: dim && !on ? .55 : 1 }}>
        {on && <window.Icon name="check" size={13} stroke={3} />}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <window.Card pad={14}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}><window.Icon name="search" size={16} /></span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher MES, ES, note…"
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--ink)', boxSizing: 'border-box' }} />
          </div>
          <window.Segmented size="sm" value={instr} onChange={setInstr} options={[{ value: 'all', label: 'Tous' }, { value: 'MES', label: 'MES' }, { value: 'ES', label: 'ES' }]} />
          <window.Segmented size="sm" value={result} onChange={setResult} options={[{ value: 'all', label: 'Résultat' }, { value: 'win', label: 'Gains' }, { value: 'loss', label: 'Pertes' }]} />
          <window.Button size="sm" variant="secondary" icon="journal" onClick={() => ctx.openImport()} style={{ marginLeft: 'auto' }}>Importer CSV</window.Button>
        </div>
        {ctx.journalDateFilter && (
          <div style={{ marginTop: 10, display: 'flex' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 6px 5px 12px', borderRadius: 999, background: 'var(--ink)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
              <window.Icon name="calendar" size={13} />
              {new Date(ctx.journalDateFilter + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              <button onClick={() => ctx.setJournalDateFilter(null)} style={{ width: 20, height: 20, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <window.Icon name="close" size={12} stroke={2.6} />
              </button>
            </span>
          </div>
        )}
      </window.Card>

      {selIds.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderRadius: 12, background: 'var(--ink)', color: '#fff' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{selIds.length} trade{selIds.length > 1 ? 's' : ''} sélectionné{selIds.length > 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <window.Button size="sm" variant="ghost" style={{ color: '#fff' }} onClick={() => setSel({})}>Désélectionner</window.Button>
            <window.Button size="sm" variant="danger" icon="trash" onClick={bulkDelete}>Supprimer</window.Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{list.length} trade{list.length > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Frais : <strong style={{ color: 'var(--loss)' }}>−{window.fmtNum(totalFees, 2)} $</strong> &nbsp;·&nbsp; Net filtré : <window.PnL value={total} style={{ fontWeight: 700, fontSize: 15 }} /></span>
        </div>
      )}

      <window.Card pad={0}>
        <div className="tj-thead" style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.03em', alignItems: 'center' }}>
          <Check on={allSelected} onClick={toggleAll} dim />
          <span>Instrument</span><span>Contrats</span><span>Frais</span><span>Note mentale</span><span>Comptes</span><span style={{ textAlign: 'right' }}>P&L net</span><span></span>
        </div>
        {dates.map(date => {
          const realRows = groups[date] || [];
          const replayRows = replayGroups[date] || [];
          return (
          <div key={date}>
            <div style={{ padding: '9px 20px', background: qualDays[date] ? 'var(--gold-bg)' : 'var(--surface-2)', boxShadow: qualDays[date] ? 'inset 3px 0 0 var(--gold)' : 'none', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ textTransform: 'capitalize' }}>{new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                {qualDays[date] && <span title={'Journée qualifiante · ' + qualDays[date].map(a => a.name).join(', ')} style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold-ink)', textTransform: 'uppercase', letterSpacing: '.03em', display: 'inline-flex', alignItems: 'center', gap: 3 }}><window.Icon name="target" size={11} />Qualifiante</span>}
              </span>
              {realRows.length > 0 && <window.PnL value={realRows.reduce((s, t) => s + window.tradePnl(t, pnlScope), 0)} style={{ fontWeight: 700 }} />}
            </div>
            {realRows.map(t => {
              const p = window.tradePnl(t, pnlScope);
              const nAcc = t.accounts.length;
              const c = window.tradeContracts(t, pnlScope);
              const f = window.tradeFees(t, pnlScope);
              const on = !!sel[t.id];
              return (
                <div key={t.id} onClick={() => ctx.openTrade(t.id)} className="tj-tradeline" style={{
                  display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '14px 20px',
                  borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer',
                  background: on ? 'var(--surface-2)' : 'transparent',
                }}>
                  <Check on={on} onClick={(e) => toggle(t.id, e)} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 34, borderRadius: 9, background: t.symbol === 'ES' ? 'var(--warn-bg)' : 'var(--surface-2)', color: t.symbol === 'ES' ? 'var(--warn)' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{t.symbol}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.symbol === 'ES' ? 'E-mini S&P' : 'Micro E-mini'}
                        {scope !== 'all' && scope !== 'ref' && (() => {
                          const leg = t.accounts.find(a => a.accountId === scope);
                          if (!leg) return null;
                          const ref = window.refLeg(t);
                          if (!ref || ref.accountId !== scope) return null;
                          return <span title="Compte de référence pour ce trade" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--gold-ink)' }}><window.Icon name="target" size={13} stroke={2.4} /></span>;
                        })()}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Brut {window.fmtMoney(window.tradeGross(t, pnlScope))}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{c} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>cont.</span></span>
                  <span style={{ fontSize: 13, color: 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>−{window.fmtNum(f, 2)} $</span>
                  <window.MindsetBadge value={t.mindset} />
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {t.accounts.slice(0, 4).map((a, i) => {
                      const acc = ctx.accounts.find(x => x.id === a.accountId);
                      return <span key={i} title={acc?.name} style={{ width: 16, height: 16, borderRadius: 999, background: acc?.color || '#999', border: '2px solid var(--surface)', marginLeft: i ? -5 : 0 }} />;
                    })}
                    {nAcc > 4 && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>+{nAcc - 4}</span>}
                  </div>
                  <window.PnL value={p} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14.5 }} />
                  <span style={{ color: 'var(--ink-3)', display: 'flex', justifyContent: 'flex-end' }}><window.Icon name="chevR" size={16} /></span>
                </div>
              );
            })}

            {/* replay session for the same date, shown alongside when the global Replay view is on */}
            {ctx.showReplay && replayRows.length > 0 && (
              <div style={{ background: 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 10px, var(--surface) 10px, var(--surface) 20px)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '7px 20px 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <window.Badge tone="neutral">Replay</window.Badge>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>séance d'entraînement — sans impact réel</span>
                  <window.PnL value={replayRows.reduce((s, t) => s + window.tradePnl(t, window.REPLAY_ACCOUNT_ID), 0)} style={{ fontWeight: 700, marginLeft: 'auto', fontSize: 13 }} />
                </div>
                {replayRows.map(t => {
                  const rp = window.tradePnl(t, window.REPLAY_ACCOUNT_ID);
                  const rc = window.tradeContracts(t, window.REPLAY_ACCOUNT_ID);
                  const rf = window.tradeFees(t, window.REPLAY_ACCOUNT_ID);
                  return (
                    <div key={t.id} onClick={() => ctx.openTrade(t.id)} className="tj-tradeline" style={{
                      display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 20px 10px 50px',
                      alignItems: 'center', cursor: 'pointer', opacity: 0.9,
                    }}>
                      <span></span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 34, borderRadius: 9, background: 'var(--surface)', border: '1px dashed var(--border-strong)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{t.symbol}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.symbol === 'ES' ? 'E-mini S&P' : 'Micro E-mini'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Brut {window.fmtMoney(window.tradeGross(t, window.REPLAY_ACCOUNT_ID))}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{rc} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>cont.</span></span>
                      <span style={{ fontSize: 13, color: 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>−{window.fmtNum(rf, 2)} $</span>
                      <window.MindsetBadge value={t.mindset} />
                      <span></span>
                      <window.PnL value={rp} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }} />
                      <span style={{ color: 'var(--ink-3)', display: 'flex', justifyContent: 'flex-end' }}><window.Icon name="chevR" size={16} /></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );})}
        {list.length === 0 && (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}>
            Aucun trade sur cette période / ces filtres.
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}><window.Button size="sm" variant="secondary" icon="journal" onClick={() => ctx.openImport()}>Importer un CSV</window.Button></div>
          </div>
        )}
      </window.Card>
    </div>
  );
}

Object.assign(window, { Journal });
