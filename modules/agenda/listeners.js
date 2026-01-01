// modules/agenda/listeners.js
// Helpers collisioni (non bloccanti). Nessun listener globale: solo funzioni richiamabili dal legacy.

import { getOverlapsForEvent, hasSameResponsabileOverlap } from './overlap.js';

export function detectCollisionForEvent(ev, dayApps) {
  const overlaps = getOverlapsForEvent(ev, dayApps);
  const sameResp = hasSameResponsabileOverlap(ev, overlaps);
  return { overlaps, sameResp };
}

export function shouldAlertCollision(ev, dayApps, seenMap) {
  if (!seenMap) return true;
  const { overlaps, sameResp } = detectCollisionForEvent(ev, dayApps);
  if (!sameResp) return false;

  const evId = ev?.id || ev?._id || '';
  const overlapIds = (overlaps || [])
    .filter(o => o?.responsabileId === ev?.responsabileId)
    .map(o => o.id || o._id || '')
    .filter(Boolean)
    .sort()
    .join(',');

  const key = `${evId}::${ev?.responsabileId || ''}::${overlapIds}`;
  if (seenMap.has(key)) return false;
  seenMap.set(key, Date.now());
  return true;
}

export function alertCollision(ev, overlapsSameResp = []) {
  const resp = ev?.responsabileNome || ev?.responsabile || ev?.responsabileId || 'stesso responsabile';
  const when = ev?.when || ev?.dataOra || '';
  const n = overlapsSameResp.length;

  const msg = [
    '⚠️ Collisione agenda rilevata',
    `Responsabile: ${resp}`,
    when ? `Quando: ${when}` : '',
    `Sovrapposizioni: ${n}`,
    'Nota: non è bloccante, ma verifica la pianificazione.'
  ].filter(Boolean).join('\n');

  try { window.alert(msg); } catch (_) {}
}
