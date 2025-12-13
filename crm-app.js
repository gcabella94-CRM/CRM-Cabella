/* ====== STORAGE & UTILITY ====== */

  const STORAGE_KEYS = {
    immobili: 'crm10_immobili',
    notizie: 'crm10_notizie',
    attivita: 'crm10_attivita',
    staff: 'crm10_staff',
    omi: 'crm10_omi',
    contatti: 'crm10_contatti',      // rubrica contatti proprietari
    intestazioni: 'crm10_intestazioni' // archivio header+footer per documenti IA
  };

  let immobili = [];
  let notizie = [];
  let attivita = [];
  let staff = [];
  let omi = [];
  let contatti = [];      // rubrica contatti proprietari
  let intestazioni = [];
  let lastCreatedAppId = null;
  // modelli di intestazione (header+footer)

  function loadList(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveList(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value || []));
    } catch {}
    try {
      if (typeof cloudSync !== 'undefined') {
        cloudSync.save(key, value);
      }
    } catch (e) {
      console.warn('[SYNC] Errore saveList cloudSync', key, e);
    }
  }

  function genId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatEuro(val) {
    if (!val && val !== 0) return '';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);
  }

  function parseISODate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }

  function formatDateIT(str) {
    const d = parseISODate(str);
    if (!d) return '';
    return d.toLocaleDateString('it-IT');
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // lunedì=0
    d.setDate(d.getDate() - day);
    d.setHours(0,0,0,0);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

    /* ====== VIEW SWITCH ====== */

    let currentView = 'home';

    function setView(viewId) {
      currentView = viewId;
      document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === 'view-' + viewId);
      });
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewId);
      });

      // mostra/nasconde il submenu Rubrica
      const subMenu = document.getElementById('rubrica-submenu');
      if (subMenu) {
        subMenu.style.display = (viewId === 'rubrica') ? 'block' : 'none';
      }

      const titleEl = document.getElementById('topbar-title');
      const subEl = document.getElementById('topbar-sub');
      const map = {
        home: ['Dashboard', 'Riepilogo settimanale e attività.'],
        agenda: ['Agenda', 'Vista settimanale + mese.'],
        ai: ['Assistente IA', 'Generazione testi e documenti.'],
        immobili: ['Immobili', 'Schede immobili base.'],
        notizie: ['Notizie', 'Fonti potenziali.'],
        rubrica: ['Rubrica', 'Contatti proprietari e collegamenti.'],
        attivita: ['Attività', 'Task e appuntamenti.'],
        operazioni: ['Operazioni concluse', 'Operazioni da immobili venduti/affittati.'],
        staff: ['Staff', 'Colori agenda e carichi.'],
        omi: ['Valori OMI', 'Range €/mq per zona.'],
        mappa: ['Mappa', 'Immobili e notizie sulla mappa.']
      };

      const entry = map[viewId] || ['CRM', ''];
      if (titleEl) titleEl.textContent = entry[0];
      if (subEl) subEl.textContent = entry[1];

      if (viewId === 'home') renderDashboard();
      if (viewId === 'agenda') { renderAgendaWeek(); renderAgendaMonth(); }
      if (viewId === 'immobili') renderImmobili();
      if (viewId === 'notizie') renderNotizie();
      if (viewId === 'rubrica') renderRubrica();
      if (viewId === 'attivita') renderAttivita();
      if (viewId === 'operazioni') renderOperazioni();
      if (viewId === 'staff') renderStaffTable();
      if (viewId === 'omi') renderOmi();
      if (viewId === 'mappa') initMappa();
    }

    document.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item[data-view]');
      if (!item) return;
      setView(item.dataset.view);
    });

    /* ====== GLOBAL SEARCH (molto semplice) ====== */

    const globalSearchInput = document.getElementById('global-search');
    const globalSearchClear = document.getElementById('btn-clear-search');

    if (globalSearchClear) {
      globalSearchClear.addEventListener('click', () => {
        if (globalSearchInput) globalSearchInput.value = '';
        renderDashboard();
        if (currentView === 'operazioni') renderOperazioni();
      });
    }

    /* ====== DASHBOARD ====== */

    let dashboardWeekAnchor = startOfWeek(new Date());

    function getAppointmentsInWeek(anchor) {
      const start = startOfWeek(anchor);
      const end = addDays(start, 7);
      return (attivita || []).filter(a => {
        if (!a || !a.data) return false;
        const d = parseISODate(a.data);
        if (!d) return false;
        return d >= start && d < end && a.tipo === 'appuntamento';
      });
    }

    function renderDashboardWeekRow() {
      const container = document.getElementById('dashboard-week-row');
      if (!container) return;
      container.innerHTML = '';

      const weekStart = dashboardWeekAnchor;
      const apps = getAppointmentsInWeek(weekStart);
      const staffMap = {};
      (staff || []).forEach(s => {
        staffMap[s.id] = s;
      });

      const dayNames = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

      const wrapper = document.createElement('div');
      wrapper.className = 'grid-responsive';

      for (let i=0; i<7; i++) {
        const dayDate = addDays(weekStart, i);
        const iso = dayDate.toISOString().slice(0,10);
        const col = document.createElement('div');
        col.className = 'metric';
        col.style.minHeight = '90px';

        const label = document.createElement('div');
        label.className = 'metric-label';
        label.textContent = `${dayNames[i]} ${dayDate.toLocaleDateString('it-IT')}`;
        const list = document.createElement('div');
        list.style.marginTop = '4px';
        list.style.fontSize = '11px';
        const dayApps = apps.filter(a => a.data === iso);

        if (!dayApps.length) {
          list.innerHTML = '<span class="muted">Nessun appuntamento.</span>';
        } else {
          dayApps.forEach(a => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-ghost btn-sm';
            btn.style.justifyContent = 'space-between';
            btn.style.width = '100%';
            btn.style.marginBottom = '2px';

            const ora = a.ora || '';
            const staffObj = a.responsabileId ? staffMap[a.responsabileId] : null;
            const colorDot = staffObj ? `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${staffObj.colore || '#22c55e'};"></span>` : '';
            btn.innerHTML = `
              <span style="display:flex;align-items:center;gap:4px;">
                ${colorDot}
                <span>${ora || '—'} · ${a.tipoDettaglio || a.tipo || 'Appuntamento'}</span>
              </span>
              <span style="font-size:10px;opacity:0.7;">Apri scheda appuntamento ›</span>
            `;
            btn.addEventListener('click', () => {
              openAppuntamentoDialogById(a.id);
            });
            list.appendChild(btn);
          });
        }

        col.appendChild(label);
        col.appendChild(list);
        wrapper.appendChild(col);
      }

      container.appendChild(wrapper);
    }

    function renderDashboardImmobili() {
      const container = document.getElementById('dashboard-immobili-summary');
      if (!container) return;
      container.innerHTML = '';

      const list = immobili || [];
      const counters = {
        tot: list.length,
        vendita: list.filter(i => i.tipologia === 'vendita').length,
        affitto: list.filter(i => i.tipologia === 'affitto').length,
        trattativa: list.filter(i => i.stato === 'trattativa').length,
        conclusi: list.filter(i => i.stato === 'venduto' || i.stato === 'affittato').length
      };

      const items = [
        ['Totali in portafoglio', counters.tot, 'totali'],
        ['In vendita', counters.vendita, 'vendita'],
        ['In affitto', counters.affitto, 'affitto'],
        ['In trattativa', counters.trattativa, 'trattativa'],
        ['Concluse', counters.conclusi, 'conclusi']
      ];

      items.forEach(([label, value, key]) => {
        const card = document.createElement('div');
        card.className = 'metric';
        const lab = document.createElement('div');
        lab.className = 'metric-label';
        lab.textContent = label;
        const val = document.createElement('div');
        val.className = 'metric-value';
        val.textContent = value;
        const extra = document.createElement('div');
        extra.className = 'metric-extra';
        extra.textContent = key === 'conclusi' ? 'Da questi si ricavano le operazioni concluse.' : '';
        card.appendChild(lab);
        card.appendChild(val);
        card.appendChild(extra);
        container.appendChild(card);
      });
    }

    function renderDashboardTodayActivities() {
      const container = document.getElementById('dashboard-today-activities');
      if (!container) return;
      container.innerHTML = '';

      const filter = document.getElementById('dash-activity-filter')?.value || 'tutte';
      const today = new Date();
      const todayIso = today.toISOString().slice(0,10);
      let list = (attivita || []).filter(a => a && a.data === todayIso);

      if (filter === 'aperte') {
        list = list.filter(a => a.stato !== 'chiusa');
      } else if (filter === 'chiuse') {
        list = list.filter(a => a.stato === 'chiusa');
      }

      if (!list.length) {
        const div = document.createElement('div');
        div.className = 'muted';
        div.textContent = 'Nessuna attività registrata per oggi.';
        container.appendChild(div);
        return;
      }

      const ul = document.createElement('div');
      list.forEach(a => {
        const row = document.createElement('button');
        row.className = 'btn btn-ghost btn-sm';
        row.style.width = '100%';
        row.style.justifyContent = 'space-between';
        row.style.marginBottom = '2px';
        const left = `${a.ora || '—'} · ${a.tipoDettaglio || a.tipo || 'Attività'}`;
        const right = a.stato === 'chiusa' ? 'Chiusa' : 'Aperta';
        row.innerHTML = `<span>${left}</span><span style="font-size:10px;opacity:0.7;">${right}</span>`;
        row.addEventListener('click', () => setView('attivita'));
        ul.appendChild(row);
      });
      container.appendChild(ul);
    }

    function renderDashboardDaySummary() {
      const container = document.getElementById('dashboard-day-summary');
      if (!container) return;
      container.innerHTML = '';

      const today = new Date();
      const todayIso = today.toISOString().slice(0,10);
      const todayApps = (attivita || []).filter(a => a && a.data === todayIso && a.tipo === 'appuntamento');

      const card = document.createElement('div');
      card.className = 'metric';
      card.style.minHeight = '110px';

      const label = document.createElement('div');
      label.className = 'metric-label';
      label.textContent = `Oggi · ${today.toLocaleDateString('it-IT')}`;

      const main = document.createElement('div');
      main.className = 'metric-value';
      main.textContent = `${todayApps.length} appuntamenti`;

      const extra = document.createElement('div');
      extra.className = 'metric-extra';
      extra.textContent = 'Clicca per andare in agenda.';

      card.appendChild(label);
      card.appendChild(main);
      card.appendChild(extra);

      card.addEventListener('click', () => setView('agenda'));

      container.appendChild(card);
    }

    function renderDashboard() {
      renderDashboardWeekRow();
      renderDashboardImmobili();
      renderDashboardTodayActivities();
      renderDashboardDaySummary();
      renderDashboardProvvigioni();
    }

    // week nav
    document.getElementById('dash-prev-week')?.addEventListener('click', () => {
      dashboardWeekAnchor = addDays(dashboardWeekAnchor, -7);
      renderDashboardWeekRow();
    });
    document.getElementById('dash-next-week')?.addEventListener('click', () => {
      dashboardWeekAnchor = addDays(dashboardWeekAnchor, 7);
      renderDashboardWeekRow();
    });
    document.getElementById('dash-today-week')?.addEventListener('click', () => {
      dashboardWeekAnchor = startOfWeek(new Date());
      renderDashboardWeekRow();
    });
    document.getElementById('dash-activity-filter')?.addEventListener('change', renderDashboardTodayActivities);

    /* ====== AGENDA ====== */

    let agendaWeekAnchor = startOfWeek(new Date());
    let agendaDrag = {
      isDragging: false,
      start: null, // { date, minutes }
      end: null    // { date, minutes }
    };

    
    function renderAgendaWeek() {
      const labelEl = document.getElementById('agenda-week-label');
      const grid = document.getElementById('agenda-week-grid');
      if (!grid) return;

      const weekStart = agendaWeekAnchor;
      const weekEnd = addDays(weekStart, 6);
      if (labelEl) {
        labelEl.textContent = `Settimana ${weekStart.toLocaleDateString('it-IT')} – ${weekEnd.toLocaleDateString('it-IT')}`;
      }

      grid.innerHTML = '';

      const giorni = [];
      for (let i = 0; i < 7; i++) {
        giorni.push(addDays(weekStart, i));
      }

      const typeFilter = document.getElementById('agenda-type-filter')?.value || 'tutti';
      const staffFilter = document.getElementById('agenda-staff-filter')?.value || 'tutti';

      const minStart = 8 * 60;   // 08:00
      const minEnd   = 20 * 60;  // 20:00
      const slotSize = 15;       // 15 minuti

      const slotMap = {}; // key: date|minutes -> cell

      // Angolo in alto a sinistra
      const corner = document.createElement('div');
      corner.className = 'agenda-hour-cell';
      grid.appendChild(corner);

      // Header giorni
      const dayNames = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
      giorni.forEach((d, idx) => {
        const h = document.createElement('div');
        h.className = 'agenda-hour-cell';
        h.style.textAlign = 'center';
        const lab = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        h.textContent = `${dayNames[idx]} ${lab}`;
        grid.appendChild(h);
      });

      // Corpo: righe da 15 minuti
      for (let minutes = minStart; minutes < minEnd; minutes += slotSize) {
        const hour = Math.floor(minutes / 60);
        const mins = minutes % 60;

        // colonna orari
        const hourCell = document.createElement('div');
        hourCell.className = 'agenda-hour-cell';
        hourCell.textContent = mins === 0 ? `${String(hour).padStart(2,'0')}:00` : '';
        grid.appendChild(hourCell);

        // celle per ciascun giorno
        giorni.forEach(d => {
          const iso = d.toISOString().slice(0,10);
          const cell = document.createElement('div');
          cell.className = 'agenda-slot';
          cell.dataset.date = iso;
          cell.dataset.minutes = String(minutes);

          // drag a 15 minuti
          cell.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            // se clicco su un blocco appuntamento esistente, non avvio drag
            if (e.target && e.target.closest && (e.target.closest('.agenda-slot-app-start') || e.target.closest('.agenda-slot-app-mid') || e.target.closest('.agenda-slot-app-end'))) {
              return;
            }
            e.preventDefault();
            agendaDrag.isDragging = true;
            agendaDrag.start = { date: iso, minutes };
            agendaDrag.end = { date: iso, minutes };
            updateAgendaDragHighlight();
          });

          cell.addEventListener('mouseenter', () => {
            if (!agendaDrag.isDragging || !agendaDrag.start) return;
            if (agendaDrag.start.date !== iso) return; // drag vincolato alla stessa colonna giorno
            agendaDrag.end = { date: iso, minutes };
            updateAgendaDragHighlight();
          });

          cell.addEventListener('mouseup', () => {
            if (!agendaDrag.isDragging || !agendaDrag.start || !agendaDrag.end) return;
            agendaDrag.isDragging = false;

            const { start, end } = agendaDrag;
            if (start.date === end.date) {
              const mStart = Math.min(start.minutes, end.minutes);
              const mEnd   = Math.max(start.minutes, end.minutes) + slotSize; // includo l'ultimo slot
              openAgendaRangeDialog(start.date, mStart, mEnd);
            }

            agendaDrag.start = null;
            agendaDrag.end = null;
            updateAgendaDragHighlight();
          });

          const key = `${iso}|${minutes}`;
          slotMap[key] = cell;
          grid.appendChild(cell);
        });
      }

      // render appuntamenti
      const settimanaIso = giorni.map(d => d.toISOString().slice(0,10));
      const apps = (attivita || []).filter(a => {
        if (!a || a.tipo !== 'appuntamento') return false;
        if (!settimanaIso.includes(a.data)) return false;
        if (typeFilter !== 'tutti' && a.tipoDettaglio !== typeFilter) return false;
        if (staffFilter !== 'tutti' && a.responsabileId !== staffFilter) return false;
        return true;
      });

      
      const appsByDay = {};
      apps.forEach(a => {
        if (!a || !a.data) return;
        if (!appsByDay[a.data]) appsByDay[a.data] = [];
        appsByDay[a.data].push(a);
      });

      Object.keys(appsByDay).forEach(iso => {
        const dayApps = appsByDay[iso];

        // calcolo start/end in minuti e colonne per gestione contemporaneità
        const colEnd = [];
        let maxCols = 0;

        dayApps.forEach(a => {
          const startParts = (a.ora || '09:00').split(':');
          const endParts   = (a.oraFine || a.ora || '10:00').split(':');

          let startMin = parseInt(startParts[0],10) * 60 + parseInt(startParts[1] || '0',10);
          let endMin   = parseInt(endParts[0],10) * 60 + parseInt(endParts[1] || '0',10);

          // snap a 15'
          startMin = Math.max(minStart, Math.floor(startMin / slotSize) * slotSize);
          endMin   = Math.min(minEnd, Math.ceil(endMin / slotSize) * slotSize);
          if (endMin <= startMin) endMin = startMin + slotSize;

          a._startMin = startMin;
          a._endMin = endMin;
        });

        // ordina per inizio
        dayApps.sort((a,b) => a._startMin - b._startMin || a._endMin - b._endMin);

        dayApps.forEach(a => {
          let col = 0;
          while (col < colEnd.length && a._startMin < colEnd[col]) {
            col++;
          }
          colEnd[col] = a._endMin;
          a._colIndex = col;
          if (col + 1 > maxCols) maxCols = col + 1;
        });

        // mappa staff per recuperare velocemente il nome del responsabile
        const staffMap = {};
        (staff || []).forEach(s => {
          if (!s || !s.id) return;
          staffMap[s.id] = s;
        });

        dayApps.forEach(a => {
          const baseKey = `${iso}|`;
          const startMin = a._startMin;
          const endMin = a._endMin;
          const totalSlots = (endMin - startMin) / slotSize;

          // handler click unico
          const handleClick = (e) => {
            e.stopPropagation();
            if (typeof openAppuntamentoDialogById === 'function') {
              openAppuntamentoDialogById(a.id);
            }
          };

          // trova la prima cella e l'altezza di uno slot
          const firstCell = slotMap[baseKey + String(startMin)];
          if (!firstCell) return;
          const slotPx = firstCell.offsetHeight || 18;

          // marca le celle come parte di un appuntamento (solo per logica/drag)
          for (let m = startMin; m < endMin; m += slotSize) {
            const cell = slotMap[baseKey + String(m)];
            if (!cell) continue;
            cell.classList.add('agenda-slot-app');
          }

          // costruisci il blocco visuale nella prima cella
          const cell = firstCell;
          cell.classList.add('agenda-slot-app-start');

          const rangeLabel = `${a.ora || ''}${a.oraFine ? '–' + a.oraFine : ''}`.trim();
          const tipologia = (a.tipoDettaglio || a.tipo || '').toString();

          // luogo
          let luogoLabel = '';
          if (a.inUfficio && a.cittaUfficio) {
            luogoLabel = `Ufficio ${a.cittaUfficio}`;
          } else if (a.luogo) {
            luogoLabel = a.luogo;
          }

          // responsabile
          const respObj = a.responsabileId ? staffMap[a.responsabileId] : null;
          const respLabel = respObj && respObj.nome ? respObj.nome : '';

          // componi testo: ora · luogo · responsabile
          const parts = [];
          if (rangeLabel) parts.push(rangeLabel);
          if (luogoLabel) parts.push(luogoLabel);
          if (respLabel) parts.push(respLabel);

          let text = parts.join(' · ');
          if (!text) {
            text = `${rangeLabel} ${tipologia}`.trim();
          }

          // crea il blocco interno
          const block = document.createElement('div');
          block.className = 'agenda-block';
          // colore responsabile
          let respColor = '#22c55e';
          if (respObj && (respObj.colore || respObj.color)) {
            respColor = respObj.colore || respObj.color;
          }
          /* gradient plastico più saturo */
          block.style.background = `linear-gradient(135deg, ${respColor}ee 0%, ${respColor}cc 45%, ${respColor}aa 100%)`;
          block.style.border = '3px solid ' + respColor;

          // glow e ombra dinamica in base alla durata
          const depth = Math.min(18, 4 + totalSlots * 1.2);
          block.style.boxShadow = `0 0 0 1px ${respColor}88, 0 4px ${depth}px rgba(0,0,0,0.45)`;

          // contenuto testo + icona fiamma se bollente
          let labelText = text;
          if (a.bollente) {
            labelText = '🔥 ' + labelText;
            block.classList.add('agenda-block-hot');
          }
          block.textContent = labelText;
          block.title = labelText;

          // evidenzia blocco appena creato
          if (lastCreatedAppId && a.id === lastCreatedAppId) {
            block.classList.add('agenda-block-new');
          }

          const colIndex = a._colIndex || 0;
          const colCount = maxCols || 1;
          const widthPercent = 100 / colCount;
          const leftPercent = widthPercent * colIndex;

          block.style.position = 'absolute';
          block.style.top = '0';
          block.style.left = leftPercent + '%';
          block.style.width = widthPercent + '%';
          block.style.height = (slotPx * totalSlots - 2) + 'px';

          block.addEventListener('click', handleClick);

          cell.appendChild(block);
        });
      });;
    }

    function updateAgendaDragHighlight() {
      document.querySelectorAll('.agenda-slot-selected').forEach(el => {
        el.classList.remove('agenda-slot-selected');
      });
      if (!agendaDrag.start || !agendaDrag.end) return;
      if (agendaDrag.start.date !== agendaDrag.end.date) return;

      const date = agendaDrag.start.date;
      const mStart = Math.min(agendaDrag.start.minutes, agendaDrag.end.minutes);
      const mEnd   = Math.max(agendaDrag.start.minutes, agendaDrag.end.minutes);

      document.querySelectorAll(`.agenda-slot[data-date="${date}"]`).forEach(slot => {
        const m = parseInt(slot.dataset.minutes || '0', 10);
        if (m >= mStart && m <= mEnd) {
          slot.classList.add('agenda-slot-selected');
        }
      });
    }

function clearAgendaDragHighlight() {
      document.querySelectorAll('.agenda-slot').forEach(slot => {
        slot.classList.remove('agenda-slot-selected');
      });
    }

    // Dialog per creare appuntamento su intervallo
    
    
    function openAgendaRangeDialog(dateIso, minutesStart, minutesEnd) {
      const pad = n => String(n).padStart(2,'0');
      const staffId = (staff[0] && staff[0].id) || null;

      const mStart = Math.max(0, minutesStart);
      const mEnd   = Math.max(mStart + 15, minutesEnd);

      const sh = Math.floor(mStart / 60);
      const sm = mStart % 60;
      const eh = Math.floor(mEnd / 60);
      const em = mEnd % 60;

      const fmt = (h,m) => `${pad(h)}:${pad(m)}`;

      // Non salviamo subito: prepariamo un appuntamento precompilato
      // e demandiamo la creazione effettiva al submit della scheda.
      const app = {
        id: '', // id vuoto -> verrà generato al salvataggio
        data: dateIso,
        ora: fmt(sh, sm),
        oraFine: fmt(eh, em),
        tipo: 'appuntamento',
        tipoDettaglio: 'sopralluogo',
        descrizione: '',
        responsabileId: staffId,
        clienteId: '',
        stato: 'aperta'
      };
      openAppuntamentoDialog(app);
    }


function creaNuovoAppuntamentoDaBottone() {
      const today = new Date();
      const dateIso = today.toISOString().slice(0,10);

      const staffId = (staff[0] && staff[0].id) || null;

      // Non salviamo subito: apriamo una scheda vuota/precompilata,
      // la creazione effettiva avverrà al salvataggio del form.
      const app = {
        id: '', // id vuoto -> verrà generato alla conferma
        data: dateIso,
        ora: '09:00',
        oraFine: '10:00',
        tipo: 'appuntamento',
        tipoDettaglio: 'sopralluogo',
        descrizione: '',
        responsabileId: staffId,
        clienteId: '',
        stato: 'aperta'
      };
      openAppuntamentoDialog(app);
    }

function renderAgendaMonth() {
      const cont = document.getElementById("agenda-month-summary");
      if (!cont) return;

      cont.innerHTML = "";

      const oggi = new Date();
      const year = oggi.getFullYear();
      const month = oggi.getMonth();

      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);

      let startOffset = first.getDay() - 1;
      if (startOffset < 0) startOffset = 6;

      const daysInMonth = last.getDate();
      const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

      const grid = document.createElement("div");
      grid.className = "agenda-month-grid";
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(7, 1fr)";
      grid.style.gap = "6px";

      for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement("div");

        cell.className = "metric agenda-month-day";
        cell.style.minHeight = "70px";
        cell.style.borderRadius = "6px";
        cell.style.display = "flex";
        cell.style.flexDirection = "column";
        cell.style.justifyContent = "flex-start";
        cell.style.padding = "4px 6px";

        const dayNum = i - startOffset + 1;

        if (dayNum > 0 && dayNum <= daysInMonth) {
          const d = new Date(year, month, dayNum);

          const num = document.createElement("div");
          num.textContent = dayNum;
          num.style.fontWeight = "600";
          num.style.marginBottom = "4px";
          cell.appendChild(num);

          cell.addEventListener("click", () => {
            agendaWeekAnchor = startOfWeek(d);
            setView("agenda");

            const gridWeekly = document.getElementById("agenda-week-grid");
            if (gridWeekly) {
              gridWeekly.scrollIntoView({ behavior: "smooth", block: "start" });
            }

            cell.classList.add("agenda-month-day-click");
            setTimeout(() => cell.classList.remove("agenda-month-day-click"), 180);
          });
        } else {
          cell.style.opacity = "0.25";
        }

        grid.appendChild(cell);
      }

      cont.appendChild(grid);
    }



    // navigazione settimana + filtri
    document.getElementById('agenda-prev-week')?.addEventListener('click', () => {
      agendaWeekAnchor = addDays(agendaWeekAnchor, -7);
      renderAgendaWeek();
    });
    document.getElementById('agenda-next-week')?.addEventListener('click', () => {
      agendaWeekAnchor = addDays(agendaWeekAnchor, 7);
      renderAgendaWeek();
    });
    document.getElementById('agenda-today-week')?.addEventListener('click', () => {
      agendaWeekAnchor = startOfWeek(new Date());
      renderAgendaWeek();
    });
    document.getElementById('agenda-type-filter')?.addEventListener('change', renderAgendaWeek);
    document.getElementById('agenda-staff-filter')?.addEventListener('change', renderAgendaWeek);
    document.getElementById('agenda-new-appointment')?.addEventListener('click', () => {
      creaNuovoAppuntamentoDaBottone();
    });

    // in caso rilasci mouse fuori dalla griglia
    document.addEventListener('mouseup', () => {
      if (!agendaDrag.isDragging) return;
      agendaDrag.isDragging = false;
      clearAgendaDragHighlight();
    });

  /* ====== IMMOBILI ====== */

  function renderImmobili() {
    const tbody = document.getElementById('imm-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    (immobili || []).forEach(imm => {
      const tr = document.createElement('tr');
      const staffObj = staff.find(s => s.id === imm.responsabileId);
      const caldoLabel = imm.caldo ? '🔥' : '';  
      tr.dataset.phone = imm.proprietarioTelefono || '';
      tr.dataset.email = imm.proprietarioEmail || '';
      
      tr.innerHTML = `
        <td>${imm.rif || ''}</td>
        <td>${imm.indirizzo || ''}</td>
        <td>${imm.citta || ''}</td>
        <td>${imm.tipologia || ''}</td>
        <td>${imm.categoria || ''}</td>
        <td>${imm.mq != null ? imm.mq : ''}</td>
        <td>${imm.prezzo ? formatEuro(imm.prezzo) : ''}</td>
        <td>${imm.stato || ''}</td>
        <td>${caldoLabel}</td>
        <td>${staffObj ? staffObj.nome : ''}</td>
        <td>
          <button class="btn btn-xs" data-imm-att="${imm.id || ''}" title="Crea attività collegata">➕ Attività</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function resetImmobiliForm() {
    const form = document.getElementById('imm-form');
    if (!form) return;
    form.reset();
    const caldoEl = document.getElementById('imm-caldo');
    if (caldoEl) caldoEl.checked = false;
  }

  const immForm = document.getElementById('imm-form');
  if (immForm) {
    immForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const rif = document.getElementById('imm-rif').value.trim();
      if (!rif) {
        alert('Inserisci il riferimento dell\'immobile.');
        return;
      }

      const propNome = document.getElementById('imm-prop-nome').value.trim();
      const propTel = document.getElementById('imm-prop-telefono').value.trim();
      const propMail = document.getElementById('imm-prop-email').value.trim();
      const indirizzo = document.getElementById('imm-indirizzo').value.trim();
      const citta = document.getElementById('imm-citta').value.trim();
      const provincia = document.getElementById('imm-provincia').value.trim();
      const tipologia = document.getElementById('imm-tipologia').value || 'vendita';
      const categoria = document.getElementById('imm-categoria').value || '';
      const piano = document.getElementById('imm-piano').value.trim();
      const mqStr = document.getElementById('imm-mq').value.trim();
      const localiStr = document.getElementById('imm-locali').value.trim();
      const bagniStr = document.getElementById('imm-bagni').value.trim();
      const prezzoStr = document.getElementById('imm-prezzo').value.trim();
      const stato = document.getElementById('imm-stato').value || 'in carico';
      const caldo = document.getElementById('imm-caldo').checked;
      const note = document.getElementById('imm-note').value.trim();
      const fotoInput = document.getElementById('imm-foto');
      const docsInput = document.getElementById('imm-docs');

      const mq = mqStr ? Number(mqStr.replace('.', '').replace(',', '.')) : null;
      const locali = localiStr ? Number(localiStr) : null;
      const bagni = bagniStr ? Number(bagniStr) : null;
      const prezzo = prezzoStr ? Number(prezzoStr.replace('.', '').replace(',', '.')) : null;

      const foto = [];
      if (fotoInput && fotoInput.files && fotoInput.files.length) {
        for (let i = 0; i < fotoInput.files.length; i++) {
          foto.push(fotoInput.files[i].name);
        }
      }
      const documenti = [];
      if (docsInput && docsInput.files && docsInput.files.length) {
        for (let i = 0; i < docsInput.files.length; i++) {
          documenti.push(docsInput.files[i].name);
        }
      }

      if (!Array.isArray(immobili)) immobili = [];

      const imm = {
        id: genId('imm'),
        rif: rif,
        proprietarioNome: propNome,
        proprietarioTelefono: propTel,
        proprietarioEmail: propMail,
        indirizzo: indirizzo,
        citta: citta,
        provincia: provincia,
        tipologia: tipologia,
        categoria: categoria,
        piano: piano,
        mq: mq,
        locali: locali,
        bagni: bagni,
        prezzo: prezzo,
        stato: stato,
        caldo: caldo,
        note: note,
        foto: foto,
        documenti: documenti
      };

      immobili.push(imm);
      saveList(STORAGE_KEYS.immobili, immobili);
      renderImmobili();
      renderDashboardImmobili();
      renderOperazioni();
      resetImmobiliForm();
    });
  }

  document.getElementById('imm-new-btn')?.addEventListener('click', () => {
    const section = document.getElementById('view-immobili');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
    const rifEl = document.getElementById('imm-rif');
    if (rifEl) rifEl.focus();
  });

  /* ====== NOTIZIE ====== */

  function renderNotizie() {
    const tbody = document.getElementById('not-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    (notizie || []).forEach(n => {
      const tr = document.createElement('tr');
      const staffObj = staff.find(s => s.id === n.responsabileId);
      const nomeCompleto = ((n.nome || '') + ' ' + (n.cognome || '')).trim();
      const caldoLabel = n.caldo ? '🔥' : '';
      const indirizzoCompleto = [n.indirizzo || '', n.citta || ''].filter(Boolean).join(' - ');
      tr.dataset.phone = n.telefono || '';
      tr.dataset.email = n.email || '';

      tr.innerHTML = `
        <td>${nomeCompleto || '—'}</td>
        <td>${n.telefono || ''}</td>
        <td>${indirizzoCompleto}</td>
        <td>${n.tipologia || ''}</td>
        <td>${n.piano || ''}</td>
        <td>${n.mq != null ? n.mq : ''}</td>
        <td>${caldoLabel}</td>
        <td>${staffObj ? staffObj.nome : ''}</td>
        <td>
          <button class="btn btn-xs" data-not-att="${n.id || ''}" title="Crea attività collegata">➕ Attività</button>
          <button class="btn btn-xs" data-not-imm="${n.id || ''}" title="Apri scheda inserimento immobile">🏠 Immobile</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function resetNotizieForm() {
    const form = document.getElementById('not-form');
    if (!form) return;
    form.reset();
    const caldoEl = document.getElementById('not-caldo');
    if (caldoEl) caldoEl.checked = false;
    const creaContattoEl = document.getElementById('not-crea-contatto');
    if (creaContattoEl) creaContattoEl.checked = true;
  }

  // Apre la scheda di inserimento immobile precompilando i dati a partire da una notizia
  function apriSchedaImmobileDaNotizia(notId) {
    if (!notizie || !notizie.length) return;
    const n = notizie.find(x => x && x.id === notId);
    if (!n) return;

    // switch vista sugli immobili
    setView('immobili');

    const section = document.getElementById('view-immobili');
    if (section && section.scrollIntoView) {
      section.scrollIntoView({ behavior: 'smooth' });
    }

    // Campi del form Immobili
    const rifEl        = document.getElementById('imm-rif');
    const propNomeEl   = document.getElementById('imm-prop-nome');
    const propTelEl    = document.getElementById('imm-prop-telefono');
    const propMailEl   = document.getElementById('imm-prop-email');
    const indirizzoEl  = document.getElementById('imm-indirizzo');
    const cittaEl      = document.getElementById('imm-citta');
    const provinciaEl  = document.getElementById('imm-provincia');
    const tipologiaEl  = document.getElementById('imm-tipologia');
    const mqEl         = document.getElementById('imm-mq');
    const pianoEl      = document.getElementById('imm-piano');
    const caldoImmEl   = document.getElementById('imm-caldo');
    const noteEl       = document.getElementById('imm-note');

    const nomeCompleto = ((n.nome || '') + ' ' + (n.cognome || '')).trim();

    // Precompila campi base
    if (rifEl) {
      const base = (n.cognome || n.nome || 'NOT').toUpperCase().slice(0, 3);
      rifEl.value = `NOT-${base}`;
    }
    if (propNomeEl)  propNomeEl.value  = nomeCompleto;
    if (propTelEl)   propTelEl.value   = n.telefono || '';
    if (propMailEl)  propMailEl.value  = n.email || '';
    if (indirizzoEl) indirizzoEl.value = n.indirizzo || '';
    if (cittaEl)     cittaEl.value     = n.citta || '';
    if (provinciaEl) provinciaEl.value = n.provincia || '';
    if (tipologiaEl && n.tipologia) tipologiaEl.value = n.tipologia;
    if (mqEl && n.mq != null) mqEl.value = n.mq;
    if (pianoEl) pianoEl.value = n.piano || '';
    if (caldoImmEl) caldoImmEl.checked = !!n.caldo;

    if (noteEl) {
      const extra = n.note
        ? `Da notizia ${n.id}: ${n.note}`
        : `Da notizia ${n.id}`;
      noteEl.value = noteEl.value
        ? (noteEl.value + '\n' + extra)
        : extra;
    }

    // focus sul primo campo del form
    const form = document.getElementById('imm-form');
    if (form) {
      const first = form.querySelector('input, select, textarea');
      if (first && first.focus) first.focus();
    }
  }


  function ensureContattoFromImmobile(imm) {
    if (!imm) return null;
    if (!Array.isArray(contatti)) contatti = [];
    const tel = (imm.proprietarioTelefono || '').trim();
    const mail = (imm.proprietarioEmail || '').trim();

    let found = contatti.find(c =>
      c &&
      ((tel && c.telefono === tel) || (mail && c.email === mail))
    );

    if (!found && (tel || mail || imm.proprietarioNome)) {
      const nome = imm.proprietarioNome || '';
      const today = new Date().toISOString().slice(0, 10);
      found = {
        id: genId('cont'),
        nome,
        telefono: tel,
        email: mail,
        origine: 'immobile',
        immobileId: imm.id,
        indirizzo: imm.indirizzo || '',
        citta: imm.citta || '',
        provincia: imm.provincia || '',
        ultimoContatto: today
      };
      contatti.push(found);
      saveList(STORAGE_KEYS.contatti, contatti);
    }
    return found ? found.id : null;
  }

  function creaAppuntamentoDaImmobileId(immId) {
    if (!immobili || !immobili.length) return;
    const imm = immobili.find(i => i && i.id === immId);
    if (!imm) return;

    if (!Array.isArray(attivita)) attivita = [];

    const today = new Date();
    const dateIso = today.toISOString().slice(0, 10);

    const staffId = (staff && staff[0] && staff[0].id) || null;
    const clienteId = ensureContattoFromImmobile(imm);

    // Non salviamo subito: prepariamo l'appuntamento collegato all'immobile
    // e demandiamo la creazione effettiva al submit della scheda.
    const app = {
      id: '', // generato al salvataggio
      data: dateIso,
      ora: '10:00',
      oraFine: '11:00',
      tipo: 'appuntamento',
      tipoDettaglio: 'sopralluogo',
      descrizione: '',
      responsabileId: staffId,
      clienteId: clienteId || '',
      contattoId: clienteId || '',
      immobileId: imm.id,
      inUfficio: false,
      cittaUfficio: '',
      luogo: imm.indirizzo || ''
    };

    openAppuntamentoDialog(app);
  }

  function findContattoFromNotizia(n) {
    if (!Array.isArray(contatti)) contatti = [];
    const tel = (n.telefono || '').trim();
    const mail = (n.email || '').trim();

    let found = contatti.find(c =>
      c &&
      ((tel && c.telefono === tel) || (mail && c.email === mail) || (c.notiziaId && c.notiziaId === n.id))
    );
    if (found) return found.id || null;
    return null;
  }

  function creaAppuntamentoDaNotiziaId(notId) {
    if (!notizie || !notizie.length) return;
    const n = notizie.find(x => x && x.id === notId);
    if (!n) return;

    if (!Array.isArray(attivita)) attivita = [];
    if (!Array.isArray(contatti)) contatti = [];

    const today = new Date();
    const dateIso = today.toISOString().slice(0, 10);

    const staffId = (staff && staff[0] && staff[0].id) || null;
    let clienteId = findContattoFromNotizia(n);

    // Se non esiste ancora un contatto collegato alla notizia, crealo ora
    if (!clienteId && (n.nome || n.cognome || n.telefono || n.email)) {
      const nomeCompleto = ((n.nome || '') + ' ' + (n.cognome || '')).trim();
      const contatto = {
        id: genId('cont'),
        nome: nomeCompleto || n.nome || '',
        telefono: n.telefono || '',
        email: n.email || '',
        origine: 'notizia',
        notiziaId: n.id,
        indirizzo: n.indirizzo || '',
        citta: n.citta || '',
        provincia: n.provincia || '',
        ultimoContatto: dateIso
      };
      contatti.push(contatto);
      saveList(STORAGE_KEYS.contatti, contatti);
      clienteId = contatto.id;
    }

    // Anche qui: non salviamo subito l'appuntamento, ma apriamo la scheda
    // precompilata collegata alla notizia.
    const app = {
      id: '', // generato al salvataggio
      data: dateIso,
      ora: '10:00',
      oraFine: '11:00',
      tipo: 'appuntamento',
      tipoDettaglio: 'sopralluogo',
      descrizione: '',
      responsabileId: staffId,
      clienteId: clienteId || '',
      contattoId: clienteId || '',
      notiziaId: n.id,
      inUfficio: false,
      cittaUfficio: '',
      luogo: n.indirizzo || ''
    };

    openAppuntamentoDialog(app);
  }

  function addContattoDaNotizia(notizia) {
    if (!Array.isArray(contatti)) contatti = [];

    const nomeCompleto = ((notizia.nome || '') + ' ' + (notizia.cognome || '')).trim();
    if (!nomeCompleto && !notizia.telefono && !notizia.email) return;

    // evita duplicati banali sul telefono
    const already = contatti.some(c => c.telefono && notizia.telefono && c.telefono === notizia.telefono);
    if (already) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const contatto = {
      id: genId('cont'),
      nome: nomeCompleto || notizia.nome || '',
      telefono: notizia.telefono || '',
      email: notizia.email || '',
      origine: 'notizia',
      notiziaId: notizia.id,
      indirizzo: notizia.indirizzo || '',
      citta: notizia.citta || '',
      provincia: notizia.provincia || '',
      ultimoContatto: today
    };
    contatti.push(contatto);
    saveList(STORAGE_KEYS.contatti, contatti);
  }

  const notForm = document.getElementById('not-form');
  if (notForm) {
    notForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const nome = document.getElementById('not-nome').value.trim();
      const cognome = document.getElementById('not-cognome').value.trim();
      const telefono = document.getElementById('not-telefono').value.trim();
      const email = document.getElementById('not-email').value.trim();
      const indirizzo = document.getElementById('not-indirizzo').value.trim();
      const citta = document.getElementById('not-citta').value.trim();
      const provincia = document.getElementById('not-provincia').value.trim();
      const tipologia = document.getElementById('not-tipologia').value || '';
      const piano = document.getElementById('not-piano').value.trim();
      const mqStr = document.getElementById('not-mq').value.trim();
      const caldo = document.getElementById('not-caldo').checked;
      const note = document.getElementById('not-note').value.trim();
      const creaContatto = document.getElementById('not-crea-contatto').checked;

      if (!nome && !cognome) {
        alert('Inserisci almeno nome o cognome del proprietario.');
        return;
      }

      const mq = mqStr ? Number(mqStr.replace('.', '').replace(',', '.')) : null;

      if (!Array.isArray(notizie)) notizie = [];

      const notizia = {
        id: genId('not'),
        nome: nome,
        cognome: cognome,
        telefono: telefono,
        email: email,
        indirizzo: indirizzo,
        citta: citta,
        provincia: provincia,
        tipologia: tipologia,
        piano: piano,
        mq: mq,
        caldo: caldo,
        note: note
      };

      notizie.push(notizia);
      saveList(STORAGE_KEYS.notizie, notizie);
      if (creaContatto) {
        addContattoDaNotizia(notizia);
      }
      renderNotizie();
      resetNotizieForm();
    });
  }

  document.getElementById('not-new-btn')?.addEventListener('click', () => {
    const section = document.getElementById('view-notizie');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
    const nomeEl = document.getElementById('not-nome');
    if (nomeEl) nomeEl.focus();
  });

/* ====== RUBRICA / CONTATTI ====== */

function buildKey(c) {
  return (c.telefono || c.email || c.id || '').trim().toLowerCase();
}

function match(c, tel, mail) {
  return (c.telefono && c.telefono === tel) ||
         (c.email && c.email.toLowerCase() === mail.toLowerCase());
}

function formatDateTimeIT(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return '';
  const date = d.toLocaleDateString('it-IT');
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function groupRubrica(data) {
  const map = new Map();

  (data || []).forEach(c => {
    const key = buildKey(c);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        nome: c.nome || '',
        telefono: c.telefono || '',
        email: c.email || '',
        indirizzo: c.indirizzo || '',
        citta: c.citta || '',
        provincia: c.provincia || '',
        ultimoContatto: c.ultimoContatto || null,
        contatti: [],
        notizie: [],
        immobili: [],
        eventi: []
      });
    }
    map.get(key).contatti.push(c);
  });

  const groups = Array.from(map.values());

  groups.forEach(g => {
    // link con notizie e immobili
    g.notizie = (notizie || []).filter(n => match(n, g.telefono, g.email));
    g.immobili = (immobili || []).filter(i => match(i, g.telefono, g.email));

    // flag ruolo (acquirente / venditore / collaboratore / altro) aggregati sul gruppo
    g.isAcquirente = g.contatti.some(c => c && c.isAcquirente);
    g.isVenditore = g.contatti.some(c => c && c.isVenditore);
    g.isCollaboratore = g.contatti.some(c => c && c.isCollaboratore);
    g.isAltro = g.contatti.some(c => c && c.isAltro);

    // timeline eventi + ultimo contatto
    const allEvents = [];
    let lastDate = null;

    g.contatti.forEach(c => {
      // eventi strutturati
      if (Array.isArray(c.eventi)) {
        c.eventi.forEach(ev => {
          if (!ev || !ev.data) return;
          const d = new Date(ev.data);
          if (isNaN(d)) return;
          allEvents.push({
            id: ev.id || genId('evt'),
            data: ev.data,
            tipo: ev.tipo || 'evento',
            nota: ev.nota || ''
          });
          if (!lastDate || d > lastDate) {
            lastDate = d;
          }
        });
      }
      // eventuale campo ultimoContatto legacy
      if (c.ultimoContatto) {
        const d2 = new Date(c.ultimoContatto);
        if (!isNaN(d2) && (!lastDate || d2 > lastDate)) {
          lastDate = d2;
        }
      }
    });

    allEvents.sort((a, b) => new Date(b.data) - new Date(a.data));
    g.eventi = allEvents;
    g.ultimoContatto = lastDate ? lastDate.toISOString() : null;
  });

  return groups.sort((a, b) => a.nome.localeCompare(b.nome));
}

function renderRubrica() {
  const list = document.getElementById('rubrica-list');
  if (!list) return;

  const ft = (document.getElementById('rubrica-filter')?.value || '').toLowerCase();
  const activeTabEl = document.querySelector('.rubrica-subtab.active');
  const activeTab = activeTabEl?.dataset.sub || 'lista';

  // Contatori globali per la home rubrica
  const all = Array.isArray(contatti) ? contatti : [];
  const totalCount = all.length;
  const acqCount = all.filter(c => c && c.isAcquirente).length;
  const vendCount = all.filter(c => c && c.isVenditore).length;
  const collCount = all.filter(c => c && c.isCollaboratore).length;
  const altroCount = all.filter(c => c && c.isAltro).length;
  const counterEl = document.getElementById('rubrica-counter');
  if (counterEl) {
    counterEl.textContent = `Contatti totali: ${totalCount} · Acquirenti: ${acqCount} · Venditori: ${vendCount} · Collaboratori: ${collCount} · Altro: ${altroCount}`;
  }

  let groups = groupRubrica(all).filter(g =>
    g.nome.toLowerCase().includes(ft) ||
    (g.telefono && g.telefono.includes(ft)) ||
    (g.email && g.email.toLowerCase().includes(ft))
  );

  if (activeTab === 'acquirenti') {
    groups = groups.filter(g => g.isAcquirente);
  } else if (activeTab === 'venditori') {
    groups = groups.filter(g => g.isVenditore);
  }

  if (!groups.length) {
    list.innerHTML = `<div style="padding:10px;">Nessun contatto in rubrica per questa vista.</div>`;
    return;
  }

  list.innerHTML = groups.map(g => {
    const last = g.ultimoContatto ? formatDateTimeIT(g.ultimoContatto) : '—';
    const eventi = g.eventi || [];
    const logHtml = eventi.length
      ? eventi.map(ev => {
          const when = formatDateTimeIT(ev.data);
          const tipo = escapeHtml(ev.tipo || 'evento');
          const nota = ev.nota ? ' – ' + escapeHtml(ev.nota) : '';
          return `<div style="font-size:11px; margin-bottom:2px;">
                    <span class="muted">${when}</span> · <strong>${tipo}</strong>${nota}
                  </div>`;
        }).join('')
      : `<div class="muted" style="font-size:11px;">Nessun evento registrato.</div>`;

    const ruoloParts = [];
    if (g.isAcquirente) ruoloParts.push('Acquirente');
    if (g.isVenditore) ruoloParts.push('Venditore');
    if (g.isCollaboratore) ruoloParts.push('Collaboratore');
    if (g.isAltro) ruoloParts.push('Altro');
    const ruoloHtml = ruoloParts.length
      ? `<div class="rubrica-roles">${ruoloParts.map(r => `<span class="tag tag-xs">${r}</span>`).join(' ')}</div>`
      : '';

    return `
      <div class="rubrica-row">
        <div class="rubrica-summary">
          <button class="rubrica-toggle" data-key="${g.key}">▸</button>
          <div class="rubrica-summary-main">
            <div>
              <strong>${escapeHtml(g.nome)}</strong>
              ${ruoloHtml}
            </div>
            <div>${escapeHtml(g.telefono || '')}</div>
            <div>${escapeHtml(g.email || '')}</div>
            <div>${last}</div>
            <div>${g.notizie.length}</div>
            <div>${g.immobili.length}</div>
          </div>
          <div class="rubrica-actions">
            <button class="btn btn-xs" data-edit="${g.key}" title="Modifica nome">✏️</button>
            <button class="btn btn-xs" data-touch="${g.key}" title="Segna contatto effettuato">📌</button>
            <button class="btn btn-xs" data-delete="${g.key}" title="Elimina contatto">🗑️</button>
          </div>
        </div>

        <div class="rubrica-details hidden">
          <div style="margin-bottom:4px;">
            <strong>Notizie collegate:</strong> ${g.notizie.length}
            ${g.notizie.length ? `<button class="badge-link" data-go="not" data-phone="${escapeHtml(g.telefono || '')}" data-email="${escapeHtml(g.email || '')}"><span>Apri lista notizie</span></button>` : ''}
          </div>
          <div style="margin-bottom:4px;">
            <strong>Immobili collegati:</strong> ${g.immobili.length}
            ${g.immobili.length ? `<button class="badge-link" data-go="imm" data-phone="${escapeHtml(g.telefono || '')}" data-email="${escapeHtml(g.email || '')}"><span>Apri lista immobili</span></button>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin:6px 0 4px;">
            <strong>Timeline contatti</strong>
            <span class="muted" style="font-size:11px;">(${eventi.length} evento/i)</span>
            <button class="btn btn-xs" data-log-add="${g.key}">+ evento</button>
          </div>
          <div class="rubrica-log">
            ${logHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

