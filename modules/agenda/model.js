// modules/agenda/model.js
// Normalizzazione eventi Agenda senza dipendenze esterne (evita import rotti).

const DEFAULT_DURATION_MIN = 60;
const DEFAULT_TEL_DURATION_MIN = 15;

function parseDateTimeAny(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;

  // supporta ISO, "YYYY-MM-DDTHH:mm", "YYYY-MM-DD HH:mm", "DD/MM/YYYY HH:mm"
  const s = String(v).trim();

  // ISO o simili
  const d1 = new Date(s);
  if (!isNaN(d1)) return d1;

  // DD/MM/YYYY HH:mm
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const yyyy = parseInt(m[3], 10);
    const hh = parseInt(m[4] || '0', 10);
    const mi = parseInt(m[5] || '0', 10);
    const d = new Date(yyyy, mm, dd, hh, mi, 0, 0);
    return isNaN(d) ? null : d;
  }

  return null;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function toLocalDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function minutesSinceMidnight(d) {
  return d.getHours() * 60 + d.getMinutes();
}

export function normalizeAppuntamento(raw = {}) {
  const a = { ...raw };

  const tipo = (a.tipoDettaglio || a.tipo || a.tipologia || '').toString().trim().toLowerCase();
  a.tipoDettaglio = tipo || a.tipoDettaglio || a.tipo || 'generico';

  const startStr = a.when || a.dataOra || a.start || a.dataInizio || a.data || '';
  const startDate = parseDateTimeAny(startStr);
  a._startDate = startDate || null;

  let durataMin = Number(a.durataMin ?? a.durata ?? a.durationMin ?? NaN);
  if (!Number.isFinite(durataMin) || durataMin <= 0) {
    durataMin = (a.tipoDettaglio === 'telefonata' || a.tipoDettaglio === 'telefonico')
      ? DEFAULT_TEL_DURATION_MIN
      : DEFAULT_DURATION_MIN;
  }

  if ((a.isRicontatto || a.origine === 'ricontatto') && (!Number.isFinite(Number(raw.durataMin)) || Number(raw.durataMin) <= 0)) {
    durataMin = DEFAULT_TEL_DURATION_MIN;
    a.tipoDettaglio = 'telefonata';
  }

  a.durataMin = durataMin;

  if (a._startDate) {
    a._dayKey = toLocalDateKey(a._startDate);
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
