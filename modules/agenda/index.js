// modules/agenda/index.js
// Facade "isola Agenda": centralizza binding bottoni + collision alert.
// Per ora delega il rendering al legacy tramite window.AgendaLegacy (bridge).

import { startOfWeek, addDays } from '../core/utils.js';
import { getOverlaps, hasSameResponsabileOverlap } from './overlap.js';

const SEEN = new Set(); // anti-spam alert

function readLegacyState(){
  // Bridge: legacy espone window.CRMState() -> { attivita, staff }
  if (typeof window.CRMState === 'function') {
    try { return window.CRMState() || {}; } catch {}
  }
  return {};
}

function detectAndAlertCollisionsWeek(anchor){
  const { attivita } = readLegacyState();
  const start = startOfWeek(anchor);
  const weekDays = Array.from({length:7}, (_,i)=> addDays(start, i));
  const isoDays = weekDays.map(d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);

  const apps = (attivita||[]).filter(a => a && a.tipo==='appuntamento' && isoDays.includes(a.data));
  const byDay = {};
  apps.forEach(a => { (byDay[a.data] ||= []).push(a); });

  Object.keys(byDay).forEach(iso=>{
    const dayApps = byDay[iso] || [];
    // normalizza minuti
    dayApps.forEach(a=>{
      const s = (a.ora||'00:00').split(':'); const e=(a.oraFine||'').split(':');
      const sm = (parseInt(s[0]||'0',10)*60)+(parseInt(s[1]||'0',10));
      let em = sm + (Number(a.durataMin)||15);
      if (a.oraFine) {
        const eh = parseInt(e[0]||'0',10), emn=parseInt(e[1]||'0',10);
        if(!isNaN(eh)&&!isNaN(emn)) em = eh*60+emn;
      }
      a._startMin = sm; a._endMin = Math.max(sm+1, em);
    });

    // per ogni evento, se ha overlap con stesso responsabile -> alert una volta
    dayApps.forEach(a=>{
      const overlaps = getOverlaps(a, dayApps);
      if (overlaps.length && hasSameResponsabileOverlap(a, overlaps)) {
        const key = `${iso}|${a.responsabileId}|${a._startMin}-${a._endMin}`;
        if (SEEN.has(key)) return;
        SEEN.add(key);
        // non bloccante, ma visibile
        setTimeout(()=> alert('⚠️ Collisione: ci sono due appuntamenti in contemporanea per lo stesso responsabile.'), 0);
      }
    });
  });
}

function bindAgendaNav(){
  const prev = document.getElementById('agenda-prev-week');
  const next = document.getElementById('agenda-next-week');
  const today = document.getElementById('agenda-today-week');
  const typeF = document.getElementById('agenda-type-filter');
  const staffF = document.getElementById('agenda-staff-filter');
  const newBtn = document.getElementById('agenda-new-appointment');

  const L = window.AgendaLegacy;
  if (!L) return;

  prev?.addEventListener('click', ()=>{ L.setWeekAnchor(addDays(L.getWeekAnchor(), -7)); L.renderWeek(); detectAndAlertCollisionsWeek(L.getWeekAnchor()); });
  next?.addEventListener('click', ()=>{ L.setWeekAnchor(addDays(L.getWeekAnchor(),  7)); L.renderWeek(); detectAndAlertCollisionsWeek(L.getWeekAnchor()); });
  today?.addEventListener('click',()=>{ L.setWeekAnchor(startOfWeek(new Date())); L.renderWeek(); detectAndAlertCollisionsWeek(L.getWeekAnchor()); });

  typeF?.addEventListener('change', ()=>{ L.renderWeek(); detectAndAlertCollisionsWeek(L.getWeekAnchor()); });
  staffF?.addEventListener('change',()=>{ L.renderWeek(); detectAndAlertCollisionsWeek(L.getWeekAnchor()); });

  newBtn?.addEventListener('click', ()=>{ if (typeof L.newAppointment === 'function') L.newAppointment(); });
}

export function initAgenda(){
  // marca gestione agenda per permettere al legacy di non fare doppio binding
  window.AgendaManaged = true;
  // se legacy non ha bridge ancora, riprovo dopo un tick
  if (!window.AgendaLegacy) {
    setTimeout(initAgenda, 0);
    return;
  }
  bindAgendaNav();
}
