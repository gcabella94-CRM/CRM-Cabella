// modules/core/utils.js
// Utility condivise (date/time, id, sanitizzazione). Pensate per evitare slittamenti di giorno/ora.

export function pad2(n) { return String(n).padStart(2, '0'); }

export function toLocalISODate(d) {
  // d: Date
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function parseLocalDateTime(dateStr, timeStr) {
  // dateStr: 'YYYY-MM-DD', timeStr: 'HH:MM'
  if (!dateStr) return null;
  const t = timeStr || '00:00';
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return isNaN(dt) ? null : dt;
}

export function minutesSinceMidnight(timeStr) {
  // 'HH:MM' -> minutes
  if (!timeStr) return 0;
  const [hh, mm] = String(timeStr).split(':').map(v => parseInt(v, 10));
  const h = Number.isFinite(hh) ? hh : 0;
  const m = Number.isFinite(mm) ? mm : 0;
  return (h * 60) + m;
}

// alias/back-compat (alcuni file potrebbero usare nomi diversi)
export const timeToMinutes = minutesSinceMidnight;

export function minutesToTime(min) {
  const m = Math.max(0, Math.round(min || 0));
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

export function addDays(date, n) {
  const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + (n || 0));
  return d;
}

export function startOfWeek(date, weekStartsOnMonday = true) {
  const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date);
  if (isNaN(d)) return null;
  const day = d.getDay(); // 0=Sun
  const shift = weekStartsOnMonday ? ((day + 6) % 7) : day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - shift);
  return d;
}

export function addMinutesToTime(timeStr, addMin) {
  const base = minutesSinceMidnight(timeStr || '00:00');
  return minutesToTime(base + (addMin || 0));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
