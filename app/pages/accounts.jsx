// accounts.jsx — account management (rows, global chart, set master, delete)
function Accounts() {
  const ctx = React.useContext(window.AppCtx);
  const master = ctx.accounts.find(a => a.role === 'master');
  const funded = ctx.accounts.filter(a => a.role !== 'master');
  const fundedAll = ctx.accounts;
  const totalCapital = fundedAll.reduce((s, a) => s + a.size, 0);
  const totalBal = fundedAll.reduce((s, a) => s + window.accountBalance(a, ctx.trades), 0);
  const inactiveN = ctx.accounts.filter(a => window.isInactive(a, ctx.trades)).length;
  const globalEq = window.equityCurve(ctx.trades, 'all', totalCapital);

  function actionsFor(a) {
    const isMaster = a.role === 'master';
    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {!isMaster && (
          <button className="tj-iconbtn" title="Définir comme compte maître"
            onClick={(e) => { e.stopPropagation(); ctx.confirm({
              title: 'Définir « ' + a.name +' » comme maître ?',
              message: 'Ce compte deviendra le compte maître (coefficient 1). L\'actuel maître « ' + (master ? master.name : '—') + ' » repassera en compte esclave. Les trades existants ne sont pas modifiés.',
              confirmLabel: 'Définir comme maître', danger: false,
              onConfirm: () => ctx.setMaster(a.id),
            }); }}>
            <window.Icon name="crown" size={16} />
          </button>
        )}
        <button className="tj-iconbtn" title="Modifier" onClick={(e) => { e.stopPropagation(); ctx.openAccount(a.id); }}><window.Icon name="edit" size={15} /></button>
        <button className="tj-iconbtn tj-del" title="Supprimer" onClick={(e) => { e.stopPropagation(); ctx.confirm({
          title: 'Supprimer « ' + a.name + ' » ?',
          message: 'Le compte et toutes ses lignes de trade associées seront supprimés. Cette action est irréversible.',
          confirmLabel: 'Supprimer le compte',
          onConfirm: () => ctx.deleteAccount(a.id),
        }); }}><window.Icon name="trash" size={15} /></button>
      </div>
    );
  }

  function AccountRow({ a }) {
    const isMaster = a.role === 'master';
    const bal = window.accountBalance(a, ctx.trades);
    const pct = (bal - a.size) / a.size * 100;
    const since = window.daysSince(a.lastTrade);
    const st = window.computeStats(ctx.trades, a.id);
    const active = ctx.scope === a.id;
    const health = window.accountHealth(a, ctx.trades);
    const dd = window.drawdownInfo(a, ctx.trades);
    const payoutTarget = (a.hasPayout && a.payoutMinBalance) ? Number(a.payoutMinBalance) : null;
    const overallVar = health.overall === 'loss' ? 'var(--loss)' : health.overall === 'warn' ? 'var(--warn)' : 'var(--profit)';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div onClick={() => ctx.setScope(a.id)} className="tj-row"
        style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1.1fr 1fr auto auto', gap: 14, alignItems: 'center',
          padding: '14px 18px', borderRadius: health.parts.length ? '14px 14px 0 0' : 14, cursor: 'pointer',
          background: active ? 'var(--surface-2)' : 'var(--surface)',
          border: '1px solid ' + (active ? 'var(--ink)' : health.overall !== 'profit' ? overallVar : 'var(--border)'), borderBottom: health.parts.length ? 'none' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <window.Icon name={isMaster ? 'crown' : 'link'} size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap' }}>{a.name}</span>
              {isMaster ? <window.Badge tone="ink" style={{ fontSize: 10 }}>Maître</window.Badge>
                : <window.Badge tone="info" style={{ fontSize: 10 }}>×{a.coef}</window.Badge>}
              {a.isEval && <window.Badge tone="info" style={{ fontSize: 10 }}>Éval</window.Badge>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{a.firm}</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Taille</div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{window.fmtMoney(a.size, { signed: false })}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Solde</div>
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)' }}>{window.fmtMoney(bal, { signed: false })}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Perf.</div>
          <window.PnL value={pct} style={{ fontWeight: 700, fontSize: 14 }}>{window.fmtPct(pct)}</window.PnL>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <window.Badge tone={health.overall === 'loss' ? 'loss' : health.overall === 'warn' ? 'warn' : 'profit'} style={{ fontSize: 10.5 }}>
            {health.overall === 'loss' ? 'Danger' : health.overall === 'warn' ? 'Attention' : 'Sain'}
          </window.Badge>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{st.total} tr. · {since === 0 ? "auj." : since + 'j'}</span>
        </div>
        {actionsFor(a)}
        {health.parts.length > 0 && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {health.parts.map(p => <HealthChip key={p.key} part={p} />)}
          </div>
        )}
        {payoutTarget != null && dd && (
          <div style={{ gridColumn: '1 / -1' }}>
            <MllTargetBar start={a.size} current={bal} mll={dd.threshold} target={payoutTarget} />
          </div>
        )}
      </div>
      <DrawdownAlert a={a} dd={dd} />
      </div>
    );
  }

  // One compact chip per health dimension — the "coup d'œil" the mission asks for: drawdown margin,
  // DLL margin, inactivity status, payout eligibility, eval progress, each colored by severity with
  // the exact number in a tooltip.
  const HEALTH_ICON = { dd: 'stats', dll: 'clock', inact: 'calendar', payout: 'wallet', eval: 'target' };
  function HealthChip({ part }) {
    const colorVar = part.color === 'loss' ? 'var(--loss)' : part.color === 'warn' ? 'var(--warn)' : part.color === 'profit' ? 'var(--profit)' : 'var(--ink-3)';
    const bg = part.color === 'loss' ? 'var(--loss-bg)' : part.color === 'warn' ? 'var(--warn-bg)' : part.color === 'profit' ? 'var(--profit-bg)' : 'var(--surface-2)';
    let text, title;
    const d = part.detail;
    if (part.key === 'dd') {
      // margin can be negative (drawdown breached) — never strip that sign, it's the whole point
      text = 'Marge ' + window.fmtMoney(d.margin, { dec: 2 });
      title = 'Seuil ' + window.fmtMoney(d.threshold, { signed: false }) + (d.capped ? ' (figé)' : '');
    } else if (part.key === 'dll') {
      text = window.fmtMoney(d.margin, { dec: 2 }) + ' / ' + window.fmtMoney(d.amount, { signed: false });
      title = d.breached ? 'Limite de perte journalière dépassée — séance coupée aujourd\'hui.' : 'Perte du jour : ' + window.fmtMoney(d.todayNet, { dec: 2 });
    } else if (part.key === 'inact') {
      text = d.status === 'closed' ? 'Clôturé' : d.status === 'dormant' ? 'Dormant' : d.remaining + ' j';
      title = 'Dernière journée qualifiante : ' + window.fmtDateFR(d.anchor) + ' · clôture le ' + window.fmtDateFR(d.deadline);
    } else if (part.key === 'payout') {
      text = d.eligible ? 'Éligible (~' + window.fmtMoney(d.amountEstimate, { signed: false }) + ')' : d.qualDays + '/' + d.minDays + ' j';
      title = 'Modèle ' + (d.model === 'pctCapped' ? '% plafonné' : 'échelle') + ' · solde ' + window.fmtMoney(d.balance, { signed: false });
    } else if (part.key === 'eval') {
      text = d.pct.toFixed(0) + ' %' + (d.passed ? ' — réussie' : '');
      title = window.fmtMoney(d.profit, { dec: 2 }) + ' / ' + window.fmtMoney(d.target, { signed: false });
    }
    return (
      <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: bg, color: colorVar, fontSize: 11.5, fontWeight: 700 }}>
        <window.Icon name={HEALTH_ICON[part.key] || 'dot'} size={12} stroke={2.4} />
        {part.label} · {text}
      </span>
    );
  }

  function DrawdownAlert({ a, dd }) {
    if (!dd || dd.margin > 0) return null;
    const busted = true;
    return (
      <div style={{ padding: '10px 18px', borderRadius: '0 0 14px 14px', border: '1px solid ' + (busted ? 'var(--loss)' : 'var(--warn)'), borderTop: 'none',
        background: busted ? 'var(--loss-bg)' : 'var(--warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <window.Icon name="alert" size={15} />
          Drawdown maximum atteint — ce compte est soufflé.
        </span>
        {busted && (
          <div style={{ display: 'flex', gap: 8 }}>
            <window.Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); ctx.confirm({
              title: 'Réinitialiser « ' + a.name + ' » ?', message: 'Les trades de ce compte seront effacés et il repartira du solde de départ.',
              confirmLabel: 'Réinitialiser', onConfirm: () => ctx.resetAccount(a.id),
            }); }}>Réinitialiser</window.Button>
            <window.Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); ctx.confirm({
              title: 'Archiver « ' + a.name + ' » ?', message: 'Le compte sera masqué de la liste et des sélecteurs. Ses données sont conservées et il peut être désarchivé plus tard.',
              confirmLabel: 'Archiver', onConfirm: () => ctx.archiveAccount(a.id, true),
            }); }}>Archiver</window.Button>
          </div>
        )}
      </div>
    );
  }

  function MllTargetBar({ start, current, mll, target }) {
  const range = Math.max(1, target - mll);
  const pct = Math.max(0, Math.min(100, (current - mll) / range * 100));
  const startPct = Math.max(0, Math.min(100, (start - mll) / range * 100));
  const inProfit = current >= start;
  const color = inProfit ? 'var(--profit)' : 'var(--loss)';
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ position: 'relative', height: 16 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 5, transform: 'translateY(-50%)', borderRadius: 999, background: 'var(--ink)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: color, transition: 'width .3s' }} />
        </div>
        <div style={{ position: 'absolute', left: startPct + '%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.65)', transform: 'translateX(-1px)' }} />
        <div style={{ position: 'absolute', left: startPct + '%', top: -17, transform: 'translateX(-50%)', fontSize: 9.5, fontWeight: 700, letterSpacing: .6, color: 'var(--ink-3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Start</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--loss)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{window.fmtMoney(mll, { signed: false })}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .6, color: 'var(--ink-3)', textTransform: 'uppercase' }}>MLL</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--profit)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{window.fmtMoney(target, { signed: false })}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .6, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Target</div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {ctx.accounts.length === 0 && (
        <window.Card pad={48}>
          <div style={{ textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--ink-3)' }}>
              <window.Icon name="wallet" size={26} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Aucun compte</h3>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Créez votre premier compte (généralement votre compte maître) pour commencer à enregistrer vos trades — ou restaurez les données de démonstration.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <window.Button icon="plus" onClick={() => ctx.openAccount('new')}>Créer un compte</window.Button>
              <window.Button variant="secondary" onClick={() => ctx.confirm({ title: 'Restaurer la démo ?', message: 'Les données de démonstration (comptes + trades) seront rechargées.', confirmLabel: 'Restaurer', danger: false, onConfirm: ctx.resetDemo })}>Restaurer la démo</window.Button>
            </div>
          </div>
        </window.Card>
      )}

      {ctx.accounts.length > 0 && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <window.Card pad={20}><window.Kpi label="Capital sous gestion" icon="wallet" value={window.fmtMoney(totalCapital, { signed: false })} sub={<span style={{ color: 'var(--ink-3)' }}>{fundedAll.length} compte{fundedAll.length > 1 ? 's' : ''} financé{fundedAll.length > 1 ? 's' : ''}</span>} /></window.Card>
        <window.Card pad={20}><window.Kpi label="Équité totale" icon="stats" value={window.fmtMoney(totalBal, { signed: false })} sub={<window.PnL value={totalBal - totalCapital} />} /></window.Card>
        <window.Card pad={20}><window.Kpi label="Comptes inactifs" icon="alert" accent={inactiveN ? 'var(--warn)' : 'var(--ink)'} value={inactiveN} sub={<span style={{ color: 'var(--ink-3)' }}>seuil 7 jours</span>} /></window.Card>
      </div>

      {/* global aggregated equity */}
      <window.Card pad={22}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>Équité globale</h3>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>Tous les comptes · solde cumulé {window.fmtMoney(totalBal, { signed: false })}</div>
          </div>
          <window.Badge tone={totalBal - totalCapital >= 0 ? 'profit' : 'loss'} style={{ fontSize: 13, padding: '5px 11px' }}>{window.fmtPct((totalBal - totalCapital) / totalCapital * 100)}</window.Badge>
        </div>
        <window.EquityChart data={globalEq} height={230} />
      </window.Card>

      {/* funded accounts as rows */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Comptes financés</h3>
        <span data-tour="add-account"><window.Button size="sm" icon="plus" onClick={() => ctx.openAccount('new')}>Ajouter un compte</window.Button></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {master ? <AccountRow a={master} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderRadius: 14, background: 'var(--warn-bg)', border: '1px solid color-mix(in oklab, var(--warn) 30%, transparent)', fontSize: 13.5, color: 'var(--warn)', fontWeight: 600 }}>
            <window.Icon name="alert" size={16} /> Aucun compte maître — cliquez sur la couronne d'un compte ci-dessous pour le désigner.
          </div>
        )}
        {funded.map(a => <AccountRow key={a.id} a={a} />)}
        {funded.length === 0 && master && <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '4px 2px' }}>Aucun compte financé esclave.</div>}
      </div>

      {/* fictitious replay/training account — always last, never counted in capital/equity/stats above */}
      <ReplayCard />
      <ArchivedSection />
      </>}
    </div>
  );
}

function ReplayCard() {
  const ctx = React.useContext(window.AppCtx);
  const st = window.computeStats(ctx.trades, window.REPLAY_ACCOUNT_ID);
  if (!st.total) return null; // hide until the user has logged at least one replay session
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Compte simulé</h3>
        <window.Badge>Replay</window.Badge>
      </div>
      <div style={{ borderRadius: 14, padding: '16px 18px', background: 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 10px, var(--surface) 10px, var(--surface) 20px)', border: '1px dashed var(--border-strong)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1.1fr', gap: 14, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <window.Icon name="journal" size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Replay — entraînement</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Compte fictif · exclu du capital, des stats et du calendrier réels</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Trades</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{st.total}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Win rate</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{st.winRate.toFixed(0)} %</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>P&L net</div>
            <window.PnL value={st.pnl} style={{ fontWeight: 700, fontSize: 14 }} />
          </div>
          <window.Button size="sm" variant="secondary" onClick={() => ctx.nav('journal')}>Voir dans le journal</window.Button>
        </div>
      </div>
    </>
  );
}

function ArchivedSection() {
  const ctx = React.useContext(window.AppCtx);
  const archived = ctx.allAccounts.filter((a) => a.archived);
  if (!archived.length) return null;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-3)' }}>Comptes archivés</h3>
        <window.Badge>{archived.length}</window.Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {archived.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', opacity: .75 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <window.AccountDot color={a.color} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.firm}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <window.Button size="sm" variant="secondary" onClick={() => ctx.archiveAccount(a.id, false)}>Désarchiver</window.Button>
              <button className="tj-iconbtn tj-del" title="Supprimer" onClick={() => ctx.confirm({
                title: 'Supprimer « ' + a.name + ' » ?',
                message: 'Le compte et toutes ses lignes de trade associées seront supprimés. Cette action est irréversible.',
                confirmLabel: 'Supprimer le compte',
                onConfirm: () => ctx.deleteAccount(a.id),
              })}><window.Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

Object.assign(window, { Accounts });
