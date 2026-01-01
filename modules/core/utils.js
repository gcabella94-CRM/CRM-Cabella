// modules/core/utils.js
// Utilities condivise (ESM). Export stabili per evitare mismatch tra moduli.

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- DATE HELPERS (anti-slittamento) ----------

// Ritorna YYYY-MM-DD in timezone LOCALE
export function toLocalISODate(dateLike) {
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(dateLike, days) {
  const d = (dateLike instanceof Date) ? new Date(dateLike.getTime()) : new Date(dateLike);
  if (isNaN(d)) return new Date(NaN);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

// Start settimana (LUNEDÌ) in locale
export function startOfWeek(dateLike) {
  const d = (dateLike instanceof Date) ? new Date(dateLike.getTime()) : new Date(dateLike);
  if (isNaN(d)) return new Date(NaN);
  const day = d.getDay(); // 0=Dom ... 6=Sab
  const diff = (day === 0 ? -6 : 1 - day); // porta a Lun
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

// ---------- TIME HELPERS ----------

export function minutesSinceMidnight(timeStr) {
  if (!timeStr) return 0;
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return hh * 60 + mm;
}

export function minutesToTime(mins) {
  const m = Math.max(0, Math.round(Number(mins || 0)));
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

export function addMinutesToTime(timeStr, addMin) {
  const base = minutesSinceMidnight(timeStr);
  const out = base + Number(addMin || 0);
  return minutesToTime(out);
}

// ---------- PARSER "ANY" (serve ai moduli Agenda) ----------
// Accetta:
// - (YYYY-MM-DD, HH:MM)
// - ("YYYY-MM-DD HH:MM")
// - ("DD/MM/YYYY", "HH:MM")
// - ISO ("2025-12-12T10:00:00.000Z") -> convertito in Date
// Ritorna un Date (locale quando fornito come data+ora locale).
export function parseDateTimeAny(dateStr, timeStr = "") {
  const ds = (dateStr == null) ? "" : String(dateStr).trim();
  const tsIn = (timeStr == null) ? "" : String(timeStr).trim();

  if (!ds && !tsIn) return null;

  // Caso: stringa unica "YYYY-MM-DD HH:MM" o "YYYY-MM-DDTHH:MM"
  let dPart = ds;
  let tPart = tsIn;

  if (ds && !tsIn) {
    const m = ds.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
    if (m) {
      dPart = m[1];
      tPart = m[2];
    }
  }

  // ISO pieno -> Date nativo
  if (dPart && /T\d{2}:\d{2}/.test(dPart)) {
    const iso = new Date(dPart);
    return isNaN(iso) ? null : iso;
  }

  // Normalizza data: YYYY-MM-DD oppure DD/MM/YYYY
  let y, mo, da;

  let m1 = dPart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m1) {
    y = parseInt(m1[1], 10);
    mo = parseInt(m1[2], 10);
    da = parseInt(m1[3], 10);
  } else {
    let m2 = dPart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) {
      da = parseInt(m2[1], 10);
      mo = parseInt(m2[2], 10);
      y  = parseInt(m2[3], 10);
    }
  }

  if (!(y && mo && da)) {
    // fallback ultimo: prova Date nativo
    const fallback = new Date(ds);
    return isNaN(fallback) ? null : fallback;
  }

  // Ora
  let hh = 0, mm = 0;
  if (tPart) {
    const tm = tPart.match(/^(\d{1,2}):(\d{2})/);
    if (tm) {
      hh = Math.max(0, Math.min(23, parseInt(tm[1], 10)));
      mm = Math.max(0, Math.min(59, parseInt(tm[2], 10)));
    }
  }

  const out = new Date(y, mo - 1, da, hh, mm, 0, 0); // locale (anti-slittamento)
  return isNaN(out) ? null : out;
}

// ---------- FORMATTERS ----------
export function formatDateTimeIT(dateLike) {
  if (!dateLike) return "";
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (isNaN(d)) return "";
  const date = d.toLocaleDateString("it-IT");
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}
// Chiave stabile in locale: "YYYY-MM-DD_HH:MM"
// Utile per deduplicare alert collisioni / raggruppamenti.
export function toLocalDateTimeKey(dateLike) {
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${da}_${hh}:${mm}`;
}
