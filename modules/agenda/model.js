// modules/agenda/model.js
// Normalization for appointments to prevent:
// - wrong default durations (ricontatto telefonico must be 15')
// - end-time drift
// - day shift due to timezone parsing

import { parseDateTimeAny, toLocalDateTimeKey, minutesSinceMidnight } from '../core/utils.js';

const DEFAULT_DURATION_MIN = 60;
const DEFAULT_TEL_DURATION_MIN = 15;

export function normalizeAppuntamento(raw = {}) {
  const a = { ...raw };

  // Normalize type fields (legacy compatibility)
  const tipo = (a.tipoDettaglio || a.tipo || a.tipologia || '').toString().trim().toLowerCase();
  a.tipoDettaglio = tipo || a.tipoDettaglio || a.tipo || 'generico';

  // Start datetime
  const startStr = a.when || a.dataOra || a.start || a.dataInizio || a.data || '';
  const startDate = parseDateTimeAny(startStr);
  a._startDate = startDate || null;

  // Duration
  let durataMin = Number(a.durataMin ?? a.durata ?? a.durationMin ?? NaN);
  if (!Number.isFinite(durataMin) || durataMin <= 0) {
    durataMin = (a.tipoDettaglio === 'telefonata' || a.tipoDettaglio === 'telefonico')
      ? DEFAULT_TEL_DURATION_MIN
      : DEFAULT_DURATION_MIN;
  }

  // If this is a ricontatto-generated appointment, force 15' unless explicitly provided
  // (This prevents the old 1h default from coming back.)
  if ((a.isRicontatto || a.origine === 'ricontatto') && (!Number.isFinite(Number(raw.durataMin)) || Number(raw.durataMin) <= 0)) {
    durataMin = DEFAULT_TEL_DURATION_MIN;
    a.tipoDettaglio = 'telefonata';
  }

  a.durataMin = durataMin;

  // Compute minutes since midnight for layout
  if (a._startDate) {
    a._dayKey = toLocalDateTimeKey(a._startDate).slice(0, 10); // YYYY-MM-DD
    a._startMin = minutesSinceMidnight(a._startDate);
    a._endMin = a._startMin + durataMin;
  } else {
    a._dayKey = a._dayKey || '';
    a._startMin = Number(a._startMin) || 0;
    a._endMin = Number(a._endMin) || (a._startMin + durataMin);
  }

  return a;
}

export function normalizeAppuntamenti(list = []) {
  return (list || []).map(normalizeAppuntamento);
}

export function groupByDay(appuntamenti = []) {
  const map = new Map();
  (appuntamenti || []).forEach(a => {
    const ev = normalizeAppuntamento(a);
    const key = ev._dayKey || 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  });
  // Sort within each day
  for (const [k, arr] of map.entries()) {
    arr.sort((x, y) => (x._startMin - y._startMin) || (x._endMin - y._endMin));
    map.set(k, arr);
  }
  return map;
}

export function snapTo15(minFromMidnight) {
  const m = Math.max(0, Number(minFromMidnight) || 0);
  return Math.round(m / 15) * 15;
}
