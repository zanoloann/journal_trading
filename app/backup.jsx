// backup.jsx — full JSON backup + file sync (Drive/Dropbox)
const { useState: useStateBk, useRef: useRefBk } = React;

// --- Minimal ZIP writer (store method, no compression) — no external deps ---
let _crcTable = null;
function crc32(bytes) {
  if (!_crcTable) {
    _crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); _crcTable[n] = c >>> 0; }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = _crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime(d) {
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F);
  const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F);
  return { time, date };
}
// files: [{ name, content(string) }] -> Blob (application/zip)
function buildZip(files) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const chunks = []; const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const dataBytes = enc.encode(f.content);
    const crc = crc32(dataBytes);
    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0, true);
    localHeader.setUint16(8, 0, true); // store
    localHeader.setUint16(10, time, true);
    localHeader.setUint16(12, date, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, dataBytes.length, true);
    localHeader.setUint32(22, dataBytes.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);
    chunks.push(new Uint8Array(localHeader.buffer), nameBytes, dataBytes);
    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0, true);
    centralHeader.setUint16(10, 0, true);
    centralHeader.setUint16(12, time, true);
    centralHeader.setUint16(14, date, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, dataBytes.length, true);
    centralHeader.setUint32(24, dataBytes.length, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);
    central.push(new Uint8Array(centralHeader.buffer), nameBytes);
    offset += 30 + nameBytes.length + dataBytes.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
// Convert current accounts + trades into the NDJSON repo structure (data/accounts.json + data/trades/YYYY-MM.ndjson)
function buildNdjsonFiles(accounts, trades) {
  const byMonth = {};
  trades.forEach(t => {
    const month = (t.date || '').slice(0, 7) || 'sans-date';
    (byMonth[month] = byMonth[month] || []).push(t);
  });
  const files = [{ name: 'data/accounts.json', content: JSON.stringify(accounts, null, 2) }];
  Object.keys(byMonth).sort().forEach(month => {
    const lines = byMonth[month].slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(t => JSON.stringify(t));
    files.push({ name: 'data/trades/' + month + '.ndjson', content: lines.join('\n') + '\n' });
  });
  return files;
}

function BackupModal({ onClose }) {
  const ctx = React.useContext(window.AppCtx);
  const fileRef = useRefBk(null);
  const [incoming, setIncoming] = useStateBk(null); // {accounts, trades, exportedAt, error}
  const [pulled, setPulled] = useStateBk(null); // data read from the linked sync file, awaiting load confirm
  const sync = ctx.sync;

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
  };
  const syncErrMsg = {
    permission: "Accès au fichier refusé. Cliquez sur « Envoyer maintenant » et autorisez l'accès.",
    write: "Échec de l'écriture dans le fichier.",
    read: 'Échec de la lecture du fichier.',
    invalid: 'Ce fichier n\'est pas une sauvegarde valide de ce journal.',
    connect: 'Connexion au fichier impossible.',
    iframe: "La synchro fichier est bloquée dans l'aperçu intégré. Ouvrez l'app dans un onglet de navigateur à part (bouton « Ouvrir » / ↗), puis réessayez.",
  };

  async function doConnectExisting() {
    const data = await ctx.syncConnectExisting();
    if (data) setPulled({ accounts: data.accounts, trades: data.trades, exportedAt: data.exportedAt });
  }
  async function doPull() {
    const data = await ctx.syncPullNow();
    if (data) setPulled({ accounts: data.accounts, trades: data.trades, exportedAt: data.exportedAt });
  }
  function confirmPull() {
    ctx.confirm({
      title: 'Charger depuis le fichier ?',
      message: 'Vos données actuelles seront remplacées par le contenu du fichier de synchronisation (' + pulled.accounts.length + ' comptes · ' + pulled.trades.length + ' trades).',
      confirmLabel: 'Charger', danger: true,
      onConfirm: () => { ctx.restoreBackup(pulled.accounts, pulled.trades); setPulled(null); onClose(); ctx.nav('dashboard'); },
    });
  }

  function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.accounts) || !Array.isArray(data.trades)) {
          setIncoming({ error: 'Fichier invalide : il ne ressemble pas à une sauvegarde de ce journal.' });
          return;
        }
        setIncoming({ accounts: data.accounts, trades: data.trades, exportedAt: data.exportedAt });
      } catch (err) {
        setIncoming({ error: 'Impossible de lire ce fichier (JSON invalide).' });
      }
    };
    reader.readAsText(file);
  }

  function confirmRestore() {
    ctx.confirm({
      title: 'Remplacer toutes vos données ?',
      message: 'Vos ' + ctx.accounts.length + ' compte(s) et ' + ctx.trades.length + ' trade(s) actuels seront remplacés par la sauvegarde (' + incoming.accounts.length + ' comptes · ' + incoming.trades.length + ' trades). Cette action est irréversible.',
      confirmLabel: 'Remplacer mes données',
      onConfirm: () => { ctx.restoreBackup(incoming.accounts, incoming.trades); onClose(); ctx.nav('dashboard'); },
    });
  }

  const fmtExportDate = (iso) => {
    try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,18,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 540, boxShadow: '0 24px 70px -20px rgba(20,20,18,.45)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>Sauvegarde des données</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink-3)' }}>Synchronisez vers un fichier (Drive/Dropbox) pour retrouver vos données sur tous vos PC, ou exportez une sauvegarde ponctuelle.</p>
          </div>
          <button className="tj-iconbtn" onClick={onClose}><window.Icon name="close" size={18} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {/* SYNC (Option 1: linked JSON file in a Drive/Dropbox folder) */}
          <window.GithubSyncPanel />
          <div style={{ padding: 18, borderRadius: 14, border: '1px solid ' + (sync.connected ? 'var(--profit)' : 'var(--border)'), background: sync.connected ? 'color-mix(in oklab, var(--profit) 6%, var(--surface))' : 'var(--surface)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><window.Icon name="link" size={17} /></div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Synchronisation automatique</h3>
              {sync.connected && <window.Badge tone="profit" style={{ fontSize: 10, marginLeft: 'auto' }}>Activée</window.Badge>}
            </div>

            {sync.supported && window.FileSync.inIframe && !sync.connected && (
              <div style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 12.5, lineHeight: 1.5, display: 'flex', gap: 8 }}>
                <window.Icon name="alert" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Vous êtes dans l'aperçu intégré. Pour activer la synchro, ouvrez d'abord l'app dans un <strong>onglet de navigateur séparé</strong> (Chrome/Edge/Brave), sinon le choix du fichier sera bloqué.</span>
              </div>
            )}
            {!sync.supported ? (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Cette fonctionnalité nécessite <strong>Google Chrome, Microsoft Edge ou Brave</strong> sur ordinateur. Votre navigateur actuel ne la prend pas en charge — utilisez l'export / import manuel ci-dessous.
              </p>
            ) : !sync.connected ? (
              <>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Liez un fichier <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>.json</code> placé dans votre dossier <strong>Drive / Dropbox / OneDrive</strong>. L'app y enregistre vos données <strong>automatiquement</strong> à chaque changement — accessibles ensuite sur vos autres PC (via le même fichier synchronisé).
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <window.Button variant="primary" icon="plus" onClick={() => ctx.syncConnectNew()} style={{ flex: 1, minWidth: 180 }}>Créer un fichier de synchro</window.Button>
                  <window.Button variant="secondary" icon="link" onClick={doConnectExisting} style={{ flex: 1, minWidth: 180 }}>Lier un fichier existant</window.Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 12 }}>
                  <window.Icon name="journal" size={15} style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{sync.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                    {sync.busy ? 'envoi…' : (sync.lastSync ? 'synchro ' + fmtTime(sync.lastSync) : 'lié')}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginBottom: 12 }}>
                  <button type="button" onClick={() => ctx.setSyncAuto(!sync.autoOn)} style={{ width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', background: sync.autoOn ? 'var(--profit)' : 'var(--border-strong)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 2, left: sync.autoOn ? 18 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Envoi automatique à chaque modification</span>
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <window.Button variant="secondary" size="sm" icon="arrowUp" onClick={() => ctx.syncPushNow()}>Envoyer maintenant</window.Button>
                  <window.Button variant="secondary" size="sm" icon="arrowDown" onClick={doPull}>Charger depuis le fichier</window.Button>
                  <window.Button variant="ghost" size="sm" onClick={() => ctx.syncDisconnect()} style={{ color: 'var(--loss)', marginLeft: 'auto' }}>Délier</window.Button>
                </div>
              </>
            )}

            {sync.error && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 12.5 }}>{syncErrMsg[sync.error] || 'Erreur de synchronisation.'}</div>
            )}
            {pulled && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Fichier lu</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>{pulled.accounts.length} comptes · {pulled.trades.length} trades{pulled.exportedAt ? ' · ' + fmtTime(pulled.exportedAt) : ''}</div>
                <window.Button variant="danger" size="sm" icon="check" onClick={confirmPull} style={{ width: '100%', marginTop: 10 }}>Charger ces données dans l'app</window.Button>
              </div>
            )}
          </div>

          {/* EXPORT */}
          <div style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--profit-bg)', color: 'var(--profit)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><window.Icon name="arrowDown" size={17} /></div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Exporter</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Télécharge un fichier <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>.json</code> contenant <strong>tous</strong> vos comptes ({ctx.accounts.length}) et trades ({ctx.trades.length}), avec coefficients, règles et ventilation par compte.
            </p>
            <window.Button variant="primary" icon="arrowDown" onClick={() => ctx.exportBackup()} style={{ width: '100%' }}>Télécharger ma sauvegarde</window.Button>
          </div>

          {/* NDJSON EXPORT — préfigure la future structure de repo (accounts.json + un fichier par mois) */}
          <div style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><window.Icon name="journal" size={17} /></div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Export NDJSON <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}>(structure repo)</span></h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Télécharge un <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>.zip</code> avec <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>data/accounts.json</code> et un fichier <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>data/trades/AAAA-MM.ndjson</code> par mois (un trade = une ligne) — la structure prévue pour la synchro GitHub à venir. N'affecte pas vos données actuelles.
            </p>
            <window.Button variant="secondary" icon="arrowDown" onClick={() => {
              const zip = buildZip(buildNdjsonFiles(ctx.accounts, ctx.trades));
              const url = URL.createObjectURL(zip);
              const a = document.createElement('a');
              a.href = url; a.download = 'trading-journal-ndjson.zip'; a.click();
              URL.revokeObjectURL(url);
            }} style={{ width: '100%' }}>Télécharger la structure NDJSON</window.Button>
          </div>

          {/* IMPORT */}
          <div style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><window.Icon name="arrowUp" size={17} /></div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Importer / restaurer</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Chargez une sauvegarde <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>.json</code> pour restaurer vos données (remplace les données actuelles).
            </p>
            <window.Button variant="secondary" icon="journal" onClick={() => fileRef.current.click()} style={{ width: '100%' }}>Choisir un fichier de sauvegarde</window.Button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: 'none' }} />

            {incoming && incoming.error && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--loss-bg)', color: 'var(--loss)', fontSize: 13 }}>{incoming.error}</div>
            )}
            {incoming && !incoming.error && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Sauvegarde valide</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>
                  {incoming.accounts.length} comptes · {incoming.trades.length} trades{incoming.exportedAt ? ' · exportée le ' + fmtExportDate(incoming.exportedAt) : ''}
                </div>
                <window.Button variant="danger" icon="check" onClick={confirmRestore} style={{ width: '100%', marginTop: 12 }}>Remplacer mes données</window.Button>
              </div>
            )}
          </div>

          <p style={{ margin: '16px 2px 0', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Astuce multi-PC : créez le fichier de synchro dans un dossier <strong>Drive / Dropbox</strong>. Sur un autre PC, ouvrez l'app puis « Lier un fichier existant » en pointant le même fichier synchronisé.
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BackupModal, buildNdjsonFiles, buildZip });
