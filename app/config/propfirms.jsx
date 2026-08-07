// propfirms.jsx — prop firms: broker fees (per contract) + account types they sell.
// A firm's account type carries its own rules: drawdown, daily loss limit (DLL), inactivity
// (dormant/close escalation), payout eligibility (two models: 'scale' for Apex-style progressive
// caps with a consistency rule, 'pctCapped' for Lucid-style % of profit capped at a fixed ceiling),
// and eval-only fields (profit target, max loss limit, size caps) for evaluation-phase accounts.
// Broker fees (Tradovate) don't change over time; a firm's rules can, per account type.
// Kept in sync by hand with config/propfirms.json (human-readable reference copy).
const DEFAULT_PROPFIRMS = [
  { name: 'Apex', fees: { MES: 1.04 }, accountTypes: [
    { id: 'apex_50_eod', label: '50K EOD (PA)', size: 50000,
      ddType: 'trailing', ddAmount: 2000, ddStop: 52100,
      hasDll: true, dllAmount: 1000,
      hasInactivity: true, inactMinNet: 50, inactMinQualDays: 2, inactWindow: 30, inactDormantDays: 15, inactCloseDays: 30,
      hasPayout: true, payoutModel: 'scale',
      payoutMinDays: 5, payoutMinNet: 250, consistencyPct: 50,
      safetyNet: 52100, payoutMinBalance: 52600, payoutMin: 500,
      maxPayouts: 6, payoutScale: [1500, 1500, 2000, 2500, 2500, 3000], payoutSplit: 100,
      activationFee: 99 },
    { id: 'apex_50_legacy', label: '50K Legacy (avant 01/03/2026)', size: 50000,
      ddType: 'trailing', ddAmount: 2500,
      hasDll: false,
      hasInactivity: true, inactMinNet: 150, inactMinQualDays: 1, inactWindow: 180, inactCloseDays: 180,
      hasPayout: true, payoutModel: 'scale',
      payoutMinDays: 5, payoutMinTradingDays: 8, payoutMinNet: 50, consistencyPct: 30,
      safetyNet: 2600, safetyNetMaxPayouts: 3, payoutMinBalance: 52600,
      payoutScale: [2000, 2000, 2000, 2000, 2000], payoutCapExpires: true,
      payoutSplitNote: '100 % sur les premiers 25 000 $ cumulés sur ce compte, puis 90 % ; repasse à 100 % dès le 6ᵉ payout approuvé.' },
  ] },
  { name: 'Lucid', fees: { MES: 1.00 }, accountTypes: [
    { id: 'lucid_25_funded', label: 'Flex 25K — Funded', size: 25000,
      ddType: 'trailing', ddAmount: 1000,
      hasDll: false, hasInactivity: false,
      hasPayout: true, payoutModel: 'pctCapped',
      payoutMinDays: 5, payoutMinNet: 100, payoutPct: 50, payoutCap: 1000,
      requireOverallProfit: true, maxPayouts: 5, payoutSplit: 90 },
    { id: 'lucid_50_funded', label: 'Flex 50K — Funded', size: 50000,
      ddType: 'trailing', ddAmount: 2000,
      hasDll: false, hasInactivity: false,
      hasPayout: true, payoutModel: 'pctCapped',
      payoutMinDays: 5, payoutMinNet: 150, payoutPct: 50, payoutCap: 2000,
      requireOverallProfit: true, maxPayouts: 5, payoutSplit: 90 },
    { id: 'lucid_25_eval', label: 'Flex 25K — Évaluation', size: 25000, isEval: true,
      profitTarget: 1250, maxLossLimit: 1000,
      ddType: 'trailing', ddAmount: 1000,
      hasDll: false, hasInactivity: false, hasPayout: false,
      evalConsistencyPct: 50, sizeCapMini: 2, sizeCapMicro: 20 },
    { id: 'lucid_50_eval', label: 'Flex 50K — Évaluation', size: 50000, isEval: true,
      profitTarget: 3000, maxLossLimit: 2000,
      ddType: 'trailing', ddAmount: 2000,
      hasDll: false, hasInactivity: false, hasPayout: false,
      evalConsistencyPct: 50, sizeCapMini: 4, sizeCapMicro: 40 },
  ] },
];
// v2 -> v3: new rule shape (DLL, dormant/close inactivity, payout models, eval fields). This key
// holds prop-firm RULE config only (never trading data — accounts.json / trades ndjson are the
// protected, never-bumped keys per CLAUDE.md). Bumping it just re-seeds firms/types from the
// richer defaults above; any account referencing an old accountTypeId still works via feeFor()
// fallback, and re-picking the type in the account editor re-syncs it to the new rules.
const PF_LS = 'tj_propfirms_v3';

function loadPropfirms() {
  const list = DEFAULT_PROPFIRMS.map(f => ({ name: f.name, fees: { ...f.fees }, accountTypes: (f.accountTypes || []).map(t => ({ ...t })) }));
  try {
    const saved = JSON.parse(localStorage.getItem(PF_LS) || 'null');
    if (Array.isArray(saved)) {
      saved.forEach(s => {
        if (!s || !s.name) return;
        const ex = list.find(x => x.name.toLowerCase() === s.name.toLowerCase());
        if (ex) { ex.fees = { ...ex.fees, ...s.fees }; if (Array.isArray(s.accountTypes)) ex.accountTypes = s.accountTypes.map(t => ({ ...t })); }
        else list.push({ name: s.name, fees: { ...s.fees }, accountTypes: Array.isArray(s.accountTypes) ? s.accountTypes.map(t => ({ ...t })) : [] });
      });
    }
  } catch (e) {}
  return list;
}

let PROPFIRMS = loadPropfirms();
// dispatched on every local mutation so app.jsx can debounce a GitHub push, same as trades/accounts
function savePropfirms() {
  try { localStorage.setItem(PF_LS, JSON.stringify(PROPFIRMS)); } catch (e) {}
  try { window.dispatchEvent(new Event('tj:propfirms-changed')); } catch (e) {}
}
// overwrite the in-memory + localStorage copy from a merged remote result (GitHub pull), without
// dispatching the change event — this IS the synced state, not a new local edit to push again.
function replacePropfirms(list) {
  PROPFIRMS = (list || []).map(f => ({ name: f.name, fees: { ...f.fees }, accountTypes: (f.accountTypes || []).map(t => ({ ...t })) }));
  try { localStorage.setItem(PF_LS, JSON.stringify(PROPFIRMS)); } catch (e) {}
}
function listPropfirms() { return PROPFIRMS.map(f => f.name); }
function getPropfirms() { return PROPFIRMS.map(f => ({ name: f.name, fees: { ...f.fees }, accountTypes: (f.accountTypes || []).map(t => ({ ...t })) })); }
function findFirm(name) { return PROPFIRMS.find(f => f.name.toLowerCase() === String(name || '').toLowerCase()); }
function isDefaultFirm(name) { return DEFAULT_PROPFIRMS.some(f => f.name.toLowerCase() === String(name || '').toLowerCase()); }

function feeFor(name, instrument) {
  const f = findFirm(name);
  if (!f) return window.FEE;
  const v = f.fees[instrument];
  if (v != null) return Number(v);
  if (f.fees.MES != null) return Number(f.fees.MES);
  return window.FEE;
}
function accountFee(account, instrument) {
  if (account && account.feePerContract != null && account.feePerContract !== '') return Number(account.feePerContract);
  return feeFor(account && account.firm, instrument);
}

// ---- mutations ----
function addPropfirm(name, fees, accountTypes) {
  if (!name) return;
  const ex = findFirm(name);
  if (ex) { ex.fees = { ...ex.fees, ...fees }; if (accountTypes) ex.accountTypes = accountTypes; }
  else PROPFIRMS.push({ name, fees: { ...fees }, accountTypes: accountTypes || [] });
  savePropfirms();
}
function setFirmFee(name, instrument, val) {
  const f = findFirm(name); if (f) { f.fees[instrument] = Number(val); savePropfirms(); }
}
function removePropfirm(name) {
  const i = PROPFIRMS.findIndex(f => f.name.toLowerCase() === String(name || '').toLowerCase());
  if (i >= 0) { PROPFIRMS.splice(i, 1); savePropfirms(); }
}
function setFirmAccountTypes(name, types) {
  const f = findFirm(name); if (f) { f.accountTypes = types.map(t => ({ ...t })); savePropfirms(); }
}
function firmAccountTypes(name) { const f = findFirm(name); return f ? (f.accountTypes || []) : []; }

Object.assign(window, {
  PROPFIRMS, loadPropfirms, listPropfirms, getPropfirms, replacePropfirms, findFirm, isDefaultFirm,
  feeFor, accountFee, addPropfirm, setFirmFee, removePropfirm, setFirmAccountTypes, firmAccountTypes,
});
