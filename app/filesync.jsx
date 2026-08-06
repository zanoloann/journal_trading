// filesync.jsx — Option 1: sync data to a real JSON file (place it in a Drive/Dropbox folder)
// Uses the File System Access API (Chromium: Chrome/Edge/Brave). The chosen file handle is
// persisted in IndexedDB so the link survives refreshes.

const FS_DB = 'tj_filesync_db', FS_STORE = 'handles', FS_KEY = 'syncFile';

function fsIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(FS_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await fsIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_STORE, 'readonly').objectStore(FS_STORE).get(key);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbSet(key, val) {
  const db = await fsIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_STORE, 'readwrite');
    tx.objectStore(FS_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key) {
  const db = await fsIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_STORE, 'readwrite');
    tx.objectStore(FS_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const FileSync = {
  supported: (typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function'),
  inIframe: (window.self !== window.top),
  handle: null,

  async restore() {
    try { this.handle = (await idbGet(FS_KEY)) || null; } catch (e) { this.handle = null; }
    return this.handle;
  },
  name() { return this.handle ? this.handle.name : ''; },

  async permission(readWrite, requestIfNeeded) {
    if (!this.handle) return 'no-handle';
    const opts = { mode: readWrite ? 'readwrite' : 'read' };
    let p = await this.handle.queryPermission(opts);
    if (p !== 'granted' && requestIfNeeded) p = await this.handle.requestPermission(opts);
    return p; // 'granted' | 'denied' | 'prompt'
  },

  async connectNew(suggestedName) {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggestedName || 'journal-trading.json',
      types: [{ description: 'Sauvegarde JSON', accept: { 'application/json': ['.json'] } }],
    });
    this.handle = handle; await idbSet(FS_KEY, handle); return handle;
  },
  async connectExisting() {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Sauvegarde JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    this.handle = handle; await idbSet(FS_KEY, handle); return handle;
  },

  async write(payload) {
    if (!this.handle) throw new Error('no-handle');
    const p = await this.permission(true, true);
    if (p !== 'granted') throw new Error('permission');
    const w = await this.handle.createWritable();
    await w.write(JSON.stringify(payload, null, 2));
    await w.close();
    return true;
  },
  async read(requestIfNeeded) {
    if (!this.handle) throw new Error('no-handle');
    const p = await this.permission(false, !!requestIfNeeded);
    if (p !== 'granted') throw new Error('permission');
    const file = await this.handle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    const data = JSON.parse(text);
    if (!Array.isArray(data.accounts) || !Array.isArray(data.trades)) throw new Error('invalid');
    return data;
  },

  async disconnect() { this.handle = null; try { await idbDel(FS_KEY); } catch (e) {} },
};

window.FileSync = FileSync;
