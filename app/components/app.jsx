// app.jsx — shell: sidebar, routing, global state, scope selector, tweaks
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;
window.AppCtx = React.createContext(null);

// ---- local persistence (so edits / "repartir de 0" survive a refresh) ----
const LS = { trades: 'tj_trades_v5', accounts: 'tj_accounts_v5' };
function loadLS(key, fallback) {
  try { const s = localStorage.getItem(key); if (s != null) return JSON.parse(s); } catch (e) {}
  return fallback;
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
function hasLS(key) { try { return localStorage.getItem(key) != null; } catch (e) { return false; } }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// keep trades newest-first by date (stable for same date) so a back-dated trade lands in place
function sortTradesDesc(arr) {
  return arr.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ---- unique trade ids (repairs any duplicate ids in stored data, preserving everything else) ----
let __idSeq = 0;
function newTradeId(existing) {
  const taken = new Set((existing || []).map((t) => t.id));
  let id;
  do { __idSeq++; id = 'T' + Date.now().toString(36) + __idSeq.toString(36); } while (taken.has(id));
  return id;
}
function ensureUniqueIds(trades) {
  const seen = new Set();
  let changed = false;
  const out = trades.map((t) => {
    if (!t.id || seen.has(t.id)) {
      changed = true;
      const id = newTradeId(trades) + '_' + seen.size;
      seen.add(id);
      return { ...t, id };
    }
    seen.add(t.id);
    return t;
  });
  return changed ? out : trades;
}

const NAV = [
{ id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
{ id: 'journal', label: 'Journal', icon: 'journal' },
{ id: 'calendar', label: 'Calendrier', icon: 'calendar' },
{ id: 'analytics', label: 'Statistiques', icon: 'stats' },
{ id: 'payout', label: 'Payout', icon: 'wallet' },
{ id: 'accounts', label: 'Comptes', icon: 'accounts' }];

const TITLES = {
  dashboard: 'Tableau de bord', journal: 'Journal des trades', calendar: 'Calendrier de performance',
  analytics: 'Statistiques', payout: 'Éligibilité aux payouts', accounts: 'Mes comptes'
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dashLayout": "overview",
  "accent": "#1f8a5b",
  "font": "Space Grotesk",
  "density": "regular",
  "blurAmounts": true
} /*EDITMODE-END*/;

function ScopeSelector() {
  const ctx = React.useContext(window.AppCtx);
  const [open, setOpen] = useStateApp(false);
  const current = ctx.scope === 'all' ? null : ctx.scope === 'ref' ? null : ctx.accounts.find((a) => a.id === ctx.scope);
  const isRef = ctx.scope === 'ref';
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} className="tj-scope">
        {current ? <window.AccountDot color={current.color} /> : isRef ? <window.Icon name="target" size={13} stroke={2.4} style={{ color: 'var(--gold-ink)' }} /> : <span style={{ width: 8, height: 8, borderRadius: 999, background: 'linear-gradient(90deg,var(--profit),var(--info))', display: 'inline-block' }} />}
        <span style={{ fontWeight: 600 }}>{current ? current.name : isRef ? 'Compte maître' : 'Tous les comptes'}</span>
        <window.Icon name="chevD" size={15} />
      </button>
      {open &&
      <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 41, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px -14px rgba(20,20,18,.3)', padding: 6, minWidth: 250 }}>
            <button className="tj-scopeitem" onClick={() => {ctx.setScope('ref');setOpen(false);}}>
              <window.Icon name="target" size={13} stroke={2.4} style={{ color: 'var(--gold-ink)' }} />
              <span style={{ fontWeight: 600 }}>Compte maître</span>
              {ctx.scope === 'ref' && <window.Icon name="check" size={15} style={{ marginLeft: 'auto', color: 'var(--profit)' }} />}
            </button>
            <div style={{ margin: '0 12px 5px', fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.3 }}>Vue simplifiée : uniquement le compte de référence (×1) de chaque trade</div>
            <button className="tj-scopeitem" onClick={() => {ctx.setScope('all');setOpen(false);}}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--ink)', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>Tous les comptes</span>
              {ctx.scope === 'all' && <window.Icon name="check" size={15} style={{ marginLeft: 'auto', color: 'var(--profit)' }} />}
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '5px 4px' }} />
            {ctx.accounts.map((a) => (
              <button key={a.id} className="tj-scopeitem" onClick={() => {ctx.setScope(a.id); setOpen(false);}}>
                <window.AccountDot color={a.color} />
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                {ctx.scope === a.id && <window.Icon name="check" size={15} style={{ marginLeft: 'auto', color: 'var(--profit)' }} />}
              </button>
            ))}
          </div>
        </>
      }
    </div>);

}

function PeriodSelector() {
  const ctx = React.useContext(window.AppCtx);
  const [open, setOpen] = useStateApp(false);
  const presets = ['all', 'day', 'week', 'month', 'prevMonth', 'quarter', 'year'];
  const label = window.PERIOD_LABEL[ctx.period.preset];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} className="tj-scope">
        <window.Icon name="calendar" size={15} />
        <span style={{ fontWeight: 600 }}>{label}</span>
        <window.Icon name="chevD" size={15} />
      </button>
      {open &&
      <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 41, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px -14px rgba(20,20,18,.3)', padding: 6, minWidth: 220 }}>
            {presets.map((p) =>
          <button key={p} className="tj-scopeitem" onClick={() => { ctx.setPeriod({ preset: p, from: null, to: null }); setOpen(false); }}>
                <span style={{ fontWeight: 600 }}>{window.PERIOD_LABEL[p]}</span>
                {ctx.period.preset === p && <window.Icon name="check" size={15} style={{ marginLeft: 'auto', color: 'var(--profit)' }} />}
              </button>
          )}
            <div style={{ height: 1, background: 'var(--border)', margin: '5px 4px' }} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                Plage personnalisée
                {ctx.period.preset === 'custom' && <window.Icon name="check" size={14} style={{ color: 'var(--profit)' }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <input type="date" value={ctx.period.from || ''} onChange={(e) => ctx.setPeriod({ preset: 'custom', from: e.target.value, to: ctx.period.to || '2026-06-11' })}
                  style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--ink)' }} />
                <input type="date" value={ctx.period.to || ''} onChange={(e) => ctx.setPeriod({ preset: 'custom', from: ctx.period.from || '2026-04-01', to: e.target.value })}
                  style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--ink)' }} />
              </div>
            </div>
          </div>
        </>
      }
    </div>);

}

function Sidebar() {
  const ctx = React.useContext(window.AppCtx);
  return (
    <aside style={{ width: 244, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ padding: '22px 22px 18px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <window.Icon name="stats" size={18} stroke={2.4} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, lineHeight: 1 }}>Journal de Trading</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>journal de trading</div>
        </div>
      </div>
      <nav style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }} data-tour="sidebar">
        {NAV.map((n) => {
          const active = ctx.route === n.id;
          return (
            <button key={n.id} onClick={() => ctx.nav(n.id)} className="tj-nav" data-tour-nav={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, textAlign: 'left',
              background: active ? 'var(--ink)' : 'transparent', color: active ? '#fff' : 'var(--ink-2)', width: '100%'
            }}>
              <window.Icon name={n.icon} size={18} stroke={2} />{n.label}
            </button>);

        })}
      </nav>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span data-tour="new-session" style={{ display: 'block' }}><window.Button icon="plus" style={{ width: '100%' }} onClick={() => ctx.openSession()}>Nouvelle séance</window.Button></span>
        <button className="tj-sidelink" data-tour="backup" onClick={() => ctx.openBackup()}>
          <window.Icon name="arrowDown" size={15} /> Sauvegarde des données
        </button>
        <button className="tj-sidelink" onClick={() => ctx.openSettings()}>
          <window.Icon name="stats" size={15} /> Paramètres
        </button>
      </div>
    </aside>);

}

function App() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateApp('dashboard');
  const [trades, setTrades] = useStateApp(() => sortTradesDesc(ensureUniqueIds(loadLS(LS.trades, window.TRADES))));
  const [accounts, setAccounts] = useStateApp(() => loadLS(LS.accounts, window.ACCOUNTS));
  const [scope, setScope] = useStateApp('ref');
  const [modal, setModal] = useStateApp(null); // {type:'trade'|'detail'|'account', id}
  const [confirm, setConfirm] = useStateApp(null); // {title, message, confirmLabel, onConfirm}
  const [period, setPeriod] = useStateApp({ preset: 'month', from: null, to: null });
  const [showReplay, setShowReplay] = useStateApp(false); // toggle: compare with the "Replay" training sessions
  const [journalDateFilter, setJournalDateFilter] = useStateApp(null); // ISO date, set when a calendar cell is clicked
  const [sync, setSync] = useStateApp({ supported: window.FileSync.supported, connected: false, name: '', lastSync: null, busy: false, error: null, autoOn: true });
  const syncDebounce = useRefApp(null);
  const skipFirstPush = useRefApp(true);
  const [dragActive, setDragActive] = useStateApp(false);
  const dragDepth = useRefApp(0);

  React.useEffect(() => {
    function hasFiles(e) { return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'); }
    function onDragEnter(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setDragActive(true);
    }
    function onDragOver(e) { if (hasFiles(e)) e.preventDefault(); }
    function onDragLeave(e) {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    }
    function onDrop(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setModal({ type: 'import', initialText: reader.result });
      reader.readAsText(file);
    }
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const range = period.preset === 'custom' ? { from: period.from, to: period.to } : window.periodRange(period.preset);
  const periodTrades = window.tradesInRange(trades, range.from, range.to);
  const viewTrades = periodTrades;
  const liveAccounts = accounts.filter((a) => !a.archived);
  const accountsView = liveAccounts;
  const effScope = scope;

  function buildPayload() {
    return { app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), accounts, trades };
  }

  // restore a previously linked sync file on startup (link survives refresh; permission re-asked on first write)
  useEffectApp(() => {
    if (!window.FileSync.supported) return;
    (async () => {
      const h = await window.FileSync.restore();
      if (h) setSync((s) => ({ ...s, connected: true, name: window.FileSync.name() }));
    })();
  }, []);

  // auto-push to the linked file (debounced) whenever data changes
  useEffectApp(() => {
    if (skipFirstPush.current) { skipFirstPush.current = false; return; }
    if (!sync.connected || !sync.autoOn) return;
    if (syncDebounce.current) clearTimeout(syncDebounce.current);
    syncDebounce.current = setTimeout(async () => {
      try {
        setSync((s) => ({ ...s, busy: true }));
        await window.FileSync.write({ app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), accounts, trades });
        setSync((s) => ({ ...s, busy: false, lastSync: new Date().toISOString(), error: null }));
      } catch (e) {
        setSync((s) => ({ ...s, busy: false, error: e.message === 'permission' ? 'permission' : 'write' }));
      }
    }, 1500);
    return () => { if (syncDebounce.current) clearTimeout(syncDebounce.current); };
  }, [trades, accounts, sync.connected, sync.autoOn]);

  // auto-push to GitHub (debounced a few seconds after the last change), independent of the Drive/Dropbox sync above
  const ghDebounce = useRefApp(null);
  const ghSkipFirst = useRefApp(true);
  useEffectApp(() => {
    if (ghSkipFirst.current) { ghSkipFirst.current = false; return; }
    const cfg = window.ghLoadCfg();
    if (!cfg.connected || !cfg.autoOn) return;
    if (ghDebounce.current) clearTimeout(ghDebounce.current);
    ghDebounce.current = setTimeout(() => {
      window.ghMergeAndSync(cfg, accounts, trades).then(({ accounts: ma, trades: mt }) => {
        window.ghSaveCfg({ ...cfg, lastSync: new Date().toISOString() });
        if (ma.length !== accounts.length || mt.length !== trades.length) { setAccounts(ma); setTrades(sortTradesDesc(ensureUniqueIds(mt))); } // pick up additions made on another device
      }).catch(() => {});
    }, 4000);
    return () => { if (ghDebounce.current) clearTimeout(ghDebounce.current); };
  }, [trades, accounts]);


  // persist on every change — localStorage stays authoritative for this session; IndexedDB mirrors
  // it (local-first store for future GitHub sync). Never remove the localStorage writes.
  useEffectApp(() => { saveLS(LS.trades, trades); window.idbSet('trades', trades); }, [trades]);
  useEffectApp(() => { saveLS(LS.accounts, accounts); window.idbSet('accounts', accounts); }, [accounts]);

  // one-time on load: if IndexedDB already holds a copy from a previous session (bigger/richer
  // local-first store), and localStorage was never written this session before it, prefer it.
  // Otherwise seed IndexedDB from the current localStorage/demo data so it starts mirroring.
  const idbLoadedRef = useRefApp(false);
  const [hadLSAtMount] = useStateApp(() => hasLS(LS.trades) || hasLS(LS.accounts)); // captured at first render, before any save effect can run
  useEffectApp(() => {
    if (idbLoadedRef.current) return;
    idbLoadedRef.current = true;
    (async () => {
      const [idbTrades, idbAccounts] = await Promise.all([window.idbGet('trades'), window.idbGet('accounts')]);
      if (Array.isArray(idbTrades) && Array.isArray(idbAccounts) && !hadLSAtMount) {
        setTrades(sortTradesDesc(ensureUniqueIds(idbTrades)));
        setAccounts(idbAccounts);
      } else {
        window.idbSet('trades', trades);
        window.idbSet('accounts', accounts);
      }
    })();
  }, []);

  // auto-pull from GitHub once per page load, whenever a device is connected — merge-safe: unions
  // remote with local (never deletes), then mirrors the merged result back to GitHub, so opening the
  // app on any device picks up whatever was added elsewhere without erasing local additions.
  const ghAutoPullRef = useRefApp(false);
  useEffectApp(() => {
    if (ghAutoPullRef.current) return;
    ghAutoPullRef.current = true;
    const cfg = window.ghLoadCfg();
    if (!cfg.connected) return;
    window.ghMergeAndSync(cfg, accounts, trades).then(({ accounts: ma, trades: mt }) => {
      setAccounts(ma);
      setTrades(sortTradesDesc(ensureUniqueIds(mt)));
      window.ghSaveCfg({ ...cfg, lastSync: new Date().toISOString() });
    }).catch(() => {}); // stay on local data if unreachable (offline, token revoked, …)
  }, []);

  // one-time migration: recompute leg fees from each account's prop-firm fee (Lucid 1.00, Apex 1.04…),
  // preserving manually-adjusted legs. Runs once, gated by a localStorage flag.
  useEffectApp(() => {
    if (loadLS('tj_fees_recalc_v1', false)) return;
    setTrades((prev) => prev.map((tr) => {
      if (tr.noTrade || !tr.accounts) return tr;
      const accounts = tr.accounts.map((l) => {
        if (l.manual) return l;
        const acc = accounts0Ref(l.accountId);
        if (!acc) return l;
        const fee = window.accountFee(acc, tr.symbol);
        const fees = +(fee * l.contracts).toFixed(2);
        if (fees === l.fees) return l;
        return { ...l, fees, pnl: +(l.gross - fees).toFixed(2) };
      });
      return { ...tr, accounts };
    }));
    saveLS('tj_fees_recalc_v1', true);
    function accounts0Ref(id) { return accounts.find((a) => a.id === id); }
  }, []);

  // one-time: remove all trades tied to Lucid accounts (requested cleanup), preserving everything else
  useEffectApp(() => {
    if (loadLS('tj_del_lucid_v1', false)) return;
    const lucidIds = new Set(accounts.filter((a) => String(a.firm || '').toLowerCase() === 'lucid').map((a) => a.id));
    if (lucidIds.size) {
      setTrades((prev) => prev
        .map((tr) => tr.accounts ? { ...tr, accounts: tr.accounts.filter((l) => !lucidIds.has(l.accountId)) } : tr)
        .filter((tr) => tr.noTrade || tr.replay || !tr.accounts || tr.accounts.length > 0));
    }
    saveLS('tj_del_lucid_v1', true);
  }, []);

  // one-time migration (refonte config prop firm): the 3 original seed accounts (50k, trailing
  // 2000/52100) predate the firm/type system and were never tagged — apply the real Apex 50K EOD
  // rule set to them. Also recovers any account referenced by a trade leg but missing from the
  // accounts list (e.g. wiped by an earlier "Réinitialiser la démo" click, which replaces accounts
  // without touching already-synced trades — a real bug — leaving orphaned legs with real P&L).
  // Recovered accounts are named "à vérifier" so they're obviously flagged for a manual check
  // (exact size/type guessed from the Lucid fee-per-contract match); nothing is deleted.
  useEffectApp(() => {
    if (loadLS('tj_migrate_propfirm_v1', false)) return;
    setAccounts((prev) => {
      const apexEod = (window.firmAccountTypes('Apex') || []).find((x) => x.id === 'apex_50_eod');
      let next = prev.map((a) => {
        if (a.firm || a.ddType !== 'trailing' || Number(a.ddAmount) !== 2000 || Number(a.ddStop) !== 52100 || Number(a.size) !== 50000) return a;
        if (!apexEod) return a;
        const { id, label, ...rules } = apexEod;
        return { ...a, firm: 'Apex', accountTypeId: apexEod.id, ...rules };
      });
      const known = new Set(next.map((a) => a.id));
      known.add(window.REPLAY_ACCOUNT_ID);
      const missing = new Map(); // accountId -> {first, last} trade date seen
      trades.forEach((tr) => {
        if (!tr.accounts) return;
        tr.accounts.forEach((l) => {
          if (known.has(l.accountId)) return;
          const e = missing.get(l.accountId) || { first: tr.date, last: tr.date };
          if (tr.date < e.first) e.first = tr.date;
          if (tr.date > e.last) e.last = tr.date;
          missing.set(l.accountId, e);
        });
      });
      if (missing.size) {
        const lucid25 = (window.firmAccountTypes('Lucid') || []).find((x) => x.id === 'lucid_25_funded');
        const { id: tid, label, ...rules } = lucid25 || {};
        let i = 0;
        missing.forEach((e, accId) => {
          i++;
          next = [...next, {
            id: accId, name: 'Lucid récupéré ' + i + ' (à vérifier)', firm: 'Lucid', accountTypeId: tid || null,
            role: 'slave', coef: 1, status: 'funded', instrument: 'MES', color: '#b9802a',
            opened: e.first, lastTrade: e.last, ...rules,
          }];
        });
      }
      return next;
    });
    saveLS('tj_migrate_propfirm_v1', true);
  }, []);

  const ctx = {
    t, route, scope: effScope, trades, accounts: liveAccounts, allAccounts: accounts, accountsView, showReplay, journalDateFilter, period, range, viewTrades, periodTrades,
    nav: setRoute, setScope, setPeriod, setShowReplay, setJournalDateFilter,
    openTrade: (id) => setModal(id === 'new' ? { type: 'trade' } : { type: 'detail', id }),
    editTrade: (id) => setModal({ type: 'trade', id }),
    openAccount: (id) => setModal({ type: 'account', id }),
    openImport: () => setModal({ type: 'import' }),
    openSession: () => setModal({ type: 'session' }),
    openBackup: () => setModal({ type: 'backup' }),
    openSettings: () => setModal({ type: 'settings' }),
    addTrade: (tr) => setTrades((prev) => sortTradesDesc([{ id: newTradeId(prev), ...tr }, ...prev])),
    updateTrade: (id, patch) => setTrades((prev) => sortTradesDesc(prev.map((t) => t.id === id ? { ...t, ...patch } : t))),
    updateTradeLeg: (tradeId, accountId, newNet) => setTrades((prev) => prev.map((t) => {
      if (t.id !== tradeId) return t;
      return { ...t, accounts: t.accounts.map((l) => l.accountId === accountId ? { ...l, pnl: +Number(newNet).toFixed(2), gross: +(Number(newNet) + l.fees).toFixed(2), manual: true } : l) };
    })),
    addTrades: (list) => setTrades((prev) => { let acc = prev.slice(); const made = list.map((tr) => { const id = newTradeId(acc); const nt = { id, ...tr }; acc = [nt, ...acc]; return nt; }); return sortTradesDesc([...made, ...prev]); }),
    deleteTrade: (id) => setTrades((prev) => prev.filter((x) => x.id !== id)),
    deleteTrades: (ids) => setTrades((prev) => prev.filter((x) => !ids.includes(x.id))),
    addAccount: (a) => setAccounts((prev) => [...prev, { ...a, id: 'acc_' + Date.now() }]),
    updateAccount: (id, patch) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a)),
    // Pushes a firm/account-type's full rule set (drawdown, DLL, inactivity, payout, eval fields —
    // whatever the type carries) onto every account tied to it, whenever that type's definition
    // changes in Paramètres. A generic spread rather than a field-by-field list so new rule fields
    // (added to a type later) propagate automatically without another edit here. Never touches
    // fields a type doesn't govern (name, color, role, coef, opened, payouts/adjustments history).
    resyncAccountsToType: (firm, typeId) => {
      const t = window.firmAccountTypes(firm).find((x) => x.id === typeId);
      if (!t) return;
      const { id, label, ...rules } = t;
      setAccounts((prev) => prev.map((a) => {
        if (String(a.firm || '').toLowerCase() !== String(firm || '').toLowerCase() || a.accountTypeId !== typeId) return a;
        const n = { ...a, ...rules };
        if (rules.hasPayout && !n.payouts) n.payouts = [];
        return n;
      }));
    },
    archiveAccount: (id, val = true) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, archived: val } : a)),
    resetAccount: (id) => {
      setTrades((prev) => prev.map((t) => t.accounts ? { ...t, accounts: t.accounts.filter((l) => l.accountId !== id) } : t).filter((t) => t.noTrade || t.replay || !t.accounts || t.accounts.length > 0));
      setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, archived: false, opened: window.todayIso(), lastTrade: null, adjustments: [], payouts: [] } : a));
    },
    addPayout: (accountId, entry) => setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, payouts: [...(a.payouts || []), entry] } : a)),
    deletePayout: (accountId, payoutId) => setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, payouts: (a.payouts || []).filter((p) => p.id !== payoutId) } : a)),
    recalcFees: () => setTrades((prev) => prev.map((tr) => {
      if (tr.noTrade || !tr.accounts) return tr;
      return { ...tr, accounts: tr.accounts.map((l) => {
        if (l.manual) return l;
        const acc = accounts.find((a) => a.id === l.accountId);
        if (!acc) return l;
        const fees = +(window.accountFee(acc, tr.symbol) * l.contracts).toFixed(2);
        return fees === l.fees ? l : { ...l, fees, pnl: +(l.gross - fees).toFixed(2) };
      }) };
    })),
    adjustAccount: (id, entry) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, adjustments: [...(a.adjustments || []), entry] } : a)),
    deleteAdjustment: (id, entryId) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, adjustments: (a.adjustments || []).filter((e) => e.id !== entryId) } : a)),
    setMaster: (id) => setAccounts((prev) => prev.map((a) => {
      if (a.id === id) return { ...a, role: 'master', coef: 1, instrument: 'MES+ES' };
      if (a.role === 'master') return { ...a, role: 'slave', instrument: a.instrument === 'MES+ES' ? 'MES' : a.instrument };
      return a;
    })),
    deleteAccount: (id) => {
      setTrades((prev) => prev.map((t) => ({ ...t, accounts: t.accounts.filter((l) => l.accountId !== id) })).filter((t) => t.accounts.length));
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setScope((s) => s === id ? 'all' : s);
    },
    resetDemo: () => {
      const acc = clone(window.ACCOUNTS), tr = clone(window.TRADES);
      setAccounts(acc); setTrades(tr);
      setScope(acc.find((a) => a.role === 'master')?.id || 'all');
    },
    clearAll: () => { setAccounts([]); setTrades([]); setScope('all'); },
    exportBackup: () => {
      const data = { app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), accounts, trades };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const a = document.createElement('a');
      a.href = url; a.download = 'journal-trading-sauvegarde-' + stamp + '.json'; a.click();
      URL.revokeObjectURL(url);
    },
    restoreBackup: (acc, tr) => {
      setAccounts(acc); setTrades(tr);
      setScope(acc.find((a) => a.role === 'master')?.id || 'all');
    },
    sync,
    syncConnectNew: async () => {
      try {
        await window.FileSync.connectNew('journal-trading.json');
        await window.FileSync.write({ app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), accounts, trades });
        setSync((s) => ({ ...s, connected: true, name: window.FileSync.name(), lastSync: new Date().toISOString(), error: null }));
      } catch (e) { if (e.name !== 'AbortError') setSync((s) => ({ ...s, error: (e.name === 'SecurityError' || window.FileSync.inIframe) ? 'iframe' : 'connect' })); }
    },
    syncConnectExisting: async () => {
      try {
        await window.FileSync.connectExisting();
        const data = await window.FileSync.read(true);
        setSync((s) => ({ ...s, connected: true, name: window.FileSync.name(), error: null }));
        return data; // caller decides whether to load it
      } catch (e) { if (e.name !== 'AbortError') setSync((s) => ({ ...s, error: e.message === 'invalid' ? 'invalid' : ((e.name === 'SecurityError' || window.FileSync.inIframe) ? 'iframe' : 'connect') })); return null; }
    },
    syncPushNow: async () => {
      try {
        setSync((s) => ({ ...s, busy: true }));
        await window.FileSync.write({ app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), accounts, trades });
        setSync((s) => ({ ...s, busy: false, lastSync: new Date().toISOString(), error: null }));
      } catch (e) { setSync((s) => ({ ...s, busy: false, error: e.message === 'permission' ? 'permission' : 'write' })); }
    },
    syncPullNow: async () => {
      try {
        setSync((s) => ({ ...s, busy: true }));
        const data = await window.FileSync.read(true);
        setSync((s) => ({ ...s, busy: false, error: null }));
        return data;
      } catch (e) { setSync((s) => ({ ...s, busy: false, error: e.message === 'permission' ? 'permission' : (e.message === 'invalid' ? 'invalid' : 'read') })); return null; }
    },
    syncDisconnect: async () => { await window.FileSync.disconnect(); setSync((s) => ({ ...s, connected: false, name: '', lastSync: null, error: null })); },
    setSyncAuto: (on) => setSync((s) => ({ ...s, autoOn: on })),
    confirm: (opts) => setConfirm(opts)
  };

  const fontStack = '"' + (t.font || 'Space Grotesk') + '", "Manrope", sans-serif';
  const dens = t.density === 'compact' ? 22 : t.density === 'comfy' ? 40 : 30;


  return (
    <window.AppCtx.Provider value={ctx}>
      <div style={{ '--font-display': fontStack, '--accent': t.accent, display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* top bar */}
          <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'color-mix(in oklab, var(--bg) 82%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, letterSpacing: '-.01em' }}>{TITLES[route]}</h1>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {(route === 'dashboard' || route === 'journal' || route === 'calendar') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {window.computeStats(trades, window.REPLAY_ACCOUNT_ID).total > 0 && (
                    <button className="tj-iconbtn" title={showReplay ? 'Masquer la comparaison avec le Replay' : 'Comparer avec le Replay'}
                      onClick={() => setShowReplay(v => !v)}
                      style={{ width: 'auto', padding: '0 12px', gap: 7, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: showReplay ? 'var(--ink)' : 'var(--ink-2)', background: showReplay ? 'var(--surface-2)' : 'var(--surface)', borderColor: showReplay ? 'var(--ink)' : 'var(--border)' }}>
                      {showReplay && <window.Icon name="check" size={13} stroke={3} />} vs. replay
                    </button>
                  )}
                </div>
              )}
              {route !== 'calendar' && <PeriodSelector />}
              {route !== 'analytics' && route !== 'payout' && <ScopeSelector />}
              <window.Button icon="plus" size="sm" onClick={() => ctx.openSession()}>Séance</window.Button>
            </div>
          </header>
          <div style={{ padding: dens + 'px 32px 60px', maxWidth: 1320, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {route === 'dashboard' && <window.Dashboard />}
            {route === 'journal' && <window.Journal />}
            {route === 'calendar' && (
              <window.CalendarView scope={scope} onPickDay={(iso) => { setJournalDateFilter(iso); setPeriod({ preset: 'custom', from: iso, to: iso }); setRoute('journal'); }} />
            )}
            {route === 'analytics' && <window.Analytics />}
            {route === 'payout' && <window.Payout />}
            {route === 'accounts' && <window.Accounts />}
          </div>
        </main>

        {modal?.type === 'trade' && <window.AddTradeModal tradeId={modal.id} onClose={() => setModal(null)} />}
        {modal?.type === 'session' && <window.SessionModal onClose={() => setModal(null)} />}
        {modal?.type === 'detail' && <window.TradeDetailModal tradeId={modal.id} onClose={() => setModal(null)} />}
        {modal?.type === 'account' && <window.AccountModal accountId={modal.id} onClose={() => setModal(null)} />}
        {modal?.type === 'import' && <window.ImportModal onClose={() => setModal(null)} initialText={modal.initialText} />}
        {modal?.type === 'backup' && <window.BackupModal onClose={() => setModal(null)} />}
        {modal?.type === 'settings' && <window.SettingsModal onClose={() => setModal(null)} />}
        {confirm && <window.ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}

        <window.TweaksPanel>
          <window.TweakSection label="Tableau de bord" />
          <window.TweakRadio label="Disposition" value={t.dashLayout} options={[{ value: 'overview', label: 'Vue d\'ensemble' }, { value: 'compact', label: 'Compact' }, { value: 'accounts', label: 'Par compte' }]} onChange={(v) => setTweak('dashLayout', v)} />
          <window.TweakSection label="Apparence" />
          <window.TweakColor label="Couleur d'accent" value={t.accent} options={['#1f8a5b', '#2a6fdb', '#d97757', '#9b6dff']} onChange={(v) => setTweak('accent', v)} />
          <window.TweakSelect label="Police d'affichage" value={t.font} options={['Space Grotesk', 'Manrope', 'IBM Plex Mono']} onChange={(v) => setTweak('font', v)} />
          <window.TweakRadio label="Densité" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
          <window.TweakToggle label="Masquer (flouter) les montants par compte" value={t.blurAmounts} onChange={(v) => setTweak('blurAmounts', v)} />
          <window.TweakSection label="Données" />
          <window.TweakButton label="Recalculer les frais (selon prop firms)" secondary onClick={() => ctx.confirm({ title: 'Recalculer les frais ?', message: 'Les frais de tous les trades seront recalculés d\'après les frais par contrat de chaque prop firm (les montants ajustés manuellement sont préservés).', confirmLabel: 'Recalculer', danger: false, onConfirm: ctx.recalcFees })} />
          <window.TweakButton label="Sauvegarde (export / import JSON)" onClick={() => ctx.openBackup()} />
          <window.TweakButton label="Réinitialiser les données de démo" secondary onClick={() => ctx.confirm({ title: 'Réinitialiser les données ?', message: 'Vos comptes et trades actuels seront remplacés par les données de démonstration d\'origine.', confirmLabel: 'Réinitialiser', danger: true, onConfirm: ctx.resetDemo })} />
        </window.TweaksPanel>

        {dragActive && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500, background: 'color-mix(in oklab, var(--ink) 55%, transparent)',
            backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              border: '2.5px dashed #fff', borderRadius: 20, padding: '48px 64px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 14, color: '#fff', background: 'color-mix(in oklab, var(--ink) 70%, transparent)',
            }}>
              <window.Icon name="journal" size={38} stroke={1.6} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>Déposez votre fichier CSV</div>
              <div style={{ fontSize: 13.5, opacity: .75 }}>Les trades seront proposés à l'import</div>
            </div>
          </div>
        )}
      </div>
    </window.AppCtx.Provider>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);