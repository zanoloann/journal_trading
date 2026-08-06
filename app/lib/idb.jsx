// idb.jsx — local-first storage layer (IndexedDB), additive: localStorage (tj_*_v5) stays the
// source of truth for the current session and is never removed; IndexedDB mirrors it and, once
// seeded, becomes the preferred read on next load (survives bigger datasets, future GitHub sync
// will read from here). No existing key is renamed or dropped — see CLAUDE.md.
const IDB_NAME = 'tj_idb_v1', IDB_STORE = 'kv';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}
async function idbSet(key, val) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { return false; }
}
Object.assign(window, { idbGet, idbSet });
