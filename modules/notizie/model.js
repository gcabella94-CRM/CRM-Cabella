// modules/notizie/model.js
// Thin data-access layer for Notizie. For now it bridges to legacy globals/storage,
// so we can refactor safely without breaking the rest of the CRM.

function getStorageKey() {
  try {
    if (window.STORAGE_KEYS && window.STORAGE_KEYS.notizie) return window.STORAGE_KEYS.notizie;
  } catch {}
  return 'notizie';
}

export function getNotizie() {
  try {
    if (window.__LEGACY_API__?.notizie?.getList) return window.__LEGACY_API__.notizie.getList();
  } catch {}
  try {
    return Array.isArray(window.notizie) ? window.notizie : [];
  } catch {}
  // fallback storage
  try {
    const raw = localStorage.getItem(getStorageKey());
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setNotizie(arr) {
  const list = Array.isArray(arr) ? arr : [];
  try {
    if (window.__LEGACY_API__?.notizie?.setList) {
      window.__LEGACY_API__.notizie.setList(list);
      return;
    }
  } catch {}
  try { window.notizie = list; } catch {}
  try {
    if (typeof window.saveList === 'function') window.saveList(getStorageKey(), list);
    else localStorage.setItem(getStorageKey(), JSON.stringify(list));
  } catch {}
}

export function findNotiziaById(id) {
  if (!id) return null;
  return getNotizie().find(n => n && n.id === id) || null;
}

export function upsertNotizia(n) {
  if (!n || !n.id) return;
  const list = getNotizie().slice();
  const ix = list.findIndex(x => x && x.id === n.id);
  if (ix >= 0) list[ix] = n;
  else list.push(n);
  setNotizie(list);
}

export function deleteNotizia(id) {
  if (!id) return;
  const list = getNotizie().filter(x => x && x.id !== id);
  setNotizie(list);
}
