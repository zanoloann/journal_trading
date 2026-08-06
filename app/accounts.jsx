// accounts.jsx — account management (rows, global chart, set master, delete)
function Accounts() {
  const ctx = React.useContext(window.AppCtx);
  const master = ctx.accounts.find(a => a.role === 'master');
  const funded = ctx.accounts.filter(a => a.role !== 'master' && a.status === 'funded');
  const challenges = ctx.accounts.filter(a => a.role !== 'master' && a.status === 'challenge');

  // Capital / équité excluent les comptes en challenge (seuls les comptes financés comptent)
  const fundedAll = ctx.accounts.filter(a => a.status !== 'challenge');
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
    const inact = window.inactivityInfo(a, ctx.trades);
    const inactive = window.isInactive(a, ctx.trades);
    const st = window.computeStats(ctx.trades, a.id);
    const active = ctx.scope === a.id;
    const dd = window.drawdownInfo(a, ctx.trades);
    const payoutTarget = (a.hasPayout && a.payoutMinBalance) ? Number(a.payoutMinBalance) : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div onClick={() => ctx.setScope(a.id)} className="tj-row"
        style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1.1fr 1fr 1.1fr auto', gap: 14, alignItems: 'center',
          padding: '14px 18px', borderRadius: dd && dd.margin <= 0 ? '14px 14px 0 0' : (dd && dd.color !== 'profit' ? '14px 14px 0 0' : 14), cursor: 'pointer',
          background: active ? 'var(--surface-2)' : 'var(--surface)',
          border: '1px solid ' + (active ? 'var(--ink)' : inactive ? 'var(--warn)' : 'var(--border)'), borderBottom: (dd && dd.color !== 'profit') ? 'none' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <window.Icon name={isMaster ? 'crown' : 'link'} size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap' }}>{a.name}</span>
              {isMaster ? <window.Badge tone="ink" style={{ fontSize: 10 }}>Maître</window.Badge>
                : <window.Badge tone="info" style={{ fontSize: 10 }}>×{a.coef}</window.Badge>}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: inact ? (inact.color === 'profit' ? 'var(--profit)' : inact.color === 'warn' ? 'var(--warn)' : 'var(--loss)') : (inactive ? 'var(--warn)' : 'var(--ink-3)') }}>
          <window.Icon name={inact ? 'calendar' : (inactive ? 'alert' : 'clock')} size={14} />
          {inact ? (
            <span style={{ fontSize: 12.5, fontWeight: 700 }} title={'Inactivité dès le ' + window.fmtDateFR(inact.deadline) + ' — min. ' + inact.minDays + ' j à ' + window.fmtMoney(inact.minNet, { signed: false }) + ' net sur ' + inact.windowDays + ' j'}>{window.fmtDateFR(inact.deadline)} · {inact.remaining > 0 ? inact.remaining + ' j' : 'inactif'}</span>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: inactive ? 700 : 500 }}>{since === 0 ? "Auj." : since + 'j'}</span>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 4 }}>· {st.total} tr.</span>
        </div>
        {actionsFor(a)}
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

function ChallengeRow({ a }) {
    const bal = window.accountBalance(a, ctx.trades);
    const gain = bal - a.size;
    const target = a.target || 3000;
    const prog = Math.max(0, Math.min(1, gain / target));
    const since = window.daysSince(a.lastTrade);
    const inact = window.inactivityInfo(a, ctx.trades);
    const inactive = window.isInactive(a, ctx.trades);
    const chal = window.challengeInfo(a);
    const dd = window.drawdownInfo(a, ctx.trades);
    const daysLeft = chal ? chal.remaining : null;
    const active = ctx.scope === a.id;
    const busted = dd && dd.margin <= 0;
    const missed = !busted && prog < 1 && chal && chal.expired;
    const failed = busted || missed;
    const nearObjective = !failed && prog < 1 && prog >= 0.7;
    return (
      <div onClick={() => ctx.setScope(a.id)} className="tj-row"
        style={{ borderRadius: 14, cursor: 'pointer', padding: '16px 18px',
          background: active ? 'var(--surface-2)' : 'var(--surface)',
          border: '1px solid ' + (active ? 'var(--ink)' : inactive ? 'var(--warn)' : 'var(--border)') }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1.1fr auto', gap: 14, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <window.Icon name="target" size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap' }}>{a.name}</span>
                <window.Badge tone="warn" style={{ fontSize: 10 }}>Challenge ×{a.coef}</window.Badge>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{a.firm} · {window.fmtMoney(a.size, { signed: false })}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Solde actuel</div>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{window.fmtMoney(bal, { signed: false })}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{a.ddType === 'trailing' ? 'DD suiveur' : a.ddType === 'static' ? 'DD statique' : 'Drawdown'}</div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: (a.ddType && a.ddType !== 'none') ? 'var(--loss)' : 'var(--ink-3)' }}>{(a.ddType && a.ddType !== 'none') ? '−' + window.fmtMoney(a.ddAmount || 0, { signed: false }) : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Jours restants</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: chal ? (chal.color === 'profit' ? 'var(--ink)' : chal.color === 'warn' ? 'var(--warn)' : 'var(--loss)') : 'var(--ink-3)' }}>{daysLeft != null ? (daysLeft >= 0 ? daysLeft + ' j' : 'expiré') : 'illimité'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: inact ? (inact.color === 'profit' ? 'var(--profit)' : inact.color === 'warn' ? 'var(--warn)' : 'var(--loss)') : 'var(--ink-3)' }}>
            {inact ? (<>
              <window.Icon name="calendar" size={14} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{window.fmtDateFR(inact.deadline) + ' · ' + (inact.remaining > 0 ? inact.remaining + ' j' : 'inactif')}</span>
            </>) : (
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>—</span>
            )}
          </div>
        {actionsFor(a)}
        </div>
        <MllTargetBar a={a} start={a.size} current={bal} mll={dd ? dd.threshold : (a.size - (Number(a.ddAmount) || 0))} target={a.size + target} />
        {prog >= 1 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 11, background: 'var(--profit-bg)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--profit)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <window.Icon name="check" size={16} /> Objectif atteint — ce challenge est réussi !
            </span>
            <window.Button size="sm" variant="profit" icon="check" onClick={() => ctx.confirm({
              title: 'Valider ce challenge ?',
              message: '« ' + a.name + ' » passera en compte financé. Le solde et les trades existants sont conservés.',
              confirmLabel: 'Valider le challenge', danger: false,
              onConfirm: () => ctx.validateChallenge(a.id),
            })}>Valider Challenge</window.Button>
          </div>
        )}
        {nearObjective && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 11, background: 'var(--info-bg)' }}>
            <window.Icon name="target" size={15} style={{ color: 'var(--info)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--info)' }}>Objectif proche — {window.fmtMoney(target - gain, { signed: false })} restants.</span>
          </div>
        )}

        {failed && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 11, background: 'var(--loss-bg)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <window.Icon name="alert" size={16} /> {busted ? 'Drawdown maximum atteint — challenge échoué.' : 'Délai expiré sans atteindre l’objectif — challenge échoué.'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <window.Button size="sm" variant="secondary" onClick={() => ctx.confirm({
                title: 'Réinitialiser « ' + a.name + ' » ?', message: 'Les trades de ce compte seront effacés et le challenge repartira à zéro à partir d’aujourd’hui.',
                confirmLabel: 'Réinitialiser', onConfirm: () => ctx.resetAccount(a.id),
              })}>Réinitialiser</window.Button>
              <window.Button size="sm" variant="secondary" onClick={() => ctx.confirm({
                title: 'Archiver « ' + a.name + ' » ?', message: 'Le compte sera masqué de la liste et des sélecteurs. Ses données sont conservées et il peut être désarchivé plus tard.',
                confirmLabel: 'Archiver', onConfirm: () => ctx.archiveAccount(a.id, true),
              })}>Archiver</window.Button>
            </div>
          </div>
        )}
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

      {/* challenges at the bottom */}
      {challenges.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Comptes en challenge</h3>
            <window.Badge tone="warn">{challenges.length}</window.Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {challenges.map(a => <ChallengeRow key={a.id} a={a} />)}
          </div>
        </>
      )}

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
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.firm}{a.status === 'challenge' ? ' · Challenge' : ''}</span>
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
