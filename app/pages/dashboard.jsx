// dashboard.jsx — dashboard with layout variations + shared panels
const { useMemo: useMemoDash } = React;

// ---- Account health / inactivity panel ----
function AccountHealth({ compact }) {
  const ctx = React.useContext(window.AppCtx);
  const slaves = ctx.accounts;
  return (
    <window.Card pad={compact ? 18 : 22}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Santé des comptes</h3>
        <button className="tj-textbtn" onClick={() => ctx.nav('accounts')}>Gérer →</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ctx.accounts.map(a => {
          const info = window.inactivityInfo(a, ctx.trades);
          const inactive = window.isInactive(a, ctx.trades);
          const bal = window.accountBalance(a, ctx.trades);
          const pnlPct = ((bal - a.size) / a.size) * 100;
          const tone = info ? info.color : null;
          const toneVar = tone === 'profit' ? 'var(--profit)' : tone === 'warn' ? 'var(--warn)' : tone === 'loss' ? 'var(--loss)' : 'var(--ink-3)';
          return (
            <div key={a.id} onClick={() => { ctx.setScope(a.id); ctx.nav('accounts'); }}
              className="tj-row" style={{
                padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)',
                border: '1px solid ' + (inactive ? 'var(--loss)' : (info && info.color === 'warn' ? 'var(--warn)' : 'var(--border)')), cursor: 'pointer',
              }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <window.AccountDot color={a.color} />
                  <span style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                  {a.role === 'master' && <window.Badge tone="ink" style={{ fontSize: 10, padding: '2px 7px' }}>Maître</window.Badge>}
                </div>
                {info ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <window.Icon name="calendar" size={12} />
                    <span style={{ whiteSpace: 'nowrap' }}>Inactivité dès le <strong style={{ color: 'var(--ink-2)' }}>{window.fmtDateFR(info.deadline)}</strong></span>
                    {info.basis === 'opening' && <span style={{ opacity: .7, whiteSpace: 'nowrap' }}>(ouverture)</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                    {a.firm ? a.firm + ' · ' : ''}{window.fmtMoney(a.size, { signed: false })} · ×{a.coef}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <window.PnL value={pnlPct} style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{window.fmtPct(pnlPct)}</window.PnL>
                {info ? (
                  <div style={{ fontSize: 11.5, marginTop: 3, fontWeight: 700, color: toneVar, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                    {info.remaining <= 5 && <window.Icon name="alert" size={12} />}
                    {info.remaining > 0 ? 'reste ' + info.remaining + ' j' : 'inactif'}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}></div>
                )}
              </div>
              </div>
              {(() => {
                const dd = window.drawdownInfo(a, ctx.trades);
                if (!dd) return null;
                const ddVar = dd.color === 'profit' ? 'var(--profit)' : dd.color === 'warn' ? 'var(--warn)' : 'var(--loss)';
                const ratio = dd.amount > 0 ? Math.max(0, Math.min(1, dd.margin / dd.amount)) : 0;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (ratio * 100) + '%', borderRadius: 999, background: ddVar }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--ink-3)' }}>
                      <span>Marge DD <strong style={{ color: ddVar }}>{window.fmtMoney(dd.margin, { dec: 2 })}</strong></span>
                      <span>seuil {window.fmtMoney(dd.threshold, { signed: false })}{dd.capped ? ' · figé' : ''}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </window.Card>
  );
}

// ---- Recent trades panel ----
function RecentTrades({ scope, limit = 6 }) {
  const ctx = React.useContext(window.AppCtx);
  const list = window.tradesForScope(ctx.viewTrades, scope).slice(0, limit);
  return (
    <window.Card pad={22}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Trades récents</h3>
        <button className="tj-textbtn" onClick={() => ctx.nav('journal')}>Tout voir →</button>
      </div>
      <div>
        {list.map(t => {
          const p = window.tradePnl(t, scope);
          return (
            <div key={t.id} onClick={() => ctx.openTrade(t.id)} className="tj-tradeline" style={{
              display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 12, alignItems: 'center',
              padding: '11px 6px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {t.symbol.slice(0, 4)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.symbol}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {new Date(t.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {t.contracts} {t.symbol}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <window.PnL value={p} style={{ fontSize: 14.5, fontWeight: 700 }} />
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>net de frais</div>
              </div>
            </div>
          );
        })}
      </div>
    </window.Card>
  );
}

// ---- Mindset breakdown (note 1-3) ----
function MindsetBreakdown({ scope }) {
  const ctx = React.useContext(window.AppCtx);
  const list = window.tradesForScope(ctx.viewTrades, scope);
  const map = { 3: { count: 0, pnl: 0 }, 2: { count: 0, pnl: 0 }, 1: { count: 0, pnl: 0 } };
  list.forEach(t => { map[t.mindset].count++; map[t.mindset].pnl += window.tradePnl(t, scope); });
  const maxC = Math.max(...Object.values(map).map(v => v.count), 1);
  return (
    <window.Card pad={22}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Note mentale & résultat</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[3, 2, 1].map(m => {
          const r = map[m];
          return (
            <div key={m}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <window.MindsetBadge value={m} showLabel />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{r.count} trades · <window.PnL value={r.pnl} style={{ fontWeight: 700 }} /></span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (r.count / maxC * 100) + '%', borderRadius: 999, background: m === 3 ? 'var(--profit)' : m === 2 ? 'var(--ink-3)' : 'var(--warn)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </window.Card>
  );
}

// ---- KPI computations ----
function useKpis(scope) {
  const ctx = React.useContext(window.AppCtx);
  return useMemoDash(() => {
    const s = window.computeStats(ctx.viewTrades, scope);
    const inactiveCount = ctx.accounts.filter(a => window.isInactive(a, ctx.trades)).length;
    return { s, inactiveCount };
  }, [ctx.viewTrades, ctx.accounts, scope]);
}

// ---- KPI banner (reused on dashboard + calendar) ----
function KpiBanner({ scope, compact, trades }) {
  const ctx = React.useContext(window.AppCtx);
  const source = trades || ctx.viewTrades;
  const s = window.computeStats(source, scope);
  const pnlLabel = trades ? 'P&L du mois' : 'P&L cumulé';
  const colorVar = (c) => c === 'profit' ? 'var(--profit)' : c === 'warn' ? 'var(--warn)' : 'var(--loss)';
  const kpiCards = [
    { label: pnlLabel, icon: 'wallet', value: <window.PnL value={s.pnl} />, sub: <span style={{ color: 'var(--ink-3)' }}>{s.total} trades</span> },
    { label: 'Win rate', icon: 'target', value: s.winRate.toFixed(0) + ' %', sub: <span style={{ color: 'var(--ink-3)' }}>{s.wins}/{s.tradingDays} jours gagnants</span> },
    { label: 'Gain moyen', icon: 'arrowUp', value: <window.PnL value={s.avgWin} dec={2} />, sub: <span style={{ color: 'var(--ink-3)' }}>{s.tradeWins} trade{s.tradeWins > 1 ? 's' : ''} gagnant{s.tradeWins > 1 ? 's' : ''}</span> },
    { label: 'Perte moyenne', icon: 'arrowDown', value: <window.PnL value={-s.avgLoss} dec={2} />, sub: <span style={{ color: 'var(--ink-3)' }}>{s.tradeLosses} trade{s.tradeLosses > 1 ? 's' : ''} perdant{s.tradeLosses > 1 ? 's' : ''}</span> },
  ];
  const attention = ctx.accounts
    .map(a => ({ a, info: window.inactivityInfo(a, ctx.trades) }))
    .filter(x => x.info && x.info.remaining <= 15)
    .sort((p, q) => p.info.remaining - q.info.remaining);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'stretch' }}>
        {kpiCards.map((k, i) => (
          <window.Card key={i} pad={compact ? 16 : 20} hover>
            <window.Kpi {...k} />
          </window.Card>
        ))}
      </div>
      <window.Card pad={compact ? 16 : 20} hover onClick={() => ctx.nav('accounts')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: attention.length ? 'var(--warn)' : 'var(--ink-2)', fontSize: 13, fontWeight: 600 }}>
          <window.Icon name="alert" size={15} stroke={2} />Comptes méritant une attention
        </div>
        {attention.length === 0 ? (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--profit)' }}>
            <window.Icon name="check" size={16} stroke={2.4} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Tous les comptes sont à jour</span>
          </div>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {attention.map(({ a, info }, idx) => (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', width: 14, fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <window.AccountDot color={a.color} />
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: colorVar(info.color), whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {info.remaining <= 0 ? <><window.Icon name="alert" size={12} />inactif</> : 'reste ' + info.remaining + ' j'}
                </span>
              </div>
            ))}
          </div>
        )}
      </window.Card>
    </div>
  );
}

// ---- Replay banner (training account) — shown separately, never mixed into real KPIs ----
function ReplayBanner() {
  const ctx = React.useContext(window.AppCtx);
  if (!ctx.showReplay) return null;
  const st = window.computeStats(ctx.trades, window.REPLAY_ACCOUNT_ID);
  if (!st.total) return null;
  return (
    <div style={{ borderRadius: 16, padding: '16px 20px', background: 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 10px, var(--surface) 10px, var(--surface) 20px)', border: '1px dashed var(--border-strong)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <window.Icon name="journal" size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Replay — entraînement</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Compte fictif, exclu de vos vraies stats</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Trades</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{st.total}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Win rate</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{st.winRate.toFixed(0)} %</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>P&L net</div>
          <window.PnL value={st.pnl} style={{ fontWeight: 700, fontSize: 15 }} />
        </div>
        <button className="tj-textbtn" style={{ justifySelf: 'end' }} onClick={() => ctx.nav('journal')}>Voir le journal →</button>
      </div>
    </div>
  );
}

// ---- Dashboard ----
function Dashboard() {
  const ctx = React.useContext(window.AppCtx);
  const scope = ctx.scope;
  const layout = ctx.t.dashLayout || 'overview';
  const { s, inactiveCount } = useKpis(scope);
  const startBal = scope === 'all' ? ctx.accounts.reduce((a, x) => a + x.size, 0) : scope === 'ref' ? (ctx.accounts.find(a => a.role === 'master')?.size || 0) : (ctx.accounts.find(a => a.id === scope)?.size || 0);
  const eq = window.equityCurve(ctx.trades, scope, startBal, ctx.range.from, ctx.range.to);

  if (ctx.accounts.length === 0) {
    return (
      <window.Card pad={48}>
        <div style={{ textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--ink-3)' }}>
            <window.Icon name="dashboard" size={26} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Bienvenue dans votre journal</h3>
          <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Aucune donnée pour le moment. Créez un compte pour démarrer, importez vos trades en CSV, ou restaurez la démonstration.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <window.Button icon="plus" onClick={() => ctx.openAccount('new')}>Créer un compte</window.Button>
            <window.Button variant="secondary" icon="journal" onClick={() => ctx.openImport()}>Importer un CSV</window.Button>
            <window.Button variant="ghost" onClick={() => ctx.confirm({ title: 'Restaurer la démo ?', message: 'Les données de démonstration seront rechargées.', confirmLabel: 'Restaurer', danger: false, onConfirm: ctx.resetDemo })}>Restaurer la démo</window.Button>
          </div>
        </div>
      </window.Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI row */}
      <KpiBanner scope={scope} compact={layout === 'compact'} />
      <ReplayBanner />

      {layout === 'overview' && (
        <>
          <window.Card pad={22}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Courbe d'équité</h3>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>Solde {window.fmtMoney(eq[eq.length - 1].value, { signed: false })} · {window.PERIOD_LABEL[ctx.period.preset].toLowerCase()}</div>
              </div>
              <window.Badge tone={s.pnl >= 0 ? 'profit' : 'loss'} style={{ fontSize: 13, padding: '5px 11px' }}>{window.fmtPct(s.pnl / (startBal || 1) * 100)}</window.Badge>
            </div>
            <window.EquityChart data={eq} height={250} />
          </window.Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18 }}>
            <AccountHealth />
            <RecentTrades scope={scope} />
          </div>
        </>
      )}

      {layout === 'compact' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <window.Card pad={22}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Courbe d'équité</h3>
              <window.EquityChart data={eq} height={200} />
            </window.Card>
            <RecentTrades scope={scope} limit={5} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <window.Card pad={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Juin 2026</h3>
                <button className="tj-textbtn" onClick={() => ctx.nav('calendar')}>Calendrier →</button>
              </div>
              <window.MiniCalendar scope={scope} />
            </window.Card>
            <MindsetBreakdown scope={scope} />
          </div>
        </div>
      )}

      {layout === 'accounts' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {ctx.accountsView.map(a => {
              const aeq = window.equityCurve(ctx.trades, a.id, a.size);
              const bal = aeq[aeq.length - 1].value;
              const pct = (bal - a.size) / a.size * 100;
              const since = window.daysSince(a.lastTrade);
              const inactive = since >= 7;
              return (
                <window.Card key={a.id} hover pad={18} onClick={() => { ctx.setScope(a.id); ctx.nav('accounts'); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <window.AccountDot color={a.color} size={10} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</span>
                    {a.role === 'master' && <window.Badge tone="ink" style={{ fontSize: 10, padding: '2px 7px', marginLeft: 'auto' }}>Maître</window.Badge>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>{window.fmtMoney(bal, { signed: false })}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 10px' }}>
                    <window.PnL value={pct} style={{ fontSize: 13.5, fontWeight: 700 }}>{window.fmtPct(pct)}</window.PnL>
                    <span style={{ fontSize: 11.5, color: inactive ? 'var(--warn)' : 'var(--ink-3)' }}>{inactive ? '⚠ ' + since + 'j' : since + 'j'}</span>
                  </div>
                  <window.Sparkline points={aeq.map(p => p.value)} width={210} height={34} color={pct >= 0 ? 'var(--profit)' : 'var(--loss)'} fill />
                </window.Card>
              );
            })}
          </div>
          <window.Card pad={22}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Équité agrégée (tous comptes)</h3>
            <window.EquityChart data={window.equityCurve(ctx.trades, 'all', ctx.accounts.reduce((a, x) => a + x.size, 0))} height={220} />
          </window.Card>
        </>
      )}
    </div>
  );
}

Object.assign(window, { Dashboard, KpiBanner, ReplayBanner, AccountHealth, RecentTrades, MindsetBreakdown });
