// githubsync-panel.jsx — settings UI for the GitHub sync (uses ghLoadCfg/ghSaveCfg/ghSyncAll from githubsync-api.jsx)
function GithubSyncPanel() {
  const ctx = React.useContext(window.AppCtx);
  const [cfg, setCfgState] = React.useState(ghLoadCfg());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [mode, setMode] = React.useState('existing'); // 'existing' | 'create'
  const [repoName, setRepoName] = React.useState('journal_trading');
  const [tokenInput, setTokenInput] = React.useState(cfg.token || '');
  function setCfg(patch) { setCfgState((s) => { const n = { ...s, ...patch }; ghSaveCfg(n); return n; }); }

  async function doConnectExisting() {
    setError(null); setBusy(true);
    try {
      const me = await ghWhoAmI(tokenInput);
      const repo = await ghGetRepo(tokenInput, me.login, repoName);
      const next = { token: tokenInput, owner: me.login, repo: repo.name, connected: true, lastSync: null };
      setCfg(next);
      try {
        const { accounts: ma, trades: mt } = await window.ghMergeAndSync(next, ctx.accounts, ctx.trades);
        ctx.restoreBackup(ma, mt); // merge-safe: union of local + remote, never a deletion
        setCfg({ ...next, lastSync: new Date().toISOString() });
      } catch (e) {} // repo may be empty/unreachable on first connect — local data stays as-is
    } catch (e) { setError(e.message === 'auth' ? 'Token invalide ou expiré.' : e.message === 'not-found' ? 'Repo introuvable sous ce compte — vérifie le nom.' : (e.message || 'Échec de la connexion.')); }
    setBusy(false);
  }
  async function doCreateAndConnect() {
    setError(null); setBusy(true);
    try {
      const me = await ghWhoAmI(tokenInput);
      const repo = await ghCreateRepo(tokenInput, repoName);
      setCfg({ token: tokenInput, owner: me.login, repo: repo.name, connected: true, lastSync: null });
    } catch (e) { setError(e.message === 'auth' ? 'Token invalide ou expiré.' : (e.message || 'Échec de la création du repo.')); }
    setBusy(false);
  }
  async function doSyncNow() {
    setError(null); setBusy(true);
    try {
      const { accounts: ma, trades: mt } = await window.ghMergeAndSync(cfg, ctx.accounts, ctx.trades);
      setCfg({ lastSync: new Date().toISOString() });
      if (ma.length !== ctx.accounts.length || mt.length !== ctx.trades.length) ctx.restoreBackup(ma, mt); // pick up additions synced from another device
    }
    catch (e) { setError('Échec de la synchro (' + e.message + ').'); }
    setBusy(false);
  }
  async function doPullNow() {
    setError(null); setBusy(true);
    try {
      const { accounts: ma, trades: mt } = await window.ghMergeAndSync(cfg, ctx.accounts, ctx.trades);
      setCfg({ lastSync: new Date().toISOString() });
      ctx.restoreBackup(ma, mt); // merge-safe: union with local, never deletes
      ctx.nav('dashboard');
    } catch (e) { setError(e.message === 'no-data' ? 'Aucune donnée trouvée dans ce repo.' : ('Échec du chargement (' + e.message + ').')); }
    setBusy(false);
  }
  function doDisconnect() { setCfg({ connected: false }); }

  const fmtTime = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; } };

  return (
    <div style={{ padding: 18, borderRadius: 14, border: '1px solid ' + (cfg.connected ? 'var(--profit)' : 'var(--border)'), background: cfg.connected ? 'color-mix(in oklab, var(--profit) 6%, var(--surface))' : 'var(--surface)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><window.Icon name="link" size={17} /></div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Synchro GitHub</h3>
        {cfg.connected && <window.Badge tone="profit" style={{ fontSize: 10, marginLeft: 'auto' }}>Connecté</window.Badge>}
      </div>
      {!cfg.connected ? (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Pousse la structure NDJSON (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>data/accounts.json</code> + un fichier par mois) dans un repo GitHub. Nécessite un <strong>token personnel</strong> (Settings → Developer settings → Personal access tokens, droit <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>repo</code>).
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <window.Button variant={mode === 'existing' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('existing')} style={{ flex: 1 }}>Repo existant</window.Button>
            <window.Button variant={mode === 'create' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('create')} style={{ flex: 1 }}>Nouveau repo</window.Button>
          </div>
          <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Token GitHub (ghp_…)"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 8 }} />
          <input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="Nom du repo (ex. journal_trading)"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, background: 'var(--surface-2)', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 12 }} />
          {mode === 'existing' ? (
            <window.Button variant="primary" icon="link" disabled={!tokenInput || !repoName || busy} onClick={doConnectExisting} style={{ width: '100%' }}>{busy ? 'Connexion…' : 'Connecter ce repo'}</window.Button>
          ) : (
            <window.Button variant="primary" icon="plus" disabled={!tokenInput || !repoName || busy} onClick={doCreateAndConnect} style={{ width: '100%' }}>{busy ? 'Création…' : 'Créer le repo et connecter'}</window.Button>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 12 }}>
            <window.Icon name="journal" size={15} style={{ color: 'var(--ink-3)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{cfg.owner}/{cfg.repo}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{busy ? 'envoi…' : 'synchro ' + fmtTime(cfg.lastSync)}</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginBottom: 12 }}>
            <button type="button" onClick={() => setCfg({ autoOn: !cfg.autoOn })} style={{ width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', background: cfg.autoOn ? 'var(--profit)' : 'var(--border-strong)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: cfg.autoOn ? 18 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Envoi automatique quelques secondes après chaque changement</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <window.Button variant="secondary" size="sm" icon="arrowUp" disabled={busy} onClick={doSyncNow}>Synchroniser maintenant</window.Button>
            <window.Button variant="secondary" size="sm" icon="arrowDown" disabled={busy} onClick={doPullNow}>Récupérer les nouveautés</window.Button>
            <window.Button variant="ghost" size="sm" onClick={doDisconnect} style={{ color: 'var(--loss)', marginLeft: 'auto' }}>Délier</window.Button>
          </div>
        </>
      )}
      {error && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 12.5 }}>{error}</div>}
    </div>
  );
}
Object.assign(window, { ghLoadCfg, ghSaveCfg, ghSyncAll, ghMergeAndSync, GithubSyncPanel });
