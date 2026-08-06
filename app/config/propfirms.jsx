// propfirms.jsx — prop firms: broker fees (per contract) + account types they sell.
// A firm's account type carries its own rules (inactivity now; payout later).
// Broker fees (Tradovate) don't change over time; a firm's rules can, per account type.
const DEFAULT_PROPFIRMS = [
  { name: 'Apex', fees: { MES: 1.04 }, accountTypes: [
    { id: 'apex_50', label: '50K EOD', size: 50000, eod: 2000, ddType: 'trailing', ddAmount: 2000, ddStop: 52100, hasInactivity: false,
      hasPayout: true, payoutMinDays: 5, payoutMinNet: 250, safetyNet: 52100, payoutMinBalance: 52600, payoutMin: 500,
      consistencyPct: 50, maxPayouts: 6, payoutScale: [1500, 1500, 2000, 2500, 2500, 3000], payoutSplit: 100 },
  ] },
  { name: 'Lucid', fees: { MES: 1.00 }, accountTypes: [
    { id: 'lucid_25', label: '25K', size: 25000, eod: 1000, ddType: 'trailing', ddAmount: 1000, ddStop: 26500, hasInactivity: false, hasPayout: false },
  ] },
];
const PF_LS = 'tj_propfirms_v2';

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
function savePropfirms() { try { localStorage.setItem(PF_LS, JSON.stringify(PROPFIRMS)); } catch (e) {} }
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
  PROPFIRMS, loadPropfirms, listPropfirms, getPropfirms, findFirm, isDefaultFirm,
  feeFor, accountFee, addPropfirm, setFirmFee, removePropfirm, setFirmAccountTypes, firmAccountTypes,
});
