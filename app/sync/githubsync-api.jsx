// githubsync.jsx — push the NDJSON structure (data/accounts.json + data/trades/AAAA-MM.ndjson) to a
// private GitHub repo. Local-first: never blocks the UI, runs a few seconds after the user stops
// typing/editing, same debounce pattern as the Drive/Dropbox FileSync. Config (token/owner/repo)
// lives in its own localStorage key — separate from tj_accounts_v5 / tj_trades_v5.
const GH_CFG_KEY = 'tj_github_cfg_v1';
function ghLoadCfg() {
  try { const s = localStorage.getItem(GH_CFG_KEY); if (s) return JSON.parse(s); } catch (e) {}
  return { token: '', owner: '', repo: '', path: 'data', autoOn: true, connected: false, lastSync: null };
}
function ghSaveCfg(cfg) { try { localStorage.setItem(GH_CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }

function ghHeaders(token) { return { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }

async function ghWhoAmI(token) {
  const res = await fetch('https://api.github.com/user', { headers: ghHeaders(token) });
  if (!res.ok) throw new Error('auth');
  return res.json();
}
async function ghCreateRepo(token, name) {
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, private: true, description: 'Journal de trading — export NDJSON', auto_init: true }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'create-repo'); }
  return res.json();
}
async function ghGetRepo(token, owner, repo) {
  const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo, { headers: ghHeaders(token) });
  if (res.status === 404) throw new Error('not-found');
  if (!res.ok) throw new Error('read-repo');
  return res.json();
}
async function ghGetSha(token, owner, repo, path) {
  const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('read-' + path);
  const j = await res.json();
  return j.sha || null;
}
function b64EncodeUtf8(str) { return btoa(unescape(encodeURIComponent(str))); }
// A 409 here means the file's sha changed between our GET and our PUT — another sync (another tab,
// device, or an overlapping call of our own) wrote to the same path in between. Refetching the sha
// and retrying once resolves it as long as the two writers agree on content (they do: both are
// derived from the same merge-by-id logic, so the retry's PUT is redundant with, not conflicting
// with, whatever just landed).
async function ghPutFile(token, owner, repo, path, content, message, _retried) {
  const sha = await ghGetSha(token, owner, repo, path);
  const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, {
    method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: b64EncodeUtf8(content), sha: sha || undefined }),
  });
  if (!res.ok) {
    if (res.status === 409 && !_retried) return ghPutFile(token, owner, repo, path, content, message, true);
    const e = await res.json().catch(() => ({})); throw new Error(e.message || 'write-' + path);
  }
}
async function ghSyncAll(cfg, accounts, trades, propfirms, deleted) {
  const files = window.buildNdjsonFiles(accounts, trades, propfirms);
  for (const f of files) {
    await ghPutFile(cfg.token, cfg.owner, cfg.repo, f.name, f.content, 'Sync journal — ' + new Date().toISOString());
  }
  if (deleted) {
    await ghPutFile(cfg.token, cfg.owner, cfg.repo, 'data/deleted.json', JSON.stringify(deleted, null, 2), 'Sync journal — ' + new Date().toISOString());
  }
}function b64DecodeUtf8(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }
async function ghGetFile(token, owner, repo, path) {
  const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('read-' + path);
  const j = await res.json();
  return b64DecodeUtf8(j.content);
}
async function ghListDir(token, owner, repo, path) {
  const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, { headers: ghHeaders(token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('list-' + path);
  return res.json();
}
// Pull data/accounts.json + all data/trades/*.ndjson + data/propfirms.json from the repo, rebuild
// the in-app shape. propfirms.json is optional (older repos / first sync won't have it yet).
async function ghPullAll(cfg) {
  const accJson = await ghGetFile(cfg.token, cfg.owner, cfg.repo, 'data/accounts.json');
  if (accJson === null) throw new Error('no-data');
  const accounts = JSON.parse(accJson);
  const entries = await ghListDir(cfg.token, cfg.owner, cfg.repo, 'data/trades');
  const trades = [];
  for (const entry of entries.filter(e => e.name.endsWith('.ndjson'))) {
    const content = await ghGetFile(cfg.token, cfg.owner, cfg.repo, 'data/trades/' + entry.name);
    if (!content) continue;
    content.split('\n').forEach(line => { const t = line.trim(); if (t) trades.push(JSON.parse(t)); });
  }
  const pfJson = await ghGetFile(cfg.token, cfg.owner, cfg.repo, 'data/propfirms.json');
  const propfirms = pfJson ? JSON.parse(pfJson) : [];
  const delJson = await ghGetFile(cfg.token, cfg.owner, cfg.repo, 'data/deleted.json');
  const deleted = delJson ? JSON.parse(delJson) : { accounts: [], trades: [] };
  return { accounts, trades, propfirms, deleted };
}

// Deletion tombstones (survive across devices/merges) — every account/trade id ever deleted
// locally is recorded here so a later merge won't resurrect it just because another device (or
// GitHub itself, if that device synced first) still has the old copy. Read/written straight to
// localStorage, same self-contained pattern as ghLoadCfg/ghSaveCfg.
const GH_DELETED_KEY = 'tj_deleted_ids_v1';
function ghLoadDeleted() {
  try { const s = localStorage.getItem(GH_DELETED_KEY); if (s) return JSON.parse(s); } catch (e) {}
  return { accounts: [], trades: [] };
}
function ghSaveDeleted(d) { try { localStorage.setItem(GH_DELETED_KEY, JSON.stringify(d)); } catch (e) {} }
// Called at the moment of deletion (deleteAccount/deleteTrade/deleteTrades in app.jsx) so the
// tombstone exists locally even before the next GitHub sync picks it up.
function ghMarkDeleted(kind, ids) {
  if (!ids || !ids.length) return;
  const d = ghLoadDeleted();
  d[kind] = Array.from(new Set([...(d[kind] || []), ...ids]));
  ghSaveDeleted(d);
}

// Merge-safe sync: never a blind overwrite in either direction. Pulls whatever is currently on
// GitHub, unions it with the local data (by id — a trade or account present on either side survives;
// on an id present on both sides the LOCAL version wins, since it's the one just edited), pushes the
// merged result back, and returns it so the caller can also update local state. This is what lets two
// devices add different trades independently without one push erasing the other's addition. Ids
// recorded as deleted (locally or on another device, unioned via data/deleted.json) are dropped from
// the union regardless of which side still carries them, so a deletion actually sticks.
function mergeById(remoteList, localList, deletedIds) {
  const map = new Map();
  (remoteList || []).forEach(item => { if (item && item.id) map.set(item.id, item); });
  (localList || []).forEach(item => { if (item && item.id) map.set(item.id, item); }); // local overrides on shared id
  (deletedIds || []).forEach(id => map.delete(id));
  return Array.from(map.values());
}
// Prop firms have no id, just a name — same local-wins union as mergeById, keyed by name instead.
function mergeFirmsByName(remoteList, localList) {
  const map = new Map();
  (remoteList || []).forEach(f => { if (f && f.name) map.set(f.name.toLowerCase(), f); });
  (localList || []).forEach(f => { if (f && f.name) map.set(f.name.toLowerCase(), f); });
  return Array.from(map.values());
}
async function ghMergeAndSyncImpl(cfg, localAccounts, localTrades, localPropfirms) {
  let remote = { accounts: [], trades: [], propfirms: [], deleted: { accounts: [], trades: [] } };
  try { remote = await ghPullAll(cfg); } catch (e) {} // repo empty / first sync — nothing to merge yet
  const local = ghLoadDeleted();
  const deleted = {
    accounts: Array.from(new Set([...(remote.deleted?.accounts || []), ...(local.accounts || [])])),
    trades: Array.from(new Set([...(remote.deleted?.trades || []), ...(local.trades || [])])),
  };
  const accounts = mergeById(remote.accounts, localAccounts, deleted.accounts);
  const trades = mergeById(remote.trades, localTrades, deleted.trades);
  const propfirms = mergeFirmsByName(remote.propfirms, localPropfirms);
  await ghSyncAll(cfg, accounts, trades, propfirms, deleted);
  // Re-read localStorage rather than reusing `deleted`: this function awaits several network
  // round-trips, and a delete clicked mid-flight (ghMarkDeleted, called synchronously and
  // immediately) can land in localStorage while this call is still in the air. Overwriting with
  // the snapshot captured at the top would silently drop that tombstone — which is exactly how one
  // of two same-session deletions can end up surviving while the other keeps coming back. A later
  // sync cycle still picks up whatever remote doesn't have yet, so merging here (never regressing)
  // is enough; it doesn't need to also re-push in the same call.
  const freshLocal = ghLoadDeleted();
  ghSaveDeleted({
    accounts: Array.from(new Set([...(deleted.accounts || []), ...(freshLocal.accounts || [])])),
    trades: Array.from(new Set([...(deleted.trades || []), ...(freshLocal.trades || [])])),
  });
  return { accounts, trades, propfirms, deleted };
}
// Every call site (auto-pull on load, the debounced auto-push, and the three manual buttons in the
// settings panel) can fire independently and land within moments of each other — e.g. deleting an
// account arms the debounced push, and clicking "Récupérer les nouveautés" right after starts a
// second merge before the first is done. Two concurrent merges each PUT the same GitHub files
// (accounts.json, trade months, deleted.json) with a sha fetched before their own write, so the
// second writer's sha is stale by the time it lands — GitHub rejects it with a 409 ("is at X but
// expected Y"), which is the error this queue exists to prevent. Chaining every call onto one
// promise (continuing past a rejection so one failure can't wedge the queue) makes them run
// strictly one at a time instead of interleaving their writes.
let ghSyncQueue = Promise.resolve();
function ghMergeAndSync(cfg, localAccounts, localTrades, localPropfirms) {
  const run = () => ghMergeAndSyncImpl(cfg, localAccounts, localTrades, localPropfirms);
  const result = ghSyncQueue.then(run, run);
  ghSyncQueue = result.then(() => {}, () => {});
  return result;
}

Object.assign(window, { ghLoadCfg, ghSaveCfg, ghSyncAll, ghPullAll, ghMergeAndSync, ghMarkDeleted, ghLoadDeleted });
