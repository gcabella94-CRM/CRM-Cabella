// modules/core/utils.js
// Utility condivise (date/time) pensate per evitare slittamenti di giorno e bug durata.

export function pad2(n){ return String(n).padStart(2,'0'); }

export function toLocalISODate(d){
  // YYYY-MM-DD in timezone locale (senza usare toISOString che può slittare di giorno)
  if(!d) return '';
  const dd = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dd)) return '';
  return `${dd.getFullYear()}-${pad2(dd.getMonth()+1)}-${pad2(dd.getDate())}`;
}

export function parseISODate(iso){
  // iso 'YYYY-MM-DD' -> Date in locale (mezzogiorno per sicurezza anti DST)
  if(!iso || typeof iso!=='string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  const y = Number(m[1]), mo = Number(m[2])-1, da = Number(m[3]);
  const d = new Date(y, mo, da, 12, 0, 0, 0);
  return isNaN(d) ? null : d;
}

export function addDays(date, days){
  const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date);
  if(isNaN(d)) return new Date();
  d.setDate(d.getDate() + Number(days||0));
  return d;
}

export function startOfWeek(date, weekStartsOnMonday=true){
  const d = (date instanceof Date) ? new Date(date.getTime()) : new Date(date);
  if(isNaN(d)) return new Date();
  const day = d.getDay(); // 0=Sun
  const startIdx = weekStartsOnMonday ? 1 : 0;
  const diff = (day - startIdx + 7) % 7;
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() - diff);
  return d;
}

export function addMinutesToTime(timeStr, minutes){
  // "HH:MM" + minutes -> "HH:MM" (gestisce overflow giorno)
  if(!timeStr || typeof timeStr!=='string') return timeStr || '';
  const parts = timeStr.split(':');
  if(parts.length < 2) return timeStr;
  const h = parseInt(parts[0],10);
  const m = parseInt(parts[1],10);
  if (isNaN(h)||isNaN(m)) return timeStr;
  const d = new Date(2000,0,1,h,m,0,0);
  d.setMinutes(d.getMinutes() + (Number(minutes)||0));
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function minutesFromTime(timeStr){
  if(!timeStr || typeof timeStr!=='string') return 0;
  const parts = timeStr.split(':');
  if(parts.length<2) return 0;
  const h = parseInt(parts[0],10);
  const m = parseInt(parts[1],10);
  if(isNaN(h)||isNaN(m)) return 0;
  return h*60+m;
}

export function timeFromMinutes(min){
  const m = Math.max(0, Number(min)||0);
  const hh = Math.floor(m/60)%24;
  const mm = m%60;
  return `${pad2(hh)}:${pad2(mm)}`;
}
