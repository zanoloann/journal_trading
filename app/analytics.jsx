// analytics.jsx — statistics & analytics
function StatTile({ label, value, sub, tone }) {
  return (
    <window.Card pad={18}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, marginTop: 6, color: tone || 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>}
    </window.Card>
  );
}

function HBarRow({ label, value, max, count, color }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 100px', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div style={{ height: 22, borderRadius: 6, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: (Math.abs(value) / max * 100) + '%', background: color, borderRadius: 6, opacity: .9 }} />
      </div>
      <span style={{ fontSize: 13, textAlign: 'right' }}><window.PnL value={value} style={{ fontWeight: 700 }} /> <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>({count})</span></span>
    </div>
  );
}

function Analytics() {
  const ctx = React.useContext(window.AppCtx);
  const [bucket, setBucket] = React.useState('funded');
  const [openNeg, setOpenNeg] = React.useState(false);
  const fundedAccts = ctx.accounts.filter(a => a.status !== 'challenge');
  const challengeAccts = ctx.accounts.filter(a => a.status === 'challenge');
  const pool = bucket === 'challenge' ? challengeAccts : fundedAccts;
  const poolIds = pool.map(a => a.id);
  // keep only the reference leg (smallest coefficient, normally 1) of each session
  const sampleTrades = ctx.periodTrades.map(t => {
    if (t.noTrade || !t.accounts) return null;
    const legs = t.accounts.filter(l => poolIds.includes(l.accountId));
    if (!legs.length) return null;
    const mc = Math.min(...legs.map(l => Math.abs(Number(l.coef)) || 1));
    const ref = legs.find(l => (Math.abs(Number(l.coef)) || 1) === mc) || legs[0];
    return { ...t, accounts: [{ ...ref, coef: 1 }] };
  }).filter(Boolean);
  const scope = 'all';
  const list = sampleTrades;
  const s = window.computeStats(sampleTrades, 'all');

  // by instrument
  const byInstr = { MES: { pnl: 0, count: 0, wins: 0 }, ES: { pnl: 0, count: 0, wins: 0 } };
  list.forEach(t => { const p = window.tradePnl(t, scope); byInstr[t.symbol].pnl += p; byInstr[t.symbol].count++; if (p >= 0) byInstr[t.symbol].wins++; });
  const instrMax = Math.max(...Object.values(byInstr).map(v => Math.abs(v.pnl)), 1);

  // by mindset
  const byMind = { 3: { pnl: 0, count: 0, wins: 0 }, 2: { pnl: 0, count: 0, wins: 0 }, 1: { pnl: 0, count: 0, wins: 0 } };
  list.forEach(t => { const p = window.tradePnl(t, scope); byMind[t.mindset].pnl += p; byMind[t.mindset].count++; if (p >= 0) byMind[t.mindset].wins++; });
  const mindMax = Math.max(...Object.values(byMind).map(v => Math.abs(v.pnl)), 1);

  // by day of week
  const dowNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const byDow = {}; [1, 2, 3, 4, 5].forEach(d => byDow[d] = { pnl: 0, count: 0 });
  list.forEach(t => { const d = new Date(t.date + 'T00:00:00').getDay(); if (byDow[d]) { byDow[d].pnl += window.tradePnl(t, scope); byDow[d].count++; } });
  const dowMax = Math.max(...Object.values(byDow).map(v => Math.abs(v.pnl)), 1);

  // net result distribution — bins of 50 $
  const netVals = list.map(t => window.tradePnl(t, scope));
  const lo = Math.floor(Math.min(0, ...netVals) / 50) * 50;
  const hi = Math.ceil(Math.max(0, ...netVals) / 50) * 50;
  const dist = [];
  for (let b = lo; b < hi; b += 50) {
    dist.push({ label: (b < 0 ? '−' + Math.abs(b) : '' + b), neg: b < 0, count: netVals.filter(v => v >= b && v < b + 50).length });
  }
  if (dist.length === 0) dist.push({ label: '0', neg: false, count: 0 });
  const distMax = Math.max(...dist.map(d => d.count), 1);

  // monthly
  const byMonth = {};
  list.forEach(t => { const m = t.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + window.tradePnl(t, scope); });
  const monthData = Object.entries(byMonth).sort().map(([k, v]) => ({ label: new Date(k + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'short' }), value: v }));

  // ---- session-level analysis (1 séance = 1 jour) for finding patterns in losing days ----
  const days = {};
  list.forEach(t => {
    const p = window.tradePnl(t, scope);
    const d = days[t.date] || (days[t.date] = { date: t.date, net: 0, trades: 0, contracts: 0, mindSum: 0, instr: {} });
    d.net += p; d.trades++; d.contracts += window.tradeContracts(t, scope); d.mindSum += t.mindset || 0;
    d.instr[t.symbol] = (d.instr[t.symbol] || 0) + 1;
  });
  const sessions = Object.values(days);
  const negS = sessions.filter(s => s.net < 0);
  const posS = sessions.filter(s => s.net >= 0);
  const avg = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;
  const negByDow = [1, 2, 3, 4, 5].map(d => ({ d, n: negS.filter(s => new Date(s.date + 'T00:00:00').getDay() === d).length, total: sessions.filter(s => new Date(s.date + 'T00:00:00').getDay() === d).length }));
  const negDowMax = Math.max(...negByDow.map(x => x.n), 1);
  const negByMind = [1, 2, 3].map(m => ({ m, n: negS.filter(s => Math.round(s.mindSum / s.trades) === m).length }));
  const negMindMax = Math.max(...negByMind.map(x => x.n), 1);
  const negAfterGreen = negS.filter(s => {
    const sorted = sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const i = sorted.findIndex(x => x.date === s.date);
    return i > 0 && sorted[i - 1].net >= 0;
  }).length;
  const dowFull = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
          {[['funded', 'Comptes financés'], ['challenge', 'Challenges']].map(([v, lbl]) => (
            <button key={v} onClick={() => setBucket(v)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: bucket === v ? 'var(--surface)' : 'transparent', color: bucket === v ? 'var(--ink)' : 'var(--ink-2)', boxShadow: bucket === v ? '0 1px 3px rgba(20,20,18,.12)' : 'none' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {sampleTrades.length ? 'Résultats de référence (coefficient 1 de chaque séance) · ' + sampleTrades.length + ' séances' : 'Aucune séance dans cette catégorie'}
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
        <StatTile label="P&L net" value={<window.PnL value={s.pnl} />} sub={s.total + ' trades'} />
        <StatTile label="Win rate" value={s.winRate.toFixed(1) + ' %'} sub={s.wins + ' jours gagnants · ' + s.losses + ' perdants'} />
        <StatTile label="Meilleur" value={<window.PnL value={s.best} />} tone="var(--profit)" />
        <StatTile label="Pire" value={<window.PnL value={s.worst} />} tone="var(--loss)" />
      </div>

      {/* ---- Séances négatives : recherche de patterns ---- */}
      <window.Card pad={22}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <window.Icon name="alert" size={16} style={{ color: 'var(--loss)' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Séances négatives — recherche de patterns</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>{negS.length} séance{negS.length > 1 ? 's' : ''} négative{negS.length > 1 ? 's' : ''} sur {sessions.length} · analyse par rapport aux séances positives.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Perte moyenne / séance</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3 }}><window.PnL value={avg(negS, s => s.net)} dec={2} /></div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Trades / séance (nég. vs pos.)</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3 }}><span style={{ color: 'var(--loss)' }}>{avg(negS, s => s.trades).toFixed(1)}</span> <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 13 }}>vs {avg(posS, s => s.trades).toFixed(1)}</span></div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Contrats / séance (nég. vs pos.)</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3 }}><span style={{ color: 'var(--loss)' }}>{avg(negS, s => s.contracts).toFixed(1)}</span> <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 13 }}>vs {avg(posS, s => s.contracts).toFixed(1)}</span></div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Note mentale moy. (nég. vs pos.)</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3 }}><span style={{ color: 'var(--loss)' }}>{avg(negS, s => s.mindSum / s.trades).toFixed(2)}</span> <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 13 }}>vs {avg(posS, s => s.mindSum / s.trades).toFixed(2)}</span></div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Après une séance verte</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3 }}>{negAfterGreen}<span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 13 }}>/{negS.length}</span></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10 }}>Séances négatives par jour</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {negByDow.map(x => (
                <div key={x.d} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 54px', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{dowFull[x.d]}</span>
                  <div style={{ height: 18, borderRadius: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: (x.n / negDowMax * 100) + '%', background: 'var(--loss)', opacity: .85, borderRadius: 5 }} />
                  </div>
                  <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--ink-2)' }}>{x.n}<span style={{ color: 'var(--ink-3)' }}>/{x.total}</span></span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10 }}>Séances négatives par note mentale</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {negByMind.map(x => (
                <div key={x.m} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>Note {x.m}/3</span>
                  <div style={{ height: 18, borderRadius: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: (x.n / negMindMax * 100) + '%', background: x.m === 1 ? 'var(--loss)' : x.m === 2 ? 'var(--warn)' : 'var(--ink-3)', opacity: .85, borderRadius: 5 }} />
                  </div>
                  <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--ink-2)' }}>{x.n}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Astuce : ajoutez un contexte (news, setup, état) à vos séances pour affiner la recherche de patterns.</p>
          </div>
        </div>

        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={() => setOpenNeg(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}>
            <window.Icon name={openNeg ? 'chevD' : 'chevR'} size={16} style={{ color: 'var(--ink-3)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Séances prises en compte ({negS.length} — uniquement négatives)</span>
          </button>
          {openNeg && (negS.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10 }}>Aucune séance négative sur cette période.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {negS.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(sx => {
                const tr = list.find(t => t.date === sx.date);
                return (
                <div key={sx.date} onClick={() => tr && ctx.openTrade(tr.id)} className="tj-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto 16px', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', cursor: tr ? 'pointer' : 'default' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize' }}>{new Date(sx.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{sx.trades} trade{sx.trades > 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>note {Math.round(sx.mindSum / sx.trades)}/3</span>
                  <window.PnL value={sx.net} dec={2} style={{ fontWeight: 700, fontSize: 13, textAlign: 'right', minWidth: 80 }} />
                  <window.Icon name="chevR" size={14} style={{ color: 'var(--ink-3)' }} />
                </div>
                );
              })}
            </div>
          ))}
        </div>
      </window.Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <window.Card pad={22}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>Performance par instrument</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['MES', 'ES'].map(k => byInstr[k].count ? (
              <HBarRow key={k} label={(k === 'MES' ? 'MES · Micro' : 'ES · E-mini') + ' · ' + Math.round(byInstr[k].wins / byInstr[k].count * 100) + '%'} value={byInstr[k].pnl} max={instrMax} count={byInstr[k].count} color={byInstr[k].pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            ) : null)}
          </div>
        </window.Card>

        <window.Card pad={22}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>Performance par note mentale</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[3, 2, 1].map(m => byMind[m].count ? (
              <HBarRow key={m} label={'Note ' + m + '/3 · ' + Math.round(byMind[m].wins / byMind[m].count * 100) + '%'} value={byMind[m].pnl} max={mindMax} count={byMind[m].count} color={m === 3 ? 'var(--profit)' : m === 2 ? 'var(--ink-3)' : 'var(--warn)'} />
            ) : null)}
          </div>
        </window.Card>

        <window.Card pad={22}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>Performance par jour</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3, 4, 5].map(d => (
              <HBarRow key={d} label={dowNames[d]} value={byDow[d].pnl} max={dowMax} count={byDow[d].count} color={byDow[d].pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            ))}
          </div>
        </window.Card>

        <window.Card pad={22}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>Distribution du résultat net</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
            {dist.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{b.count}</span>
                <div style={{ width: '100%', height: (b.count / distMax * 100) + '%', minHeight: b.count ? 4 : 0, borderRadius: '6px 6px 0 0', background: b.neg ? 'var(--loss)' : 'var(--profit)', opacity: b.neg ? .8 : .9 }} />
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'center', height: 26 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </window.Card>

        <window.Card pad={22} style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>P&L net mensuel</h3>
          <window.MiniBars data={monthData} height={130} gap={20} />
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10 }}>
            {monthData.map((m, i) => <span key={i} style={{ fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{m.label}</span>)}
          </div>
        </window.Card>
      </div>
    </div>
  );
}

Object.assign(window, { Analytics });
