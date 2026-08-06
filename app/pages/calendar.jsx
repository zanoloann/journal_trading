// calendar.jsx — performance calendar (P&L heatmap)
const { useState: useStateCal } = React;

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DOW_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// flat colors: one green for positive days, one red for negative
function pnlBg(pnl) {
  if (pnl > 0) return { bg: 'var(--profit)', fg: '#fff' };
  if (pnl < 0) return { bg: 'var(--loss)', fg: '#fff' };
  return { bg: 'var(--surface-2)', fg: 'var(--ink-3)' };
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Calendar page: month state drives BOTH the KPI banner and the grid
function CalendarView({ scope, onPickDay }) {
  const ctx = React.useContext(window.AppCtx);
  const now = window.todayDate();
  const [ym, setYm] = useStateCal({ y: now.getFullYear(), m: now.getMonth() });
  // trades within the displayed month (for the banner)
  const monthTrades = ctx.trades.filter(t => {
    const dt = new Date(t.date + 'T00:00:00');
    return dt.getFullYear() === ym.y && dt.getMonth() === ym.m;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <window.KpiBanner scope={scope} trades={monthTrades} />
      <PerfCalendar scope={scope} onPickDay={onPickDay} ym={ym} setYm={setYm} />
    </div>
  );
}

// Full month calendar with weekly summaries
function PerfCalendar({ scope, onPickDay, ym: ymProp, setYm: setYmProp }) {
  const ctx = React.useContext(window.AppCtx);
  const [ymLocal, setYmLocal] = useStateCal({ y: 2026, m: 5 });
  const ym = ymProp || ymLocal;
  const setYm = setYmProp || setYmLocal;
  const daily = window.dailyPnl(ctx.trades, scope);
  const today = window.todayDate();
  const cells = buildMonthGrid(ym.y, ym.m);
  const monthVals = Object.values(daily).filter(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.getFullYear() === ym.y && dt.getMonth() === ym.m;
  });
  const monthTotal = monthVals.reduce((s, d) => s + d.pnl, 0);
  const monthGreen = monthVals.filter(d => d.pnl > 0).length;
  const monthRed = monthVals.filter(d => d.pnl < 0).length;

  // inactivity deadlines ("journée maximale d'activité") — shown for ALL accounts regardless of scope
  const deadlines = {};
  ctx.accounts.forEach(a => {
    const info = window.inactivityInfo(a, ctx.trades);
    if (info && info.deadline) (deadlines[info.deadline] = deadlines[info.deadline] || []).push(a);
  });

  // challenge end dates (last day to pass the challenge) — red highlight
  const challengeEnds = {};
  ctx.accounts.forEach(a => {
    const ci = window.challengeInfo(a);
    if (ci && ci.deadline) (challengeEnds[ci.deadline] = challengeEnds[ci.deadline] || []).push(a);
  });

  // No-trade days (grey)
  const noTradeById = {};
  ctx.trades.filter(t => t.noTrade).forEach(t => { noTradeById[t.date] = t; });

  // replay sessions per date, shown alongside the real day when the global Replay comparison is on
  const replayById = {};
  if (ctx.showReplay) {
    window.tradesForScope(ctx.trades, 'replay').forEach(t => {
      if (!replayById[t.date]) replayById[t.date] = { pnl: 0, count: 0 };
      replayById[t.date].pnl += window.tradePnl(t, window.REPLAY_ACCOUNT_ID);
      replayById[t.date].count++;
    });
  }

  // qualifying days for the inactivity rule (daily net >= threshold), per account, filtered by scope
  const qualifyingDays = {};
  ctx.accounts.forEach(a => {
    if (!a.hasInactivity || a.status === 'challenge') return;
    if (scope !== 'all' && scope !== 'ref' && a.id !== scope) return;
    const minNet = Number(a.inactMinNet) || 0;
    const d = window.dailyPnl(ctx.trades, a.id);
    Object.values(d).forEach(day => {
      if (day.pnl >= minNet) (qualifyingDays[day.date] = qualifyingDays[day.date] || []).push(a);
    });
  });

  // weekly rows
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function nav(delta) {
    let m = ym.m + delta, y = ym.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setYm({ y, m });
  }

  return (
    <window.Card pad={22}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, textTransform: 'capitalize' }}>
            {MONTHS_FR[ym.m]} {ym.y}
          </h3>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="tj-iconbtn" onClick={() => nav(-1)}><window.Icon name="chevL" size={17} /></button>
            <button className="tj-iconbtn" onClick={() => nav(1)}><window.Icon name="chevR" size={17} /></button>
            {(ym.y !== today.getFullYear() || ym.m !== today.getMonth()) && (
              <button className="tj-iconbtn" style={{ width: 'auto', padding: '0 12px', fontSize: 12.5, fontWeight: 600, marginLeft: 6, gap: 6 }} onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() })}>Aujourd'hui</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink-2)' }}>Total du mois</span>
          <window.PnL value={monthTotal} style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }} />
          <span style={{ display: 'flex', gap: 8 }}>
            <window.Badge tone="profit">{monthGreen} verts</window.Badge>
            <window.Badge tone="loss">{monthRed} rouges</window.Badge>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12 }}>
            <span style={{ width: 13, height: 13, borderRadius: 4, border: '2.5px solid var(--gold)', background: 'var(--gold-bg)', display: 'inline-block' }} />
            Date limite d'inactivité
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12 }}>
            <span style={{ width: 13, height: 13, borderRadius: 4, border: '2.5px solid var(--loss)', background: 'var(--loss-bg)', display: 'inline-block' }} />
            Fin de challenge
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12 }}>
            <span style={{ width: 13, height: 13, borderRadius: 4, boxShadow: 'inset 0 0 0 2.5px var(--gold)', background: 'var(--surface-2)', display: 'inline-block' }} />
            Journée qualifiante
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 1.15fr', gap: 8 }}>
        {DOW_FR.map(d => <div key={d} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', paddingBottom: 2 }}>{d}</div>)}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center' }}>Semaine</div>

        {weeks.map((week, wi) => {
          const wkVals = week.filter(Boolean).map(dt => daily[window.isoDate(dt)]).filter(Boolean);
          const wkTotal = wkVals.reduce((s, d) => s + d.pnl, 0);
          const wkTrades = wkVals.reduce((s, d) => s + d.count, 0);
          return (
            <React.Fragment key={wi}>
              {week.map((dt, di) => {
                if (!dt) return <div key={di} />;
                const iso = window.isoDate(dt);
                const dow = dt.getDay();
                const weekend = dow === 0 || dow === 6;
                const day = daily[iso];
                const dl = deadlines[iso];
                const ce = challengeEnds[iso];
                const nt = noTradeById[iso];
                const rp = replayById[iso];
                const future = dt > today;
                if (weekend) {
                  const mk = dl ? { b: 'var(--gold)', bg: 'var(--gold-bg)', ink: 'var(--gold-ink)', list: dl } : ce ? { b: 'var(--loss)', bg: 'var(--loss-bg)', ink: 'var(--loss)', list: ce } : null;
                  const exceptional = day || nt; // trade(s) exceptionnellement enregistrés un week-end — non bloqué à la saisie, signalé ici
                  function onWeekendClick() {
                    if (nt) {
                      ctx.confirm({ title: 'Retirer le marquage No Trade ?', message: (day ? 'Cette journée a des trades mais est aussi marquée « No Trade ». ' : '') + 'La journée du ' + window.fmtDateFR(iso) + ' ne sera plus marquée « No Trade ».', confirmLabel: 'Retirer le No Trade', danger: true, onConfirm: () => ctx.deleteTrade(nt.id) });
                      return;
                    }
                    if (day) onPickDay && onPickDay(iso);
                  }
                  return (
                    <button key={di} disabled={!exceptional} onClick={onWeekendClick} className="tj-calcell" title={exceptional ? 'Trade enregistré un week-end — cliquer pour modifier ou supprimer' : undefined} style={{
                      aspectRatio: '1', borderRadius: 11, textAlign: 'left', fontFamily: 'inherit',
                      border: exceptional ? '1.5px solid var(--loss)' : (mk ? '2.5px solid ' + mk.b : '1px solid var(--border)'),
                      background: exceptional ? (day ? pnlBg(day.pnl).bg : 'var(--loss-bg)') : (mk ? mk.bg : 'var(--border)'),
                      color: exceptional ? (day ? pnlBg(day.pnl).fg : 'var(--loss)') : 'var(--ink-3)', padding: 7,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: exceptional ? 'pointer' : 'default',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, opacity: exceptional ? 0.85 : 0.55 }}>{dt.getDate()}</span>
                        {exceptional ? <window.Icon name="alert" size={12} style={{ color: 'var(--loss)', flexShrink: 0 }} /> : <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.6 }}>{dow === 6 ? 'Sam' : 'Dim'}</span>}
                      </span>
                      {exceptional && (
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                          {day && <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                            {(day.pnl > 0 ? '+' : day.pnl < 0 ? '−' : '') + window.fmtNum(Math.abs(day.pnl), Number.isInteger(Math.round(day.pnl * 100) / 100) ? 0 : 2)}
                          </span>}
                          {nt && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>No trade ✕</span>}
                        </span>
                      )}
                      {!exceptional && mk && (
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                          {mk.list.map(a => (
                            <span key={a.id} title={a.name + (mk.ink === 'var(--loss)' ? ' — fin du challenge' : '')} style={{ fontSize: 9.5, fontWeight: 700, color: mk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ width: 6, height: 6, borderRadius: 99, background: a.color, flexShrink: 0, display: 'inline-block' }} />{a.name}
                            </span>
                          ))}
                        </span>
                      )}
                      {rp && (
                        <span title={rp.count + ' trade(s) replay'} style={{ fontSize: 9.5, fontWeight: 700, color: rp.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 5, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}>
                          R {(rp.pnl > 0 ? '+' : rp.pnl < 0 ? '−' : '') + window.fmtNum(Math.abs(rp.pnl), 0)}
                        </span>
                      )}
                    </button>
                  );
                }
                const { bg, fg } = day ? pnlBg(day.pnl)
                  : nt ? { bg: 'var(--surface-2)', fg: 'var(--ink-3)' }
                  : { bg: (dl ? 'var(--gold-bg)' : ce ? 'var(--loss-bg)' : 'transparent'), fg: 'var(--ink-2)' };
                const mk = dl ? { b: 'var(--gold)', ink: 'var(--gold-ink)', list: dl, ch: false } : ce ? { b: 'var(--loss)', ink: 'var(--loss)', list: ce, ch: true } : null;
                const qd = day && qualifyingDays[iso];
                function onClick() {
                  if (nt) {
                    ctx.confirm({ title: 'Retirer le marquage No Trade ?', message: (day ? 'Cette journée a des trades mais est aussi marquée « No Trade ». ' : '') + 'La journée du ' + window.fmtDateFR(iso) + ' ne sera plus marquée « No Trade ».', confirmLabel: 'Retirer le No Trade', danger: true, onConfirm: () => ctx.deleteTrade(nt.id) });
                    return;
                  }
                  if (day) onPickDay && onPickDay(iso);
                }
                return (
                  <button key={di} disabled={!day && !nt} onClick={onClick}
                    className="tj-calcell"
                    style={{
                      aspectRatio: '1', borderRadius: 11,
                      border: mk ? '2.5px solid ' + mk.b : '1px solid ' + ((day || nt) ? 'transparent' : 'var(--border)'),
                      boxShadow: qd && !mk ? 'inset 0 0 0 2.5px var(--gold)' : 'none',
                      background: day ? bg : (nt ? 'var(--surface-2)' : (dl ? 'var(--gold-bg)' : ce ? 'var(--loss-bg)' : (future ? 'transparent' : 'var(--surface)'))),
                      color: fg, padding: 7, textAlign: 'left', cursor: (day || nt) ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      opacity: (future && !mk && !nt) ? 0.35 : 1,
                    }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, opacity: day ? 0.85 : 0.7 }}>{dt.getDate()}</span>
                      {day && <span style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{day.count} tr.</span>}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                      {day && <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                        {(day.pnl > 0 ? '+' : day.pnl < 0 ? '−' : '') + window.fmtNum(Math.abs(day.pnl), Number.isInteger(Math.round(day.pnl * 100) / 100) ? 0 : 2)}
                      </span>}
                      {nt && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 3, color: day ? '#fff' : 'var(--ink-3)', background: day ? 'rgba(255,255,255,.24)' : 'transparent', borderRadius: 5, padding: day ? '1px 5px' : 0 }}>No trade ✕</span>}
                      {mk && !day && !nt && mk.list.map(a => (
                        <span key={a.id} title={a.name + (mk.ch ? ' — fin du challenge' : '')} style={{ fontSize: 9.5, fontWeight: 700, color: mk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: a.color, flexShrink: 0, display: 'inline-block' }} />{a.name}
                        </span>
                      ))}
                      {rp && (
                        <span title={rp.count + ' trade(s) replay'} style={{ fontSize: 9.5, fontWeight: 700, color: rp.pnl >= 0 ? 'var(--profit)' : 'var(--loss)', background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 5, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}>
                          R {(rp.pnl > 0 ? '+' : rp.pnl < 0 ? '−' : '') + window.fmtNum(Math.abs(rp.pnl), 0)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <div style={{ borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '7px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <window.PnL value={wkTotal} style={{ fontSize: 14, fontWeight: 700 }} />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{wkTrades} trade{wkTrades > 1 ? 's' : ''}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </window.Card>
  );
}

// Compact mini calendar for the dashboard
function MiniCalendar({ scope }) {
  const ctx = React.useContext(window.AppCtx);
  const daily = window.dailyPnl(ctx.trades, scope);
  const y = 2026, m = 5;
  const cells = buildMonthGrid(y, m);
  const monthVals = Object.values(daily).filter(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.getFullYear() === y && dt.getMonth() === m;
  });
  const noTradeSet = new Set(ctx.trades.filter(t => t.noTrade).map(t => t.date));
  const today = window.todayDate();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {DOW_FR.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center' }}>{d[0]}</div>)}
        {cells.map((dt, i) => {
          if (!dt) return <div key={i} />;
          const dow = dt.getDay();
          const weekend = dow === 0 || dow === 6;
          if (weekend) {
            return <div key={i} style={{ aspectRatio: '1', borderRadius: 6, background: 'var(--border)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, opacity: 0.5 }}>{dt.getDate()}</div>;
          }
          const iso = window.isoDate(dt);
          const day = daily[iso];
          const nt = !day && noTradeSet.has(iso);
          const future = dt > today;
          const { bg, fg } = day ? pnlBg(day.pnl) : { bg: (nt ? 'var(--surface-2)' : 'var(--surface-2)'), fg: 'var(--ink-3)' };
          return (
            <div key={i} title={day ? window.fmtMoney(day.pnl) : (nt ? 'No trade' : '')} style={{
              aspectRatio: '1', borderRadius: 6, background: future && !nt ? 'transparent' : bg, color: fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600,
              border: (day || nt) ? 'none' : '1px solid var(--border)', opacity: (future && !nt) ? 0.3 : 1,
            }}>{dt.getDate()}</div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { PerfCalendar, CalendarView, MiniCalendar });
