// payout.jsx — Payout eligibility tab: track qualifying days, safety net, consistency, next cap.
const { useState: useStatePO } = React;

function PayoutCard({ a }) {
  const ctx = React.useContext(window.AppCtx);
  const [open, setOpen] = useStatePO(false);
  const [condOpen, setCondOpen] = useStatePO(false);
  const [amt, setAmt] = useStatePO('');
  const info = window.payoutInfo(a, ctx.trades);
  if (!info) return null;

  const daysOk = info.qualDays >= info.minDays;
  const balOk = info.balance >= info.minBalance;
  const reqs = [
    { label: 'Jours qualifiants', ok: daysOk },
    { label: 'Solde minimum', ok: balOk },
    { label: 'Consistance', ok: info.consistencyOk },
  ];
  const metCount = reqs.filter(r => r.ok).length;
  const status = info.closed ? { label: 'Compte fermé (max payouts atteint)', tone: 'ink' }
    : info.eligible ? { label: 'Éligible au payout', tone: 'profit' }
    : { label: 'Pas encore éligible', tone: 'warn' };

  function recordPayout() {
    const v = Number(amt);
    if (!v || isNaN(v)) return;
    ctx.confirm({
      title: 'Enregistrer ce payout ?',
      message: 'Un payout de ' + window.fmtMoney(v, { signed: false }) + ' sera enregistré pour « ' + a.name + ' » à la date du jour. Le compteur de jours qualifiants et la consistance repartent de zéro.',
      confirmLabel: 'Enregistrer', danger: false,
      onConfirm: () => { ctx.addPayout(a.id, { id: 'po' + Date.now(), date: window.todayIso(), amount: v }); setAmt(''); },
    });
  }

  const Row = ({ label, ok, value, sub }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 0' }}>
      <window.Icon name={ok ? 'check' : 'alert'} size={16} style={{ color: ok ? 'var(--profit)' : 'var(--warn)' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: ok ? 'var(--profit)' : 'var(--warn)', textAlign: 'right', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );

  return (
    <window.Card pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <window.AccountDot color={a.color} size={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.firm} · {window.fmtMoney(a.size, { signed: false })}</div>
        </div>
        <window.Badge tone={status.tone}>{status.label}</window.Badge>
      </div>

      <div style={{ padding: '4px 20px 16px' }}>
        {/* collapsed summary: pass/fail glyphs + met-count, click to expand the detailed conditions */}
        <button onClick={() => setCondOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {reqs.map((r, i) => (
                <span key={i} title={r.label + (r.ok ? ' — rempli' : ' — non rempli')} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999,
                  background: r.ok ? 'var(--profit-bg)' : 'var(--warn-bg)', color: r.ok ? 'var(--profit)' : 'var(--warn)', flexShrink: 0,
                }}>
                  <window.Icon name={r.ok ? 'check' : 'close'} size={12} stroke={2.6} />
                </span>
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: metCount === reqs.length ? 'var(--profit)' : 'var(--ink-2)' }}>
              {metCount} / {reqs.length} conditions remplies
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
            {condOpen ? 'Masquer le détail' : 'Voir le détail'}
            <window.Icon name={condOpen ? 'chevD' : 'chevR'} size={13} />
          </span>
        </button>

        {condOpen && (
          <>
        <Row label={'Jours qualifiants (≥ ' + window.fmtMoney(info.minNet, { signed: false }) + ' net/jour)'}
          ok={daysOk} value={info.qualDays + ' / ' + info.minDays}
          sub={info.since ? 'depuis le ' + window.fmtDateFR(info.since) : 'depuis l\'ouverture du compte'} />
        <div style={{ height: 1, background: 'var(--border)' }} />
        <Row label="Solde vs minimum requis" ok={balOk}
          value={window.fmtMoney(info.balance, { dec: 2, signed: false })}
          sub={'Minimum ' + window.fmtMoney(info.minBalance, { signed: false }) + ' · filet de sécurité ' + window.fmtMoney(info.safetyNet, { signed: false })} />
        <div style={{ height: 1, background: 'var(--border)' }} />
        <Row label={'Consistance (< ' + info.consistencyPct + ' %)'} ok={info.consistencyOk}
          value={info.bestDayShare.toFixed(0) + ' %'}
          sub="Part du meilleur jour dans le profit total depuis le dernier payout" />
        <div style={{ height: 1, background: 'var(--border)' }} />
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 0' }}>
          <window.Icon name="wallet" size={16} style={{ color: 'var(--ink-3)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Prochain plafond de payout</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{info.payoutCount} / {info.maxPayouts} payouts déjà effectués · split {a.payoutSplit || 100} %</div>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'right' }}>{info.nextCap != null ? window.fmtMoney(info.nextCap, { signed: false }) : '—'}</div>
        </div>

        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Retirable au-delà du filet : <window.PnL value={info.withdrawable} dec={2} style={{ fontWeight: 700 }} /></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" step="0.01" placeholder="Montant $" value={amt} onChange={e => setAmt(e.target.value)}
              style={{ width: 110, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', textAlign: 'right', background: 'var(--surface)', color: 'var(--ink)' }} />
            <window.Button size="sm" variant="secondary" icon="check" onClick={recordPayout} style={{ opacity: (amt && !isNaN(Number(amt))) ? 1 : .5, pointerEvents: (amt && !isNaN(Number(amt))) ? 'auto' : 'none' }}>Enregistrer un payout</window.Button>
          </div>
        </div>

        {info.payouts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              <window.Icon name={open ? 'chevD' : 'chevR'} size={14} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Historique des payouts ({info.payouts.length})</span>
            </button>
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {info.payouts.slice().reverse().map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 12px', borderRadius: 9, background: 'var(--surface-2)' }}>
                    <span style={{ fontSize: 12.5 }}>{window.fmtDateFR(p.date)}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{window.fmtMoney(p.amount, { signed: false })}</span>
                    <button className="tj-iconbtn tj-del" style={{ width: 26, height: 26 }} title="Supprimer"
                      onClick={() => ctx.confirm({ title: 'Supprimer ce payout ?', message: 'Ce payout sera retiré de l\'historique.', confirmLabel: 'Supprimer', danger: true, onConfirm: () => ctx.deletePayout(a.id, p.id) })}>
                      <window.Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </window.Card>
  );
}

function Payout() {
  const ctx = React.useContext(window.AppCtx);
  const eligible = ctx.accounts.filter(a => a.hasPayout);
  if (eligible.length === 0) {
    return (
      <window.Card pad={48}>
        <div style={{ textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--ink-3)' }}>
            <window.Icon name="wallet" size={26} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Aucune règle de payout configurée</h3>
          <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Activez la règle de payout sur un type de compte dans <strong>Paramètres</strong>, puis appliquez ce type à un compte pour suivre son éligibilité ici.
          </p>
          <window.Button icon="stats" onClick={() => ctx.openSettings()}>Ouvrir les paramètres</window.Button>
        </div>
      </window.Card>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {eligible.map(a => <PayoutCard key={a.id} a={a} />)}
    </div>
  );
}

Object.assign(window, { Payout });
