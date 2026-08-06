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
async function ghPutFile(token, owner, repo, path, content, message) {
  const sha = await ghGetSha(token, owner, repo, path);
  const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, {
    method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: b64EncodeUtf8(content), sha: sha || undefined }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'write-' + path); }
}
async function ghSyncAll(cfg, accounts, trades) {
  const files = window.buildNdjsonFiles(accounts, trades);
  for (const f of files) {
    await ghPutFile(cfg.token, cfg.owner, cfg.repo, f.name, f.content, 'Sync journal — ' + new Date().toISOString());
  }
}
function b64DecodeUtf8(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }
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
// Pull data/accounts.json + all data/trades/*.ndjson from the repo, rebuild the in-app shape.
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
  return { accounts, trades };
}

Object.assign(window, { ghLoadCfg, ghSaveCfg, ghSyncAll, ghPullAll });
