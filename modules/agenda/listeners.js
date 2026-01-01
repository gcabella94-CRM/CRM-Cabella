// modules/agenda/listeners.js
// Agenda interaction helpers + collision alert logic (non-blocking).
// This file intentionally does NOT assume a specific DOM structure.
// The legacy app can call these functions when creating/updating an appointment.

import { getOverlapsForEvent, hasSameResponsabileOverlap } from './overlap.js';

// Returns collisions (same responsabileId) for a given event within a day list
export function detectCollisionForEvent(ev, dayApps) {
  const overlaps = getOverlapsForEvent(ev, dayApps);
  const sameResp = hasSameResponsabileOverlap(ev, overlaps);
  return { overlaps, sameResp };
}

// A small helper to avoid repeated alerts for the same collision.
// Call with a Map() stored in module scope or app scope.
export function shouldAlertCollision(ev, dayApps, seenMap) {
  if (!seenMap) return true;
  const { overlaps, sameResp } = detectCollisionForEvent(ev, dayApps);
  if (!sameResp) return false;

  // Build a stable key: evId + sorted overlap ids with same resp
  const evId = ev?.id || ev?._id || '';
  const overlapIds = (overlaps || [])
    .filter(o => o?.responsabileId && o.responsabileId === ev.responsabileId)
    .map(o => o.id || o._id || '')
    .filter(Boolean)
    .sort()
    .join(',');

  const key = `${evId}::${ev.responsabileId}::${overlapIds}`;
  if (seenMap.has(key)) return false;
  seenMap.set(key, Date.now());
  return true;
}

// Default non-blocking UI: simple alert. You can replace with modal later.
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

  try { window.alert(msg); } catch (_) { /* noop */ }
}
