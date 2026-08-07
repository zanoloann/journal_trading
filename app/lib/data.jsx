// data.jsx — data model + helpers (SP500 futures: MES daily / ES)
// Accounts: master trades MES + ES; slaves mirror MES.

const FEE = 1.04; // $ per contract (round turn)

// Single fictitious account used for "replay" (training/backtest) sessions. These trades are
// never counted in real P&L, win rate, equity curves, accounts, calendar inactivity, drawdown or
// payout math — they exist purely so replay trades can reuse the normal trade/leg shape for
// display & analysis (Journal · mode « Replay »), fully isolated from real accounts.
const REPLAY_ACCOUNT_ID = 'acc_replay';
const REPLAY_ACCOUNT = { id: REPLAY_ACCOUNT_ID, name: 'Replay (entraînement)', firm: 'Replay', role: 'replay', status: 'replay', color: '#9a958c', size: 0 };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three 50k accounts — master + two slaves (coef 1), all receive the same trades.
const ACCOUNTS = [
  { id: 'acc_master', name: 'Compte 1 — Maître', firm: '', size: 50000,
    role: 'master', coef: 1, status: 'funded', instrument: 'MES+ES', color: '#1b1a17',
    eod: 2000, ddType: 'trailing', ddAmount: 2000, ddStop: 52100, opened: '2026-03-11', lastTrade: '2026-06-09' },
  { id: 'acc_2', name: 'Compte 2', firm: '', size: 50000,
    role: 'slave', coef: 1, status: 'funded', instrument: 'MES+ES', color: '#1f8a5b',
    eod: 2000, ddType: 'trailing', ddAmount: 2000, ddStop: 52100, opened: '2026-03-11', lastTrade: '2026-06-09' },
  { id: 'acc_3', name: 'Compte 3', firm: '', size: 50000,
    role: 'slave', coef: 1, status: 'funded', instrument: 'MES+ES', color: '#2a6fdb',
    eod: 2000, ddType: 'trailing', ddAmount: 2000, ddStop: 52100, opened: '2026-03-11', lastTrade: '2026-06-09' },
];

const INSTRUMENTS = ['MES', 'ES'];
const MINDSET_LABEL = { 1: 'Mental difficile', 2: 'Mental correct', 3: 'Mental discipliné' };

const NOTES_WIN = [
  'Setup propre, attente de la confirmation avant entrée. Sortie au TP comme prévu.',
  'Respect du plan. Bonne gestion du risque, pas de sur-trading après le gain.',
  'Cassure nette du niveau avec volume. Trail du stop sous les plus bas.',
  'Pullback patient sur la zone, exécution propre et sans précipitation.',
];
const NOTES_LOSS = [
  'Entrée trop tôt avant confirmation. Stop touché net — erreur de timing.',
  'FOMO sur une bougie. Pas de setup valide, je le savais.',
  'Marché en range, j’ai forcé une direction. À éviter.',
  'Stop trop serré, sorti puis le prix est reparti. Gestion à revoir.',
];

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

// build per-account legs for a trade (contracts scaled by coef, fees per contract) — no dollar rounding
function buildLegs(accountIds, masterContracts, masterGross) {
  return accountIds.map(id => {
    const acc = ACCOUNTS.find(a => a.id === id);
    const coef = acc.role === 'master' ? 1 : acc.coef;
    const contracts = acc.role === 'master' ? masterContracts : Math.max(1, Math.round(masterContracts * coef));
    const gross = +(masterGross * coef).toFixed(2);
    const fees = +(FEE * contracts).toFixed(2);
    return { accountId: id, coef, contracts, gross, fees, pnl: +(gross - fees).toFixed(2) };
  });
}

// Real master trades imported from CSV: [grossPnl, 'YYYY-MM-DD', contracts]
// Gross reconstructed exactly from the net column + fees (1,04 $/contrat) — no rounding.
// Source file has no instrument / mindset / notes — defaulted to MES / mental 2 / empty.
const RAW_MASTER_TRADES = [
  [62.50, '2026-03-11', 1], [92.50, '2026-03-12', 1], [-22.50, '2026-03-20', 1], [-33.75, '2026-03-25', 1], [0, '2026-03-25', 1],
  [87.50, '2026-04-24', 2], [87.50, '2026-04-24', 2], [43.75, '2026-04-24', 1], [-42.50, '2026-04-24', 2], [-42.50, '2026-04-24', 2], [-21.25, '2026-04-24', 1],
  [16.25, '2026-04-27', 1], [0, '2026-04-27', 3], [0, '2026-04-27', 4], [16.25, '2026-04-27', 1], [16.25, '2026-04-27', 1], [37.50, '2026-04-27', 2], [3.75, '2026-04-27', 3],
  [87.50, '2026-05-05', 1], [28.75, '2026-05-05', 1], [87.50, '2026-05-05', 1], [28.75, '2026-05-05', 1], [87.50, '2026-05-05', 1],
  [42.50, '2026-05-08', 1], [85.00, '2026-05-08', 2], [85.00, '2026-05-08', 2], [-20.00, '2026-05-08', 1], [-40.00, '2026-05-08', 2], [-40.00, '2026-05-08', 2],
  [26.25, '2026-05-11', 1], [26.25, '2026-05-11', 1], [26.25, '2026-05-11', 1], [26.25, '2026-05-11', 1], [26.25, '2026-05-11', 1],
  [16.25, '2026-05-13', 1], [47.50, '2026-05-15', 1], [51.25, '2026-05-18', 1], [-26.25, '2026-05-19', 1], [-41.25, '2026-05-19', 1],
  [30.00, '2026-05-21', 1], [25.00, '2026-05-22', 1], [26.25, '2026-05-27', 1], [37.50, '2026-05-28', 1],
  [-37.50, '2026-06-04', 1], [-27.50, '2026-06-05', 1], [-31.25, '2026-06-09', 1], [22.50, '2026-06-09', 1],
];

// which funded slaves were open on a given date (copy-trading propagation)
function slavesOpenOn(date) {
  return ACCOUNTS.filter(a => a.role === 'slave' && a.status === 'funded'
    && (!a.opened || date >= a.opened)).map(a => a.id);
}

function generateTrades() {
  const trades = RAW_MASTER_TRADES.map((row, i) => {
    const [gross, date, contracts] = row;
    const ids = ['acc_master'].concat(slavesOpenOn(date));
    return {
      id: 'T' + pad(i + 1), symbol: 'MES', contracts,
      date, gross, mindset: 2, notes: '',
      accounts: buildLegs(ids, contracts, gross), hasChart: false,
    };
  });
  return trades.reverse(); // newest first
}

const TRADES = generateTrades();

// ---------------- Helpers ----------------
function fmtMoney(v, opts) {
  opts = opts || {};
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  let dec = opts.dec;
  if (dec == null) dec = Number.isInteger(Math.round(abs * 100) / 100) ? 0 : 2; // show cents only when present, never round away
  const s = abs.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (opts.signed === false ? '' : sign) + s + ' $';
}
function fmtNum(v, dec) { return v.toLocaleString('fr-FR', { minimumFractionDigits: dec ?? 0, maximumFractionDigits: dec ?? 2 }); }
function fmtPct(v, dec) { return (v > 0 ? '+' : '') + v.toFixed(dec ?? 1) + ' %'; }
function fmtDateFR(iso) { if (!iso) return '—'; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

// the "reference" leg of a trade: whichever account had the smallest coefficient that day
// (normally 1×) — this is whichever account was acting as master/reference at the time,
// independent of current structural role.
// Explicit reference/master account id for a NEW trade: whichever account has the structural
// "master" role right now, but ONLY if that account's leg is actually part of this trade — a
// solo trade on one account with coef 1 does NOT make that account the reference unless it is
// truly configured as master. Returns null when the master account isn't part of the trade.
function computeRefAccountId(legs, accounts) {
  const masterAcc = (accounts || []).find(a => a.role === 'master');
  if (!masterAcc) return null;
  return (legs || []).some(l => l.accountId === masterAcc.id) ? masterAcc.id : null;
}

// the "reference" leg of a trade. New trades carry an explicit refAccountId set at entry time
// (the structural master account, only if it was actually applied to that trade — never inferred
// from coefficients). Legacy trades (imported/created before this field existed) fall back to the
// old heuristic: smallest coefficient among the trade's legs.
function refLeg(trade) {
  if (!trade.accounts || !trade.accounts.length) return null;
  if (trade.refAccountId !== undefined) {
    if (trade.refAccountId === null) return null;
    return trade.accounts.find(l => l.accountId === trade.refAccountId) || null;
  }
  const mc = Math.min(...trade.accounts.map(l => Math.abs(Number(l.coef)) || 1));
  return trade.accounts.find(l => (Math.abs(Number(l.coef)) || 1) === mc) || trade.accounts[0];
}

function tradeAgg(trade, scope, field) {
  if (scope === 'all' || scope == null) return trade.accounts.reduce((s, a) => s + a[field], 0);
  if (scope === 'ref') { const a = refLeg(trade); return a ? a[field] : 0; }
  const a = trade.accounts.find(x => x.accountId === scope);
  return a ? a[field] : 0;
}
function tradePnl(trade, scope) { return tradeAgg(trade, scope, 'pnl'); }      // net
function tradeGross(trade, scope) { return tradeAgg(trade, scope, 'gross'); }
function tradeFees(trade, scope) { return tradeAgg(trade, scope, 'fees'); }
function tradeContracts(trade, scope) { return tradeAgg(trade, scope, 'contracts'); }

function tradesForScope(trades, scope) {
  if (scope === REPLAY_ACCOUNT_ID || scope === 'replay') return trades.filter(t => t.replay);
  const real = trades.filter(t => !t.noTrade && !t.replay);
  if (scope === 'all' || scope == null) return real;
  if (scope === 'ref') return real.filter(t => !!refLeg(t));
  return real.filter(t => t.accounts.some(a => a.accountId === scope));
}

function computeStats(trades, scope) {
  const list = tradesForScope(trades, scope);
  let tradeWins = 0, tradeLosses = 0, grossWin = 0, grossLoss = 0, pnl = 0, fees = 0, best = -Infinity, worst = Infinity;
  list.forEach(t => {
    const p = tradePnl(t, scope);
    pnl += p; fees += tradeFees(t, scope);
    if (p >= 0) { tradeWins++; grossWin += p; } else { tradeLosses++; grossLoss += Math.abs(p); }
    if (p > best) best = p;
    if (p < worst) worst = p;
  });
  const total = list.length;
  // win rate is computed per DAY (séance): a day counts as a win if its net >= 0
  const daily = dailyPnl(trades, scope);
  const days = Object.values(daily);
  const winDays = days.filter(d => d.pnl >= 0).length;
  const lossDays = days.filter(d => d.pnl < 0).length;
  const tradingDays = days.length;
  return {
    total, tradeWins, tradeLosses, pnl, fees,
    wins: winDays, losses: lossDays, tradingDays,
    winRate: tradingDays ? (winDays / tradingDays) * 100 : 0,
    avgWin: tradeWins ? grossWin / tradeWins : 0,
    avgLoss: tradeLosses ? grossLoss / tradeLosses : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    best: best === -Infinity ? 0 : best,
    worst: worst === Infinity ? 0 : worst,
    expectancy: total ? pnl / total : 0,
  };
}

function dailyPnl(trades, scope) {
  const list = tradesForScope(trades, scope);
  const map = {};
  list.forEach(t => {
    const p = tradePnl(t, scope);
    if (!map[t.date]) map[t.date] = { date: t.date, pnl: 0, count: 0 };
    map[t.date].pnl += p; map[t.date].count++;
  });
  return map;
}

function equityCurve(trades, scope, startBalance, from, to) {
  const all = tradesForScope(trades, scope).slice().reverse(); // oldest first
  let cum = startBalance || 0;
  // aggregate net per day so the x-axis is days, not individual trades
  const byDay = {};
  const order = [];
  all.forEach(t => {
    if (from && t.date < from) { cum += tradePnl(t, scope); return; } // baseline before window
    if (to && t.date > to) return;
    if (!(t.date in byDay)) { byDay[t.date] = 0; order.push(t.date); }
    byDay[t.date] += tradePnl(t, scope);
  });
  const pts = [];
  if (order.length) pts.push({ date: order[0], value: cum, pnl: 0 }); // opening baseline point
  order.forEach(d => { cum += byDay[d]; pts.push({ date: d, value: cum, pnl: byDay[d] }); });
  if (pts.length === 0) pts.push({ date: from || '2026-04-01', value: cum, pnl: 0 });
  return pts;
}

// ---- date period filtering ----
function tradesInRange(trades, from, to) {
  return trades.filter(t => (!from || t.date >= from) && (!to || t.date <= to));
}
function periodRange(preset) {
  const today = todayDate();
  const to = isoDate(today);
  if (preset === 'day') return { from: to, to };
  if (preset === 'week') { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: isoDate(d), to }; }
  if (preset === 'month') return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  if (preset === 'prevMonth') { const first = new Date(today.getFullYear(), today.getMonth() - 1, 1); const last = new Date(today.getFullYear(), today.getMonth(), 0); return { from: isoDate(first), to: isoDate(last) }; }
  if (preset === 'quarter') { const q = Math.floor(today.getMonth() / 3); return { from: isoDate(new Date(today.getFullYear(), q * 3, 1)), to }; }
  if (preset === 'year') return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to };
  return { from: null, to: null };
}
const PERIOD_LABEL = { all: 'Tout', day: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', prevMonth: 'Mois précédent', quarter: 'Ce trimestre', year: 'Cette année', custom: 'Personnalisé' };

function daysSince(iso) {
  const d = new Date(iso + 'T00:00:00');
  return Math.floor((todayDate() - d) / 86400000);
}

// ---- real "today" (live wall clock, date-only) ----
function todayDate() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function todayIso() { return isoDate(todayDate()); }
function addDaysIso(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
function daysBetweenIso(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }

// Inactivity rule per account — escalating two-stage model matching real prop-firm behavior:
// anchor = most recent calendar day whose NET >= minNet (a "qualifying day"), or the account's
//          opening date if no qualifying day has happened yet.
// dormantDeadline (optional) = anchor + inactDormantDays -> account flagged "dormant" (still
//          alive, but firm may start warning/limiting it) once passed.
// deadline ("closeDeadline") = anchor + inactCloseDays -> permanent closure once passed.
// remaining = deadline - today. status: 'active' | 'dormant' | 'closed'.
// minQualDays/windowDays are carried through for display only (the informational "N days
// qualifying per rolling window" rule) — the actual danger clock is days-since-last-qualifying-day,
// which is what the two deadlines above track and is the number that matters operationally.
function inactivityInfo(account, trades) {
  if (!account || !account.hasInactivity) return null;
  const minNet = Number(account.inactMinNet) || 0;
  const minQualDays = Math.max(1, Math.round(Number(account.inactMinQualDays) || 1));
  const windowDays = Math.max(1, Math.round(Number(account.inactWindow) || 1));
  const closeDays = Math.max(1, Math.round(Number(account.inactCloseDays) || 30));
  const dormantDays = account.inactDormantDays != null ? Math.max(1, Math.round(Number(account.inactDormantDays))) : null;
  const daily = dailyPnl(trades, account.id);
  const qual = Object.values(daily).filter(d => d.pnl >= minNet).map(d => d.date).sort(); // ascending
  const anchor = qual.length ? qual[qual.length - 1] : (account.opened || account.startDate || todayIso());
  const basis = qual.length ? 'trades' : 'opening';
  const deadline = addDaysIso(anchor, closeDays);
  const remaining = daysBetweenIso(todayIso(), deadline);
  const dormantDeadline = dormantDays != null ? addDaysIso(anchor, dormantDays) : null;
  const dormantRemaining = dormantDeadline != null ? daysBetweenIso(todayIso(), dormantDeadline) : null;
  let status = 'active';
  if (remaining <= 0) status = 'closed';
  else if (dormantRemaining != null && dormantRemaining <= 0) status = 'dormant';
  const soon = remaining <= 5 || (dormantRemaining != null && dormantRemaining > 0 && dormantRemaining <= 5);
  const color = status !== 'active' ? 'loss' : soon ? 'warn' : 'profit';
  return {
    anchor, basis, deadline, remaining, dormantDeadline, dormantRemaining, status, color,
    ok: status === 'active', minQualDays, minNet, windowDays, closeDays, dormantDays, qualifyingCount: qual.length,
  };
}

function isInactive(account, trades) {
  const info = inactivityInfo(account, trades);
  if (info) return info.status !== 'active';
  return daysSince(account.lastTrade) >= 7;
}

// Daily Loss Limit (e.g. Apex 50K EOD: 1 000 $) — cuts the CURRENT session when breached, resets
// automatically the next calendar day. Independent from the trailing drawdown (cumulative/permanent).
function dllInfo(account, trades) {
  if (!account || !account.hasDll) return null;
  const amount = Number(account.dllAmount) || 0;
  if (amount <= 0) return null;
  const daily = dailyPnl(trades, account.id);
  const today = daily[todayIso()];
  const todayNet = today ? today.pnl : 0;
  const margin = +(amount + Math.min(0, todayNet)).toFixed(2); // shrinks toward 0 only on a losing day
  const breached = todayNet <= -amount;
  const ratio = amount > 0 ? margin / amount : 1;
  const color = breached ? 'loss' : ratio <= 0.3 ? 'warn' : 'profit';
  return { amount, todayNet, margin, breached, color };
}

function accountTradePnl(account, trades) {
  return tradesForScope(trades, account.id).reduce((s, t) => s + tradePnl(t, account.id), 0);
}
function accountBalance(account, trades) {
  const pnl = accountTradePnl(account, trades);
  const adjs = account.adjustments || [];
  if (!adjs.length) return account.size + pnl;
  const latest = adjs[adjs.length - 1];
  // absolute-anchor model: the latest réévaluation fixes the balance to `target`
  // as of its creation; later trade P&L adds on top (target + pnl since the reval).
  if (latest.target != null && latest.pnlAt != null) {
    return +(Number(latest.target) + (pnl - Number(latest.pnlAt))).toFixed(2);
  }
  // legacy delta model (older adjustments)
  const adj = adjs.reduce((s, a) => s + (Number(a.delta) || 0), 0);
  return account.size + pnl + adj;
}

// peak end-of-day equity reached on the account (start balance included)
function peakEquity(account, trades) {
  const pts = equityCurve(trades, account.id, account.size);
  let peak = account.size;
  pts.forEach(p => { if (p.value > peak) peak = p.value; });
  const bal = accountBalance(account, trades);
  if (bal > peak) peak = bal;
  return peak;
}

// Account-level drawdown (max loss limit).
// ddType: 'trailing' (suiveur) | 'static' (fixe) | 'none'
// ddAmount: distance of the liquidation threshold below the peak (trailing) or below start (static)
// ddStop:   value at which the trailing threshold stops rising (freezes), e.g. 52100
// Current threshold (trailing) = min(peak - ddAmount, ddStop)
// Margin = current balance - threshold
function drawdownInfo(account, trades) {
  if (!account) return null;
  const type = account.ddType || 'none';
  const amount = Number(account.ddAmount) || 0;
  if (type === 'none' || amount <= 0) return null;
  const balance = accountBalance(account, trades);
  let threshold, peak = null, capped = false;
  if (type === 'static') {
    threshold = account.size - amount;
  } else {
    peak = peakEquity(account, trades);
    const hasCap = account.ddStop != null && account.ddStop !== '';
    const cap = hasCap ? Number(account.ddStop) : Infinity;
    const trail = peak - amount;
    threshold = Math.min(trail, cap);
    capped = hasCap && trail >= cap;
  }
  const margin = +(balance - threshold).toFixed(2);
  const ratio = amount > 0 ? margin / amount : 99;
  const color = margin <= 0 ? 'loss' : ratio <= 0.5 ? 'loss' : ratio <= 1 ? 'warn' : 'profit';
  return { type, amount, peak, threshold: +threshold.toFixed(2), balance, margin, color, capped };
}

// ---------------- Payout eligibility ----------------
// Two models, selected per account type via `payoutModel`:
//  - 'scale' (Apex-style): progressive cap per payout from `payoutScale`, a consistency rule
//    (no single qualifying day's profit >= consistencyPct% of total profit since the last
//    payout), a minimum balance to maintain, and — for Legacy — an extra "total trading days"
//    floor (payoutMinTradingDays) plus a scale that EXPIRES (payoutCapExpires: once exhausted,
//    the cap disappears entirely instead of repeating the last tier) and a safety-net requirement
//    that only applies to the first N payouts (safetyNetMaxPayouts).
//  - 'pctCapped' (Lucid Flex-style): a flat cut (payoutPct%) of profit since the last payout,
//    capped at a fixed ceiling (payoutCap) that does NOT progress with payout count, plus a gate
//    requiring the account to be net profitable over its whole funded life (requireOverallProfit).
// Both models share: qualifying days (net >= payoutMinNet) since the last recorded payout (or
// account opening if none yet), and a maxPayouts closure count.
function payoutInfo(account, trades) {
  if (!account || !account.hasPayout) return null;
  const payouts = (account.payouts || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const since = payouts.length ? payouts[payouts.length - 1].date : (account.opened || null);
  const daily = dailyPnl(trades, account.id);
  const daysInWindow = Object.values(daily).filter(d => !since || d.date > since);
  const minNet = Number(account.payoutMinNet) || 0;
  const qualDays = daysInWindow.filter(d => d.pnl >= minNet);
  const totalProfit = daysInWindow.reduce((s, d) => s + Math.max(0, d.pnl), 0);
  const bestDay = daysInWindow.reduce((m, d) => Math.max(m, d.pnl), 0);
  const consistencyPct = Number(account.consistencyPct) || 0;
  const consistencyOk = consistencyPct > 0 ? (totalProfit > 0 ? (bestDay / totalProfit) * 100 < consistencyPct : true) : true;
  const bestDayShare = totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;
  const balance = accountBalance(account, trades);
  const minBalance = Number(account.payoutMinBalance) || 0;
  const safetyNet = Number(account.safetyNet) || 0;
  const scale = Array.isArray(account.payoutScale) ? account.payoutScale : [];
  const model = account.payoutModel || (scale.length ? 'scale' : 'pctCapped');
  const maxPayouts = Number(account.maxPayouts) || (model === 'scale' ? scale.length : 0) || Infinity;
  const closed = payouts.length >= maxPayouts;
  const daysOk = qualDays.length >= (Number(account.payoutMinDays) || 0);
  const minTradingDays = Number(account.payoutMinTradingDays) || 0;
  const tradingDaysOk = minTradingDays ? daysInWindow.length >= minTradingDays : true;
  const balanceOk = payouts.length < (Number(account.safetyNetMaxPayouts) || Infinity) ? balance >= minBalance : true;

  // Payout $ amount is based on NET profit since the window start (all days, losses included) —
  // deliberately distinct from `totalProfit` above (sum of winning days only), which exists purely
  // to compute the consistency ratio. Reusing totalProfit here would overstate the payout by
  // ignoring losing days entirely.
  const netProfit = daysInWindow.reduce((s, d) => s + d.pnl, 0);
  let nextCap, amountEstimate, overallProfitOk = true;
  if (model === 'pctCapped') {
    const pct = Number(account.payoutPct) || 50;
    const cap = account.payoutCap != null ? Number(account.payoutCap) : Infinity;
    nextCap = cap;
    amountEstimate = Math.min(netProfit * pct / 100, cap);
    if (account.requireOverallProfit) overallProfitOk = balance > account.size;
  } else {
    nextCap = payouts.length < scale.length ? scale[payouts.length]
      : (scale.length ? (account.payoutCapExpires ? null : scale[scale.length - 1]) : null);
    amountEstimate = nextCap != null ? Math.min(netProfit, nextCap) : netProfit;
  }

  const eligible = !closed && daysOk && tradingDaysOk && balanceOk && consistencyOk && overallProfitOk;
  const withdrawable = Math.max(0, +(balance - safetyNet).toFixed(2));
  return {
    payouts, since, qualDays: qualDays.length, minDays: Number(account.payoutMinDays) || 0,
    tradingDays: daysInWindow.length, minTradingDays, tradingDaysOk,
    minNet, balance, minBalance, safetyNet, withdrawable, consistencyOk, bestDayShare, consistencyPct,
    nextCap, amountEstimate: +Math.max(0, amountEstimate).toFixed(2), payoutCount: payouts.length, maxPayouts,
    closed, eligible, overallProfitOk, model, payoutSplit: Number(account.payoutSplit) || 100,
    payoutSplitNote: account.payoutSplitNote || null, payoutMin: Number(account.payoutMin) || 0,
  };
}

// ---------------- Evaluation-phase progress (Lucid Flex eval, etc.) ----------------
// Not a payout — a pass/fail gate: profit >= target AND the same consistency rule as payouts
// (no single day's profit >= evalConsistencyPct% of total profit since the account opened).
function evalProgress(account, trades) {
  if (!account || !account.isEval) return null;
  const balance = accountBalance(account, trades);
  const profit = +(balance - account.size).toFixed(2);
  const target = Number(account.profitTarget) || 0;
  const pct = target > 0 ? Math.max(0, Math.min(100, (profit / target) * 100)) : 0;
  const daily = dailyPnl(trades, account.id);
  const days = Object.values(daily);
  const totalProfit = days.reduce((s, d) => s + Math.max(0, d.pnl), 0);
  const bestDay = days.reduce((m, d) => Math.max(m, d.pnl), 0);
  const consistencyPct = Number(account.evalConsistencyPct) || 0;
  const consistencyOk = consistencyPct > 0 ? (totalProfit > 0 ? (bestDay / totalProfit) * 100 < consistencyPct : true) : true;
  const bestDayShare = totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;
  const passed = profit >= target && target > 0 && consistencyOk;
  return { profit, target, pct, consistencyOk, bestDayShare, consistencyPct, passed };
}

// ---------------- Account health (one aggregate for the "at a glance" widget) ----------------
// Combines drawdown/DLL/inactivity/payout (and eval progress) into a single overall severity so
// the UI can render one clear color/status per account instead of scanning five separate numbers.
// Severity order: loss (danger) > warn > neutral > profit (all clear).
const HEALTH_SEVERITY = { loss: 3, warn: 2, neutral: 1, profit: 0 };
function accountHealth(account, trades) {
  if (!account) return null;
  const dd = drawdownInfo(account, trades);
  const dll = dllInfo(account, trades);
  const inact = inactivityInfo(account, trades);
  const payout = payoutInfo(account, trades);
  const evalP = evalProgress(account, trades);
  const balance = accountBalance(account, trades);
  const parts = [];
  if (dd) parts.push({ key: 'dd', label: dd.type === 'trailing' ? 'Drawdown suiveur' : 'Drawdown statique', color: dd.color, detail: dd });
  if (dll) parts.push({ key: 'dll', label: 'Perte journalière (DLL)', color: dll.color, detail: dll });
  if (inact) parts.push({ key: 'inact', label: 'Inactivité', color: inact.color, detail: inact });
  if (payout) parts.push({ key: 'payout', label: 'Payout', color: payout.eligible ? 'profit' : 'neutral', detail: payout });
  if (evalP) parts.push({ key: 'eval', label: 'Évaluation', color: evalP.passed ? 'profit' : (evalP.consistencyOk ? 'neutral' : 'warn'), detail: evalP });
  let overall = 'profit';
  parts.forEach(p => { if ((HEALTH_SEVERITY[p.color] ?? 0) > HEALTH_SEVERITY[overall]) overall = p.color; });
  // Worst first — every consumer (accounts list, dashboard banner) gets the same reading order
  // without re-sorting itself, so the most urgent thing is always what's scanned first.
  parts.sort((a, b) => (HEALTH_SEVERITY[b.color] ?? 0) - (HEALTH_SEVERITY[a.color] ?? 0));
  return { balance, parts, overall };
}

// The single worst-severity part of a health result — what a compact "why is this account
// flagged" summary should lead with (dashboard attention banner, etc).
function worstHealthPart(health) {
  if (!health || !health.parts.length) return null;
  return health.parts.reduce((w, p) => (w == null || (HEALTH_SEVERITY[p.color] ?? 0) > (HEALTH_SEVERITY[w.color] ?? 0)) ? p : w, null);
}

// Compact one-line value for a health part, with no repeated label — shared by every place that
// renders a health part so the wording never drifts between the accounts list, the dashboard
// "attention" banner, etc.
function healthPartShort(part) {
  const d = part.detail;
  if (part.key === 'dd') return window.fmtMoney(d.margin, { dec: 0 });
  if (part.key === 'dll') return d.breached ? 'dépassé' : window.fmtMoney(d.margin, { dec: 0 });
  if (part.key === 'inact') return d.status === 'closed' ? 'clôturé' : d.status === 'dormant' ? 'dormant' : d.remaining + ' j';
  if (part.key === 'payout') return d.eligible ? 'éligible' : d.qualDays + '/' + d.minDays + ' j';
  if (part.key === 'eval') return d.pct.toFixed(0) + ' %';
  return '';
}

// ---------------- Demo dataset (shown to brand-new users during the tour) ----------------
const DEMO_ACCOUNTS = [
  { id: 'demo_m', name: 'Compte 1 — Démo', firm: 'Apex', size: 50000, role: 'master', coef: 1,
    status: 'funded', instrument: 'MES+ES', color: '#1b1a17', eod: 2000, opened: '2026-05-01', lastTrade: '2026-06-26',
    ddType: 'trailing', ddAmount: 2500, ddStop: 52500 },
  { id: 'demo_s', name: 'Compte 2 — Démo', firm: 'Apex', size: 50000, role: 'slave', coef: 1,
    status: 'funded', instrument: 'MES', color: '#1f8a5b', eod: 2000, opened: '2026-05-01', lastTrade: '2026-06-26',
    ddType: 'trailing', ddAmount: 2500, ddStop: 52500, hasDll: true, dllAmount: 1000,
    hasInactivity: true, inactMinNet: 50, inactMinQualDays: 2, inactWindow: 30, inactDormantDays: 15, inactCloseDays: 30 },
  { id: 'demo_c', name: 'Compte 3 — Démo', firm: 'Lucid', size: 25000, role: 'slave', coef: 1,
    status: 'funded', instrument: 'ES', color: '#b9802a', eod: 1000, opened: '2026-06-12' },
];

function demoLegs(ids, contracts, gross) {
  return ids.map(id => {
    const acc = DEMO_ACCOUNTS.find(a => a.id === id);
    const coef = acc.role === 'master' ? 1 : acc.coef;
    const c = acc.role === 'master' ? contracts : Math.max(1, Math.round(contracts * coef));
    const g = Math.round(gross * coef);
    const fee = (acc.firm === 'Lucid' ? 1.00 : 1.04) * c;
    return { accountId: id, coef, contracts: c, gross: g, fees: +fee.toFixed(2), pnl: +(g - fee).toFixed(2) };
  });
}
const DEMO_RAW = [
  ['2026-06-15', 'MES', 2, 88, 3, ['demo_m', 'demo_s']],
  ['2026-06-16', 'MES', 1, -42, 2, ['demo_m', 'demo_s']],
  ['2026-06-18', 'MES', 3, 156, 3, ['demo_m', 'demo_s']],
  ['2026-06-19', 'ES', 1, 220, 3, ['demo_m', 'demo_c']],
  ['2026-06-23', 'MES', 2, -60, 1, ['demo_m', 'demo_s']],
  ['2026-06-24', 'MES', 2, 104, 2, ['demo_m', 'demo_s']],
  ['2026-06-26', 'ES', 1, 180, 3, ['demo_m', 'demo_c']],
];
const DEMO_TRADES = DEMO_RAW.map((r, i) => {
  const [date, symbol, contracts, gross, mindset, ids] = r;
  return { id: 'D' + (i + 1), symbol, contracts, date, gross, mindset, notes: '', accounts: demoLegs(ids, contracts, gross), hasChart: false };
}).reverse();

Object.assign(window, {
  DEMO_ACCOUNTS, DEMO_TRADES,
  FEE, REPLAY_ACCOUNT_ID, REPLAY_ACCOUNT, ACCOUNTS, TRADES, INSTRUMENTS, MINDSET_LABEL, buildLegs, refLeg, computeRefAccountId,
  fmtMoney, fmtNum, fmtPct, fmtDateFR, tradePnl, tradeGross, tradeFees, tradeContracts,
  tradesForScope, computeStats, dailyPnl, equityCurve, tradesInRange, periodRange, PERIOD_LABEL, daysSince, todayDate, todayIso, addDaysIso, daysBetweenIso, inactivityInfo, isInactive, dllInfo, drawdownInfo, accountBalance, peakEquity, accountTradePnl, payoutInfo, evalProgress, accountHealth, worstHealthPart, healthPartShort, isoDate,
});
