// modules/core/utils.js
// Small shared utilities. Keep this file dependency-free.

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function deepClone(obj) {
  try { return structuredClone(obj); } catch (_) { return JSON.parse(JSON.stringify(obj)); }
}

export function mergeDeep(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];

    if (Array.isArray(sv)) {
      target[key] = sv.slice();
    } else if (sv && typeof sv === 'object') {
      target[key] = mergeDeep(tv && typeof tv === 'object' && !Array.isArray(tv) ? tv : {}, sv);
    } else {
      target[key] = sv;
    }
  }
  return target;
}

// --- Date/Time helpers (critical: avoid day-shifts on ricontatti) ---

// Parses:
// - ISO with timezone ("2026-01-01T10:00:00.000Z" or "+01:00") -> Date via native
// - Local "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm" -> Date in local time via manual parse
export function parseDateTimeAny(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;

  // ISO with Z / offset: let native parse (safe, explicit tz)
  if (/[zZ]$/.test(s) || /[\+\-]\d\d:\d\d$/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // Local formats: manual parse to avoid spec differences / UTC assumptions
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const da = Number(m[3]);
    const hh = Number(m[4] || '0');
    const mm = Number(m[5] || '0');
    const d = new Date(y, mo, da, hh, mm, 0, 0); // local
    return isNaN(d) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Output "YYYY-MM-DDTHH:mm" in local time (no timezone)
// Use this for app state to avoid shifts.
export function toLocalDateTimeKey(date) {
  const d = date instanceof Date ? date : parseDateTimeAny(date);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${da}T${hh}:${mm}`;
}

export function minutesSinceMidnight(date) {
  const d = date instanceof Date ? date : parseDateTimeAny(date);
  if (!d) return 0;
  return d.getHours() * 60 + d.getMinutes();
}
