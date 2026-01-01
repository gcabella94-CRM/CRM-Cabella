// modules/notizie/index.js
// Orchestrazione Notizie (bridge temporaneo): delega il rendering/CRUD al legacy,
// ma sposta QUI i listener UI, così possiamo svuotare il legacy a step.

function getLegacyNotizieAPI() {
  return (window.__LEGACY_API__ && window.__LEGACY_API__.notizie) ? window.__LEGACY_API__.notizie : null;
}

function bindOnce(el, key, ev, fn) {
  if (!el) return;
  const k = `__bound_${key}_${ev}`;
  if (el[k]) return;
  el.addEventListener(ev, fn);
  el[k] = true;
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function initNotizie() {
  const api = getLegacyNotizieAPI();
  if (!api) {
    console.warn('[NOTIZIE] Legacy API non disponibile: salto initNotizie');
    return;
  }

  // 1) Bind modale/azioni card (open/edit/delete/noans ecc.) -> resta nel legacy per ora
  try { api.bindNotizieModalUI(); } catch (e) { console.warn('[NOTIZIE] bindNotizieModalUI error', e); }

  // 2) Bottone "Nuova notizia"
  const btnNew = document.getElementById('not-new-btn');
  bindOnce(btnNew, 'not-new-btn', 'click', () => {
    try { api.openNotiziaModal(null); } catch (e) { console.warn('[NOTIZIE] openNotiziaModal error', e); }
  });

  // 3) Filtri (render reattivo)
  const fResp   = document.getElementById('not-filter-resp');
  const fLabel  = document.getElementById('not-filter-label');
  const fSort   = document.getElementById('not-filter-sort');
  const fSearch = document.getElementById('not-filter-search');

  const doRender = () => { try { api.renderNotizie(); } catch (e) { console.warn('[NOTIZIE] renderNotizie error', e); } };

  bindOnce(fResp,   'not-filter-resp',   'change', doRender);
  bindOnce(fLabel,  'not-filter-label',  'change', doRender);
  bindOnce(fSort,   'not-filter-sort',   'change', doRender);
  bindOnce(fSearch, 'not-filter-search', 'input', debounce(doRender, 180));

  // 4) Primo render (se siamo già in view notizie o se il legacy lo chiama comunque, è idempotente)
  doRender();
}
