/* ====== STORAGE & UTILITY ====== */

  const STORAGE_KEYS = {
    immobili: 'crm10_immobili',
    notizie: 'crm10_notizie',
    attivita: 'crm10_attivita',
    staff: 'crm10_staff',
    omi: 'crm10_omi',
    contatti: 'crm10_contatti',      // rubrica contatti proprietari
    intestazioni: 'crm10_intestazioni' // archivio header+footer per documenti IA
  ,    poligoni: 'crm10_mappa_poligoni' // archivio poligoni mappa (aree ricerca + condomini)
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

      // offset lunedì=0 ... domenica=6
      let startOffset = first.getDay() - 1;
      if (startOffset < 0) startOffset = 6;

      const daysInMonth = last.getDate();
      const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      const weeks = totalCells / 7;

      // Wrapper tabellare: colonne = giorni, righe = settimane
      const table = document.createElement("table");
      table.className = "agenda-month-table";
      table.style.width = "100%";
      table.style.borderCollapse = "separate";
      table.style.borderSpacing = "6px";
      table.style.tableLayout = "fixed";

      const thead = document.createElement("thead");
      const trHead = document.createElement("tr");
      const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

      dayNames.forEach(name => {
        const th = document.createElement("th");
        th.className = "muted";
        th.style.fontSize = "11px";
        th.style.fontWeight = "600";
        th.style.textTransform = "uppercase";
        th.style.letterSpacing = "0.08em";
        th.style.padding = "0 6px";
        th.style.textAlign = "left";
        th.textContent = name;
        trHead.appendChild(th);
      });

      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      for (let w = 0; w < weeks; w++) {
        const tr = document.createElement("tr");

        for (let d = 0; d < 7; d++) {
          const td = document.createElement("td");
          td.style.verticalAlign = "top";
          td.style.padding = "0";

          const cell = document.createElement("div");
          cell.className = "metric agenda-month-day";
          cell.style.minHeight = "80px";
          cell.style.borderRadius = "6px";
          cell.style.display = "flex";
          cell.style.flexDirection = "column";
          cell.style.justifyContent = "flex-start";
          cell.style.padding = "6px 8px";
          cell.style.cursor = "pointer";

          const i = w * 7 + d;
          const dayNum = i - startOffset + 1;

          if (dayNum > 0 && dayNum <= daysInMonth) {
            const dateObj = new Date(year, month, dayNum);
            const iso = dateObj.toISOString().slice(0, 10);

            // numero giorno
            const num = document.createElement("div");
            num.textContent = dayNum;
            num.style.fontWeight = "700";
            num.style.marginBottom = "6px";
            cell.appendChild(num);

            // contatore appuntamenti del giorno
            const count = (attivita || []).filter(a => a && a.tipo === "appuntamento" && a.data === iso).length;

            const counter = document.createElement("div");
            counter.style.marginTop = "auto";
            counter.style.display = "flex";
            counter.style.justifyContent = "flex-end";

            if (count > 0) {
              const badge = document.createElement("span");
              badge.className = "tag";
              badge.style.borderColor = "rgba(34,197,94,0.35)";
              badge.style.background = "rgba(34,197,94,0.10)";
              badge.style.color = "var(--text-main)";
              badge.textContent = `${count} app.`;
              counter.appendChild(badge);
            } else {
              const muted = document.createElement("span");
              muted.className = "muted";
              muted.style.fontSize = "11px";
              muted.textContent = "0 app.";
              counter.appendChild(muted);
            }
            cell.appendChild(counter);

            // click: vai alla settimana del giorno
            cell.addEventListener("click", () => {
              agendaWeekAnchor = startOfWeek(dateObj);
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
            cell.style.cursor = "default";
            // celle vuote: nessuna azione
            cell.addEventListener("click", (e) => e.preventDefault());
          }

          td.appendChild(cell);
          tr.appendChild(td);
        }

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      cont.appendChild(table);
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
      if ((imm.condominio || '').trim()) tr.classList.add('in-condominio-immobile');
      
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
        condominio: (document.getElementById('imm-condominio')?.value || '').trim(),
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
      const condoName = (n.condominio || '').trim();
      if (condoName) tr.classList.add('in-condominio-notizia');
      const condoBadge = condoName ? ` <span class="badge-condominio badge-condominio--notizia">🏢 ${escapeHtml(condoName)}</span>` : '';
      tr.dataset.phone = n.telefono || '';
      tr.dataset.email = n.email || '';

      tr.innerHTML = `
        <td>${nomeCompleto || '—'}</td>
        <td>${n.telefono || ''}</td>
        <td>${escapeHtml(indirizzoCompleto)}${condoBadge}</td>
        <td>${n.tipologia || ''}</td>
        <td>${n.piano || ''}</td>
        <td>${n.mq != null ? n.mq : ''}</td>
        <td>${caldoLabel}</td>
        <td>${staffObj ? staffObj.nome : ''}</td>
        <td>
          <button class="btn btn-xs" data-not-edit="${n.id || ''}" title="Modifica notizia">✏️ Modifica</button>
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
    const idEl = document.getElementById('not-id');
    if (idEl) idEl.value = '';
    const saveBtn = document.getElementById('not-save-btn');
    if (saveBtn) saveBtn.textContent = 'Salva notizia';
    const cancelBtn = document.getElementById('not-cancel-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';

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
      const condominio = (document.getElementById('not-condominio')?.value || '').trim();
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

      const existingId = (document.getElementById('not-id')?.value || '').trim();

      const notizia = {
        id: existingId || genId('not'),
        nome: nome,
        cognome: cognome,
        telefono: telefono,
        email: email,
        indirizzo: indirizzo,
        citta: citta,
        provincia: provincia,
        condominio: condominio,
        tipologia: tipologia,
        piano: piano,
        mq: mq,
        caldo: caldo,
        note: note
      };

      if (existingId) {
        const ix = (notizie || []).findIndex(x => x && x.id === existingId);
        if (ix >= 0) notizie[ix] = notizia;
        else notizie.push(notizia);
      } else {
        notizie.push(notizia);
      }
      saveList(STORAGE_KEYS.notizie, notizie);
      if (!existingId && creaContatto) {
        addContattoDaNotizia(notizia);
      }
      renderNotizie();
      resetNotizieForm();
    });
  }

  // --- NOTIZIE: apertura modale "Nuova notizia" (UI tipo appuntamento) ---
function openNotiziaModal(prefill) {
  const overlay = document.getElementById('notizie-modal-overlay');
  const form = document.getElementById('not-form');
  if (!overlay || !form) return;

  // reset + prefill
  form.reset();
  const idEl = document.getElementById('not-id');
  if (idEl) idEl.value = (prefill && prefill.id) ? prefill.id : '';

  // compila campi se presenti
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  if (prefill) {
    set('not-etichetta', prefill.etichetta || 'generica');
    set('not-nome', prefill.proprietarioNome || '');
    set('not-telefono', prefill.proprietarioTelefono || '');
    set('not-email', prefill.proprietarioEmail || '');
    set('not-indirizzo', prefill.indirizzo || '');
    set('not-citta', prefill.citta || '');
    set('not-provincia', prefill.provincia || '');
    set('not-cap', prefill.cap || '');
    set('not-categoria', prefill.categoria || '');
    set('not-tipologia', prefill.tipologia || 'vendita');
    set('not-mq', prefill.mq ?? '');
    set('not-prezzo', prefill.prezzo ?? '');
    set('not-note', prefill.note || '');
    set('not-non-risponde', prefill.nonRisponde ? '1' : ''); // se è checkbox lo gestisce il reset
    const chk = document.getElementById('not-non-risponde');
    if (chk && typeof chk.checked !== 'undefined') chk.checked = !!prefill.nonRisponde;
    set('not-ricontatto', prefill.ricontatto || '');
    set('not-resp', prefill.responsabileId || '');
  }

  overlay.style.display = 'flex';
  // focus sul primo campo sensato
  (document.getElementById('not-etichetta') || document.getElementById('not-indirizzo') || document.getElementById('not-nome'))?.focus?.();
}

function closeNotiziaModal() {
  const overlay = document.getElementById('notizie-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
}

(function bindNotizieModalUI(){
  const overlay = document.getElementById('notizie-modal-overlay');
  if (!overlay) return;

  document.getElementById('not-modal-close')?.addEventListener('click', closeNotiziaModal);

  // click fuori dalla modale
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNotiziaModal();
  });

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ov = document.getElementById('notizie-modal-overlay');
      if (ov && ov.style.display === 'flex') closeNotiziaModal();
    }
  });

  // delega click "modifica" (se presente nelle card o altrove)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-not-edit]');
    if (!btn) return;
    const id = btn.getAttribute('data-not-edit');
    const n = (notizie || []).find(x => x && x.id === id);
    if (n) openNotiziaModal(n);
  });
})();

document.getElementById('not-new-btn')?.addEventListener('click', () => {
  openNotiziaModal(null);
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
function setRubricaSub(sub) {
  const valid = ['lista','nuovo','acquirenti','venditori'];
  if (!valid.includes(sub)) sub = 'lista';

  const tabs = document.querySelectorAll('.rubrica-subtab');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === sub);
  });

  // sincronizza anche il submenu laterale
  document.querySelectorAll('.nav-item-sub[data-rubrica-sub]').forEach(item => {
    item.classList.toggle('active', item.dataset.rubricaSub === sub || item.dataset.rubrica_sub === sub);
  });

  if (sub === 'nuovo') {
    const overlay = document.getElementById('rubrica-dialog-overlay');
    if (overlay) overlay.style.display = 'flex';
  } else {
    const overlay = document.getElementById('rubrica-dialog-overlay');
    if (overlay) overlay.style.display = 'none';
    renderRubrica();
  }
}


document.addEventListener('click', e => {
  const t = e.target;

  // Sottosezioni Rubrica (lista / nuovo / acquirenti / venditori) - tabs interni
  const tabBtn = t.closest('.rubrica-subtab');
  if (tabBtn) {
    const sub = tabBtn.dataset.sub || 'lista';
    setRubricaSub(sub);
    return;
  }

  // Sottosezioni Rubrica dal menu laterale
  const sideSub = t.closest('.nav-item-sub[data-rubrica-sub]');
  if (sideSub) {
    const sub = sideSub.dataset.rubricaSub || sideSub.getAttribute('data-rubrica-sub') || 'lista';
    // Forziamo vista rubrica se non già attiva
    setView('rubrica');
    setRubricaSub(sub);
    return;
  }

  // Toggle dettagli timeline
  if (t.classList.contains('rubrica-toggle')) {
    const row = t.closest('.rubrica-row');
    if (!row) return;
    const det = row.querySelector('.rubrica-details');
    if (!det) return;
    const hidden = det.classList.toggle('hidden');
    t.textContent = hidden ? '▸' : '▾';
  }

  // Vai a notizie / immobili
  if (t.dataset.go) {
    const phone = t.dataset.phone || '';
    const mail = (t.dataset.email || '').toLowerCase();
    if (t.dataset.go === 'not') setView('notizie');
    else setView('immobili');
    requestAnimationFrame(() => {
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach(r => {
        const rp = r.dataset.phone || '';
        const re = (r.dataset.email || '').toLowerCase();
        r.classList.toggle('row-highlight',
          (rp && rp === phone) ||
          (re && re === mail)
        );
      });
    });
  }

  // Aggiorna ultimo contatto (touch rapido)
  if (t.dataset.touch) {
    const key = t.dataset.touch;
    const nowIso = new Date().toISOString();
    (contatti || []).forEach(c => {
      if (buildKey(c) === key) {
        if (!Array.isArray(c.eventi)) c.eventi = [];
        c.eventi.push({
          id: genId('evt'),
          data: nowIso,
          tipo: 'touch',
          nota: 'Segnato come contatto effettuato dalla rubrica.'
        });
        c.ultimoContatto = nowIso;
      }
    });
    saveList(STORAGE_KEYS.contatti, contatti);
    renderRubrica();
  }

  // Aggiungi evento manuale
  if (t.dataset.logAdd) {
    const key = t.dataset.logAdd;
    const tipoRaw = prompt('Tipo di evento (es. telefonata, email, visita, nota):', 'telefonata');
    if (tipoRaw === null) return;
    const tipo = (tipoRaw || '').trim() || 'evento';
    const notaRaw = prompt('Nota interna (facoltativa):', '');
    const nota = (notaRaw || '').trim();
    const nowIso = new Date().toISOString();

    (contatti || []).forEach(c => {
      if (buildKey(c) === key) {
        if (!Array.isArray(c.eventi)) c.eventi = [];
        c.eventi.push({
          id: genId('evt'),
          data: nowIso,
          tipo,
          nota
        });
        c.ultimoContatto = nowIso;
      }
    });
    saveList(STORAGE_KEYS.contatti, contatti);
    renderRubrica();
  }

  // Elimina gruppo contatti
  if (t.dataset.delete) {
    if (!confirm('Eliminare contatto dalla rubrica? (non elimina immobili/notizie collegate)')) return;
    const key = t.dataset.delete;
    contatti = (contatti || []).filter(c => buildKey(c) !== key);
    saveList(STORAGE_KEYS.contatti, contatti);
    renderRubrica();
  }

  // Modifica nome (solo campo nome visualizzato)
  if (t.dataset.edit) {
    const key = t.dataset.edit;
    const nuovo = prompt('Nuovo nome contatto:');
    if (!nuovo) return;
    const name = nuovo.trim();
    if (!name) return;
    (contatti || []).forEach(c => {
      if (buildKey(c) === key) {
        c.nome = name;
      }
    });
    saveList(STORAGE_KEYS.contatti, contatti);
    renderRubrica();
  }
});

/* MODALE NUOVO CONTATTO */
document.getElementById('rubrica-new-btn')?.addEventListener('click', () => {
  const overlay = document.getElementById('rubrica-dialog-overlay');
  if (overlay) overlay.style.display = 'flex';
});
document.getElementById('rubrica-dialog-close')?.addEventListener('click', () => {
  const overlay = document.getElementById('rubrica-dialog-overlay');
  if (overlay) overlay.style.display = 'none';
});
document.getElementById('rubrica-dialog-cancel')?.addEventListener('click', () => {
  const overlay = document.getElementById('rubrica-dialog-overlay');
  if (overlay) overlay.style.display = 'none';
});

document.getElementById('rubrica-form')?.addEventListener('submit', e => {
  e.preventDefault();

  const nome = document.getElementById('rubrica-nome').value.trim();
  if (!nome) {
    alert('Inserisci almeno il nome del contatto.');
    return;
  }

  const telefono = document.getElementById('rubrica-telefono')?.value.trim() || '';
  const email = document.getElementById('rubrica-email')?.value.trim() || '';
  const indirizzo = document.getElementById('rubrica-indirizzo')?.value.trim() || '';
  const citta = document.getElementById('rubrica-citta')?.value.trim() || '';
  const provincia = document.getElementById('rubrica-provincia')?.value.trim() || '';
  const note = document.getElementById('rubrica-note')?.value.trim() || '';
  const isAcquirente = !!document.getElementById('rubrica-flag-acq')?.checked;
  const isVenditore = !!document.getElementById('rubrica-flag-vend')?.checked;
  const isCollaboratore = !!document.getElementById('rubrica-flag-coll')?.checked;
  const isAltro = !!document.getElementById('rubrica-flag-altro')?.checked;

  const c = {
    id: genId('cont'),
    nome,
    telefono,
    email,
    indirizzo,
    citta,
    provincia,
    note,
    provenienza: 'manuale',
    isAcquirente,
    isVenditore,
    isCollaboratore,
    isAltro,
    eventi: [],
    ultimoContatto: new Date().toISOString()
  };

  if (!Array.isArray(contatti)) contatti = [];
  contatti.push(c);
  saveList(STORAGE_KEYS.contatti, contatti);

  const overlay = document.getElementById('rubrica-dialog-overlay');
  if (overlay) overlay.style.display = 'none';

  const form = document.getElementById('rubrica-form');
  if (form) form.reset();

  renderRubrica();
});
/* ====== ATTIVITÀ ====== */

    let attivitaRemindersShown = false;

    const APPUNTAMENTO_TIPI = [
      'sopralluogo',
      'stima',
      'acquisizione',
      'visita',
      'trattativa',
      'rogito',
      'altro'
    ];

    function normalizeAttivitaItem(a) {
      if (!a.id) a.id = genId('att');
      if (!a.stato) a.stato = 'aperta'; // compatibilità vecchi record
      return a;
    }

    function getAttMeta(a) {
      const today = new Date();
      today.setHours(0,0,0,0);

      let due = null;
      if (a.data) {
        const d = parseISODate(a.data);
        if (d) {
          d.setHours(0,0,0,0);
          due = d;
        }
      }

      const baseStatus = a.stato === 'chiusa' ? 'chiusa' : 'aperta';
      let tag = 'senza_data';

      if (due) {
        if (baseStatus === 'chiusa') tag = 'chiusa';
        else if (due < today) tag = 'scaduta';
        else if (+due === +today) tag = 'oggi';
        else tag = 'futura';
      } else {
        tag = baseStatus;
      }

      let label = baseStatus === 'chiusa' ? 'Chiusa' : 'Aperta';
      if (tag === 'scaduta' && baseStatus !== 'chiusa') label = 'Scaduta (aperta)';
      if (tag === 'oggi' && baseStatus !== 'chiusa') label = 'Oggi';

      return { baseStatus, tag, label, dueDate: due };
    }

    
    function getAppuntamentoById(id) {
      if (!id) return null;
      return (attivita || []).find(a => a && a.id === id && a.tipo === 'appuntamento');
    }

    function openAppuntamentoDialogById(id) {
      const app = getAppuntamentoById(id);
      if (!app) return;
      openAppuntamentoDialog(app);
    }

    
    function openAppuntamentoDialog(app) {
      const overlay = document.getElementById('appuntamento-dialog-overlay');
      if (!overlay) return;

      // normalizza record appuntamento
      if (!app.tipo) app.tipo = 'appuntamento';

      const idInput = document.getElementById('app-id');
      const dataInput = document.getElementById('app-data');
      const oraInput = document.getElementById('app-ora');
      const oraFineInput = document.getElementById('app-ora-fine');
      const tipoSel = document.getElementById('app-tipo');
      const respSel = document.getElementById('app-resp');
      const cliSel = document.getElementById('app-cliente');
      const immSel = document.getElementById('app-immobile');
      const notSel = document.getElementById('app-notizia');
      const descrInput = document.getElementById('app-descrizione');
      const statoSel = document.getElementById('app-stato');
      const bollenteChk = document.getElementById('app-bollente');
      const luogoInput = document.getElementById('app-luogo');
      const inUfficioChk = document.getElementById('app-in-ufficio');
      const cittaUfficioSel = document.getElementById('app-citta-ufficio');

      function getCittaUfficioGroup() {
        if (!cittaUfficioSel) return null;
        return cittaUfficioSel.closest('.form-group');
      }

      if (idInput) idInput.value = app.id || '';
      if (dataInput) dataInput.value = app.data || '';
      if (oraInput) oraInput.value = app.ora || '';
      if (oraFineInput) oraFineInput.value = app.oraFine || '';

      if (tipoSel) {
        const tipiBase = [
          'sopralluogo',
          'stima',
          'acquisizione',
          'visita',
          'trattativa',
          'rogito',
          'telefonata',
          'altro'
        ];
        const tipi = (typeof APPUNTAMENTO_TIPI !== 'undefined' && Array.isArray(APPUNTAMENTO_TIPI) && APPUNTAMENTO_TIPI.length)
          ? APPUNTAMENTO_TIPI
          : tipiBase;
        const valore = (tipi.includes(app.tipoDettaglio) ? app.tipoDettaglio : tipi[0]);
        tipoSel.value = valore;
      }

      if (respSel) {
        respSel.innerHTML = '';
        const optNone = document.createElement('option');
        optNone.value = '';
        optNone.textContent = '— Nessun responsabile —';
        respSel.appendChild(optNone);

        (staff || []).forEach(s => {
          if (!s || !s.id) return;
          const o = document.createElement('option');
          o.value = s.id;
          o.textContent = s.nome || s.id;
          respSel.appendChild(o);
        });

        respSel.value = app.responsabileId || '';
      }

      if (cliSel) {
        cliSel.innerHTML = '';
        const optNoneC = document.createElement('option');
        optNoneC.value = '';
        optNoneC.textContent = '— Nessun cliente collegato —';
        cliSel.appendChild(optNoneC);

        (contatti || []).forEach(c => {
          if (!c || !c.id) return;
          const o = document.createElement('option');
          o.value = c.id;
          const parts = [];
          if (c.nome) parts.push(c.nome);
          if (c.telefono) parts.push(c.telefono);
          o.textContent = parts.join(' · ') || c.id;
          cliSel.appendChild(o);
        });

        const storedClienteId = app.clienteId || app.contattoId || '';
        cliSel.value = storedClienteId;
      }

      if (immSel) {
        immSel.innerHTML = '';
        const optNoneI = document.createElement('option');
        optNoneI.value = '';
        optNoneI.textContent = '— Nessun immobile collegato —';
        immSel.appendChild(optNoneI);

        (immobili || []).forEach(imm => {
          if (!imm || !imm.id) return;
          const o = document.createElement('option');
          o.value = imm.id;
          const parts = [];
          if (imm.rif) parts.push(imm.rif);
          if (imm.indirizzo) parts.push(imm.indirizzo);
          o.textContent = parts.join(' · ') || imm.id;
          immSel.appendChild(o);
        });

        if (app.immobileId) {
          immSel.value = app.immobileId;
        } else {
          immSel.value = '';
        }
      }

      if (notSel) {
        notSel.innerHTML = '';
        const optNoneN = document.createElement('option');
        optNoneN.value = '';
        optNoneN.textContent = '— Nessuna notizia collegata —';
        notSel.appendChild(optNoneN);

        (notizie || []).forEach(n => {
          if (!n || !n.id) return;
          const o = document.createElement('option');
          o.value = n.id;
          const parts = [];
          if (n.nome) parts.push(n.nome);
          if (n.cognome) parts.push(n.cognome);
          if (n.indirizzo) parts.push(n.indirizzo);
          o.textContent = parts.join(' · ') || n.id;
          notSel.appendChild(o);
        });

        if (app.notiziaId) {
          notSel.value = app.notiziaId;
        } else {
          notSel.value = '';
        }
      }

      if (descrInput) descrInput.value = app.descrizione || '';
      if (statoSel) statoSel.value = app.stato || 'aperta';
      if (bollenteChk) bollenteChk.checked = !!app.bollente;

      if (luogoInput) luogoInput.value = app.luogo || '';
      if (inUfficioChk) inUfficioChk.checked = !!app.inUfficio;
      if (cittaUfficioSel) cittaUfficioSel.value = app.cittaUfficio || '';

      // MOSTRA/NASCONDI la tendina città ufficio in base al flag
      const cittaGroup = getCittaUfficioGroup();
      if (cittaGroup) {
        const flag = inUfficioChk && inUfficioChk.checked;
        cittaGroup.style.display = flag ? '' : 'none';
      }

      if (inUfficioChk) {
        inUfficioChk.onchange = () => {
          const group = getCittaUfficioGroup();
          if (!group) return;
          const flag = !!inUfficioChk.checked;
          group.style.display = flag ? '' : 'none';
          if (!flag && cittaUfficioSel) {
            // se tolgo il flag, pulisco la città ufficio
            cittaUfficioSel.value = '';
          }
        };
      }

      // Gestione visibilità pulsanti azione (elimina / esito) in base alla presenza di un id valido
      const delBtn = document.getElementById('app-elimina');
      const esitoPosBtn = document.getElementById('app-esito-pos');
      const esitoNegBtn = document.getElementById('app-esito-neg');
      const hasExisting = !!(app.id && getAppuntamentoById(app.id));

      [delBtn, esitoPosBtn, esitoNegBtn].forEach(btn => {
        if (!btn) return;
        btn.style.display = hasExisting ? 'inline-flex' : 'none';
      });

      overlay.style.display = 'flex';
      document.body.classList.add('modal-open');
    }
function closeAppuntamentoDialog() {
      const overlay = document.getElementById('appuntamento-dialog-overlay');
      if (!overlay) return;
      overlay.style.display = 'none';
      document.body.classList.remove('modal-open');
    }


    function renderAttivitaFiltersOptions() {
      const sel = document.getElementById('att-filter-resp');
      if (!sel) return;
      const current = sel.value || 'tutti';

      sel.innerHTML = '';
      const optAll = document.createElement('option');
      optAll.value = 'tutti';
      optAll.textContent = 'Tutti';
      sel.appendChild(optAll);

      const used = new Set();
      (attivita || []).forEach(a => {
        if (a && a.responsabileId) used.add(a.responsabileId);
      });

      const staffMap = {};
      (staff || []).forEach(s => { staffMap[s.id] = s; });

      used.forEach(id => {
        const s = staffMap[id];
        if (!s) return;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = s.nome || 'Responsabile';
        sel.appendChild(opt);
      });

      if (Array.from(used).includes(current)) {
        sel.value = current;
      } else {
        sel.value = 'tutti';
      }
    }

    function renderAttivita() {
      const tbody = document.getElementById('att-table-body');
      if (!tbody) return;

      // normalizza
      attivita = (attivita || []).map(a => normalizeAttivitaItem(a));

      renderAttivitaFiltersOptions();

      const fStato = document.getElementById('att-filter-stato')?.value || 'tutte';
      const fResp = document.getElementById('att-filter-resp')?.value || 'tutti';
      const fText = (document.getElementById('att-filter-text')?.value || '').toLowerCase();

      let list = [...(attivita || [])];

      // ordinamento data + ora
      list.sort((a, b) => {
        const da = a.data || '';
        const db = b.data || '';
        if (da === db) {
          return (a.ora || '').localeCompare(b.ora || '');
        }
        return da.localeCompare(db);
      });

      const staffMap = {};
      (staff || []).forEach(s => { staffMap[s.id] = s; });

      let countTot = 0;
      let countAperte = 0;
      let countOggi = 0;
      let countScadute = 0;

      const rows = [];

      list.forEach(a => {
        if (!a) return;
        const meta = getAttMeta(a);

        countTot++;
        if (meta.baseStatus !== 'chiusa') countAperte++;
        if (meta.tag === 'oggi') countOggi++;
        if (meta.tag === 'scaduta') countScadute++;

        // filtri stato
        if (fStato === 'aperte' && meta.baseStatus === 'chiusa') return;
        if (fStato === 'chiuse' && meta.baseStatus !== 'chiusa') return;
        if (fStato === 'oggi' && meta.tag !== 'oggi') return;
        if (fStato === 'scadute' && meta.tag !== 'scaduta') return;

        // filtro responsabile
        if (fResp !== 'tutti' && a.responsabileId !== fResp) return;

        // filtro testo
        const comboText = `${a.descrizione || ''} ${a.tipoDettaglio || ''} ${a.tipo || ''}`.toLowerCase();
        if (fText && !comboText.includes(fText)) return;

        let rowStyle = '';
        if (meta.tag === 'oggi' && meta.baseStatus !== 'chiusa') {
          rowStyle = ' style="background:rgba(34,197,94,0.15);"';
        } else if (meta.tag === 'scaduta' && meta.baseStatus !== 'chiusa') {
          rowStyle = ' style="background:rgba(239,68,68,0.18);"';
        }

        const respName = a.responsabileId && staffMap[a.responsabileId]
          ? staffMap[a.responsabileId].nome
          : '';

        const tipoSafe = escapeHtml(a.tipoDettaglio || a.tipo || '');
        const descrSafe = escapeHtml(a.descrizione || '');
        const respSafe = escapeHtml(respName || '');
        const statoLabel = meta.label;

        rows.push(`
          <tr${rowStyle} data-att-id="${a.id}">
            <td>${formatDateIT(a.data)}</td>
            <td>${a.ora || ''}</td>
            <td>${tipoSafe}</td>
            <td>${descrSafe}</td>
            <td>${respSafe}</td>
            <td>${statoLabel}</td>
            <td>
              ${meta.baseStatus !== 'chiusa'
                ? `<button class="btn btn-xs" data-att-done="${a.id}" title="Segna chiusa">✅</button>`
                : ''
              }
              <button class="btn btn-xs" data-att-delete="${a.id}" title="Elimina">🗑️</button>
            </td>
          </tr>
        `);
      });

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Nessuna attività registrata.</td></tr>`;
      } else {
        tbody.innerHTML = rows.join('');
      }

      // riepilogo contatori
      const elTot = document.getElementById('att-count-tot');
      if (elTot) elTot.textContent = String(countTot);
      const elAp = document.getElementById('att-count-aperte');
      if (elAp) elAp.textContent = String(countAperte);
      const elOg = document.getElementById('att-count-oggi');
      if (elOg) elOg.textContent = String(countOggi);
      const elSc = document.getElementById('att-count-scadute');
      if (elSc) elSc.textContent = String(countScadute);

      // reminder semplice (una sola volta per sessione)
      if (!attivitaRemindersShown && (countOggi > 0 || countScadute > 0)) {
        alert(`Hai ${countOggi} attività per oggi e ${countScadute} attività scadute ancora aperte.`);
        attivitaRemindersShown = true;
      }
    }

    // Nuova attività
    document.getElementById('att-new-btn')?.addEventListener('click', () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const data = prompt('Data (YYYY-MM-DD):', todayIso);
      if (!data) return;

      const ora = prompt('Ora (HH:MM):', '10:00') || '';
      const tipo = prompt('Tipo attività:', 'attività') || 'attività';
      const descr = prompt('Descrizione attività:') || '';

      let responsabileId = null;
      if (Array.isArray(staff) && staff.length) {
        const elenco = staff.map((s, idx) => `${idx + 1}) ${s.nome || 'Senza nome'}`).join('\n');
        const scelta = prompt(`Responsabile (numero, lascia vuoto per nessuno):\n${elenco}`, '');
        const idxSel = scelta ? parseInt(scelta, 10) : NaN;
        if (!isNaN(idxSel) && idxSel >= 1 && idxSel <= staff.length) {
          responsabileId = staff[idxSel - 1].id;
        }
      }

      const act = {
        id: genId('att'),
        data,
        ora,
        tipo,
        descrizione: descr,
        responsabileId,
        stato: 'aperta'
      };

      if (!Array.isArray(attivita)) attivita = [];
      attivita.push(act);
      saveList(STORAGE_KEYS.attivita, attivita);
      renderAttivita();
      renderDashboardTodayActivities();
      renderDashboardDaySummary();
    });

    // Nuovo appuntamento (crea record e apre scheda appuntamento)
    document.getElementById('att-new-app-btn')?.addEventListener('click', () => {
      creaNuovoAppuntamentoDaBottone();
    });

    // click su chiudi / elimina attività
    document.addEventListener('click', (e) => {
      const t = e.target;

      if (t.dataset && t.dataset.attDone) {
        const id = t.dataset.attDone;
        (attivita || []).forEach(a => {
          if (a && a.id === id) {
            a.stato = 'chiusa';
          }
        });
        saveList(STORAGE_KEYS.attivita, attivita);
        renderAttivita();
        renderDashboardTodayActivities();
        renderDashboardDaySummary();
        return;
      }

      if (t.dataset && t.dataset.attDelete) {
        const id = t.dataset.attDelete;
        if (!confirm('Eliminare questa attività?')) return;
        attivita = (attivita || []).filter(a => !a || a.id !== id);
        saveList(STORAGE_KEYS.attivita, attivita);
        renderAttivita();
        renderDashboardTodayActivities();
        renderDashboardDaySummary();
        return;
      }

      // Crea attività/appuntamento collegato da immobile
      if (t.dataset && t.dataset.immAtt) {
        const immId = t.dataset.immAtt;
        if (immId) {
          creaAppuntamentoDaImmobileId(immId);
        }
        return;
      }

      // Crea attività/appuntamento collegato da notizia
      if (t.dataset && t.dataset.notAtt) {
        const notId = t.dataset.notAtt;
        if (notId) {
          creaAppuntamentoDaNotiziaId(notId);
        }
        return;
      }

      // Modifica notizia
      if (t.dataset && t.dataset.notEdit) {
        const notId = t.dataset.notEdit;
        if (notId) startEditNotizia(notId);
        return;
      }

      // Apri scheda inserimento immobile partendo da notizia
      if (t.dataset && t.dataset.notImm) {
        const notId = t.dataset.notImm;
        if (notId) {
          apriSchedaImmobileDaNotizia(notId);
        }
        return;
      }

      // Apertura scheda appuntamento cliccando sulla riga in tabella Attività
      const tr = t.closest && t.closest('tr[data-att-id]');
      if (tr && t.closest('table') && t.closest('#view-attivita') && !t.closest('button')) {
        const id = tr.getAttribute('data-att-id');
        const app = getAppuntamentoById(id);
        if (app) {
          openAppuntamentoDialogById(id);
        }
      }
    });

    // filtri attivita
    document.getElementById('att-filter-stato')?.addEventListener('change', renderAttivita);
    document.getElementById('att-filter-resp')?.addEventListener('change', renderAttivita);
    document.getElementById('att-filter-text')?.addEventListener('input', () => renderAttivita());
    document.getElementById('att-filter-clear')?.addEventListener('click', () => {
      const fS = document.getElementById('att-filter-stato');
      const fR = document.getElementById('att-filter-resp');
      const fT = document.getElementById('att-filter-text');
      if (fS) fS.value = 'tutte';
      if (fR) fR.value = 'tutti';
      if (fT) fT.value = '';
      renderAttivita();
    });

    /* ====== OPERAZIONI CONCLUSE ====== */

    function renderOperazioni() {
      const tbody = document.getElementById('operazioni-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      const list = (immobili || []).filter(imm => {
        const st = (imm.stato || '').toLowerCase();
        return imm.venduto === true || imm.affittato === true || st === 'venduto' || st === 'affittato';
      });

      if (!list.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'muted';
        td.textContent = 'Nessuna operazione conclusa.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      list.forEach(imm => {
        const tr = document.createElement('tr');
        const tipo = (imm.tipologia || '').toLowerCase().includes('affitto') ? 'Locazione' : 'Vendita';
        const valore = Number(imm.valoreCompravendita || imm.prezzo || 0);
        const provv = Number(imm.provvigione || 0);
        tr.innerHTML = `
          <td>${imm.rif || ''}</td>
          <td>${imm.indirizzo || ''}</td>
          <td>${imm.dataStipula ? formatDateIT(imm.dataStipula) : ''}</td>
          <td>${tipo}</td>
          <td>${valore ? formatEuro(valore) : ''}</td>
          <td>${provv ? formatEuro(provv) : ''}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    
    /* ====== DASHBOARD PROVVIGIONI & EXPORT CSV ====== */

    function getOperazioniList() {
      return (immobili || []).filter(imm => {
        if (!imm) return false;
        const st = (imm.stato || '').toLowerCase();
        return imm.venduto === true || imm.affittato === true || st === 'venduto' || st === 'affittato';
      });
    }

    function renderDashboardProvvigioni() {
      const metricsEl = document.getElementById('dashboard-provvigioni-metrics');
      const canvas = document.getElementById('dashboard-provvigioni-chart');
      if (!metricsEl || !canvas) return;

      const ops = getOperazioniList();
      let totaleProvv = 0;
      let totaleContanti = 0;
      let totaleTracciato = 0;

      ops.forEach(imm => {
        const provvCont = Number(imm.provvigioneContanti || 0);
        const provvTrac = Number(imm.provvigioneTracciata || 0);
        const provvTot = provvCont + provvTrac || Number(imm.provvigione || 0) || 0;

        totaleProvv += provvTot;
        totaleContanti += provvCont;
        totaleTracciato += provvTrac || (provvTot - provvCont);
      });

      metricsEl.innerHTML = '';

      function addMetric(label, value, suffix) {
        const div = document.createElement('div');
        div.className = 'metric';
        const l = document.createElement('div');
        l.className = 'metric-label';
        l.textContent = label;
        const v = document.createElement('div');
        v.className = 'metric-value';
        v.textContent = suffix ? value + ' ' + suffix : value;
        div.appendChild(l);
        div.appendChild(v);
        metricsEl.appendChild(div);
      }

      addMetric('Operazioni concluse', String(ops.length));
      addMetric('Provvigioni totali', totaleProvv ? formatEuro(totaleProvv) : '—');
      addMetric('Contanti / Tracciato', (totaleContanti ? formatEuro(totaleContanti) : '—') + ' · ' + (totaleTracciato ? formatEuro(totaleTracciato) : '—'));

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!ops.length) return;

      // aggregazione per mese (ultimi 6 mesi)
      const now = new Date();
      const buckets = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        buckets.push({ key, label: d.toLocaleDateString('it-IT', { month: 'short' }), total: 0 });
      }

      ops.forEach(imm => {
        if (!imm.dataStipula) return;
        const d = parseISODate(imm.dataStipula);
        if (!d) return;
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const bucket = buckets.find(b => b.key === key);
        if (!bucket) return;
        const provvCont = Number(imm.provvigioneContanti || 0);
        const provvTrac = Number(imm.provvigioneTracciata || 0);
        const provvTot = provvCont + provvTrac || Number(imm.provvigione || 0) || 0;
        bucket.total += provvTot;
      });

      const max = buckets.reduce((m, b) => Math.max(m, b.total), 0) || 1;
      const w = canvas.width || canvas.getBoundingClientRect().width || 300;
      const h = canvas.height || 140;
      const padding = 20;
      const innerW = w - padding * 2;
      const innerH = h - padding * 2;
      const barWidth = innerW / (buckets.length * 1.5);

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(padding, padding);

      buckets.forEach((b, idx) => {
        const x = idx * (barWidth * 1.5);
        const height = b.total > 0 ? (b.total / max) * (innerH - 20) : 0;
        const y = innerH - height;

        ctx.beginPath();
        ctx.rect(x, y, barWidth, height);
        ctx.fillStyle = '#22c55e';
        ctx.fill();

        ctx.font = '10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, x + barWidth / 2, innerH + 10);
      });

      ctx.restore();
    }

    function exportCsv(filename, rows) {
      if (!rows || !rows.length) {
        alert('Nessun dato da esportare.');
        return;
      }
      const headers = Object.keys(rows[0]);
      const esc = (v) => {
        if (v == null) return '';
        const str = String(v).replace(/"/g, '""');
        return `"${str}"`;
      };
      const csvLines = [];
      csvLines.push(headers.map(esc).join(';'));
      rows.forEach(row => {
        csvLines.push(headers.map(h => esc(row[h])).join(';'));
      });
      const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function exportImmobiliCsv() {
      const rows = (immobili || []).map(imm => ({
        Rif: imm.rif || '',
        Indirizzo: imm.indirizzo || '',
        Citta: imm.citta || '',
        Tipologia: imm.tipologia || '',
        Categoria: imm.categoria || '',
        Mq: imm.mq != null ? imm.mq : '',
        Prezzo: imm.prezzo != null ? imm.prezzo : '',
        Stato: imm.stato || '',
        Caldo: imm.caldo ? 'SI' : 'NO',
        Responsabile: (staff.find(s => s.id === imm.responsabileId) || {}).nome || ''
      }));
      exportCsv('immobili.csv', rows);
    }

    function exportNotizieCsv() {
      const rows = (notizie || []).map(n => ({
        Contatto: ((n.nome || '') + ' ' + (n.cognome || '')).trim(),
        Telefono: n.telefono || '',
        Email: n.email || '',
        Indirizzo: n.indirizzo || '',
        Citta: n.citta || '',
        Tipologia: n.tipologia || '',
        Piano: n.piano || '',
        Mq: n.mq != null ? n.mq : '',
        Caldo: n.caldo ? 'SI' : 'NO',
        Responsabile: (staff.find(s => s.id === n.responsabileId) || {}).nome || ''
      }));
      exportCsv('notizie.csv', rows);
    }

    function exportRubricaCsv() {
      const rows = (contatti || []).map(c => ({
        Nome: c.nome || '',
        Telefono: c.telefono || '',
        Email: c.email || '',
        Acquirente: c.isAcquirente ? 'SI' : 'NO',
        Venditore: c.isVenditore ? 'SI' : 'NO',
        Collaboratore: c.isCollaboratore ? 'SI' : 'NO',
        Altro: c.isAltro ? 'SI' : 'NO',
        Provenienza: c.provenienza || '',
        Note: c.note || ''
      }));
      exportCsv('rubrica_contatti.csv', rows);
    }

    function exportOperazioniCsv() {
      const ops = getOperazioniList();
      const rows = ops.map(imm => {
        const tipo = (imm.tipologia || '').toLowerCase().includes('affitto') ? 'Locazione' : 'Vendita';
        const valore = Number(imm.valoreCompravendita || imm.prezzo || 0);
        const provvCont = Number(imm.provvigioneContanti || 0);
        const provvTrac = Number(imm.provvigioneTracciata || 0);
        const provvTot = provvCont + provvTrac || Number(imm.provvigione || 0) || 0;
        return {
          Rif: imm.rif || '',
          Indirizzo: imm.indirizzo || '',
          DataStipula: imm.dataStipula || '',
          Tipo: tipo,
          Valore: valore,
          ProvvigioneTotale: provvTot,
          ProvvigioneContanti: provvCont,
          ProvvigioneTracciata: provvTrac
        };
      });
      exportCsv('operazioni_concluse.csv', rows);
    }

/* ====== AUTOCOMPLETE INDIRIZZI (stile Google-like con tendina opzioni) ======
   Usa Leaflet Control Geocoder (Nominatim) per scomporre: via+civico / CAP / città / provincia.
   - Se ci sono più risultati: mostra tendina sotto il campo.
   - Se selezioni un'opzione: compila i campi collegati.
*/
let __addrGeocoder = null;
function getAddrGeocoder() {
  try {
    if (__addrGeocoder) return __addrGeocoder;
    if (typeof L === 'undefined' || !L.Control || !L.Control.Geocoder) return null;
    __addrGeocoder = L.Control.Geocoder.nominatim({
      geocodingQueryParams: { countrycodes: 'it', addressdetails: 1 }
    });
    return __addrGeocoder;
  } catch { return null; }
}

function pickProvinceAbbrev(addr = {}) {
  const iso = addr['ISO3166-2-lvl6'] || addr['ISO3166-2-lvl5'] || '';
  if (typeof iso === 'string' && iso.includes('-')) return iso.split('-').pop().trim();
  const p = (addr.province || addr.state_district || addr.county || '').toString().trim();
  return p;
}

function normalizeStreet(addr = {}) {
  const road = (addr.road || addr.pedestrian || addr.cycleway || addr.footway || addr.path || '').toString().trim();
  const hn = (addr.house_number || '').toString().trim();
  if (!road && !hn) return '';
  return (road + ' ' + hn).trim();
}

function extractPartsFromGeocodeResult(r) {
  const props = r?.properties || {};
  const a = props.address || props;
  const cap = (a.postcode || '').toString().trim();
  const citta = (a.city || a.town || a.village || a.municipality || a.hamlet || '').toString().trim();
  const provincia = pickProvinceAbbrev(a);
  const street = normalizeStreet(a);
  return { street, cap, citta, provincia, label: r?.name || '' };
}

function ensureSuggestBox(inputEl) {
  if (!inputEl) return null;
  const parent = inputEl.closest('.form-group') || inputEl.parentElement;
  if (!parent) return null;
  parent.classList.add('has-addr-suggest');
  let box = parent.querySelector('.addr-suggest');
  if (!box) {
    box = document.createElement('div');
    box.className = 'addr-suggest';
    box.style.display = 'none';
    parent.appendChild(box);
  }
  return box;
}

function closeSuggest(box) {
  if (!box) return;
  box.innerHTML = '';
  box.style.display = 'none';
}

function setupAddressAutocomplete({ inputId, cityId, provId, capId }) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;
  const box = ensureSuggestBox(inputEl);
  const geocoder = getAddrGeocoder();
  if (!box || !geocoder) return;

  let t = null;
  let lastQ = '';

  const maybeSet = (el, val) => {
    if (!el || !val) return;
    const current = (el.value || '').trim();
    if (!current) { el.value = val; return; }
    if (current.toLowerCase() === val.toLowerCase()) return;
    const ok = confirm(`Sovrascrivere "${current}" con "${val}"?`);
    if (ok) el.value = val;
  };

  const applyParts = (parts) => {
    // street va SEMPRE nel campo input (indirizzo)
    if (parts.street) maybeSet(inputEl, parts.street);
    if (cityId) maybeSet(document.getElementById(cityId), parts.citta);
    if (provId) maybeSet(document.getElementById(provId), parts.provincia);
    if (capId) maybeSet(document.getElementById(capId), parts.cap);
  };

  const renderOptions = (results) => {
    box.innerHTML = '';
    if (!results || !results.length) { closeSuggest(box); return; }
    results.slice(0, 8).forEach((r) => {
      const parts = extractPartsFromGeocodeResult(r);
      const item = document.createElement('div');
      item.className = 'addr-suggest__item';
      item.innerHTML = `
        <div class="addr-suggest__main">${escapeHtml(parts.street || parts.label || 'Risultato')}</div>
        <div class="addr-suggest__sub">${escapeHtml([parts.cap, parts.citta, parts.provincia].filter(Boolean).join(' · '))}</div>
      `;
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        applyParts(parts);
        closeSuggest(box);
      });
      box.appendChild(item);
    });
    box.style.display = 'block';
  };

  const run = () => {
    const q = (inputEl.value || '').trim();
    if (q.length < 3) { closeSuggest(box); return; }
    if (q === lastQ) return;
    lastQ = q;
    geocoder.geocode(q, (results) => renderOptions(results || []));
  };

  inputEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(run, 220);
  });
  inputEl.addEventListener('focus', () => {
    if (box.innerHTML.trim()) box.style.display = 'block';
  });
  inputEl.addEventListener('blur', () => {
    setTimeout(() => closeSuggest(box), 180);
  });
}

  // Autofill indirizzo da condominio (Notizie / Immobili)
  document.getElementById('not-condominio')?.addEventListener('change', (e) => {
    applyCondominioAddressTo('not', e.target.value);
  });
  document.getElementById('imm-condominio')?.addEventListener('change', (e) => {
    applyCondominioAddressTo('imm', e.target.value);
  });

  // Editing notizie
  function startEditNotizia(notId) {
    const n = (notizie || []).find(x => x && x.id === notId);
    if (!n) return;
    const view = document.getElementById('view-immobili');
    // scroll nella sezione notizie (se esiste)
    document.getElementById('app-notizia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('not-id').value = n.id || '';
    document.getElementById('not-nome').value = n.nome || '';
    document.getElementById('not-cognome').value = n.cognome || '';
    document.getElementById('not-telefono').value = n.telefono || '';
    document.getElementById('not-email').value = n.email || '';
    document.getElementById('not-indirizzo').value = n.indirizzo || '';
    document.getElementById('not-citta').value = n.citta || '';
    document.getElementById('not-provincia').value = n.provincia || '';
    const condEl = document.getElementById('not-condominio');
    if (condEl) condEl.value = n.condominio || '';
    document.getElementById('not-tipologia').value = n.tipologia || '';
    document.getElementById('not-piano').value = n.piano || '';
    document.getElementById('not-mq').value = (n.mq != null ? n.mq : '');
    document.getElementById('not-caldo').checked = !!n.caldo;
    document.getElementById('not-note').value = n.note || '';

    const saveBtn = document.getElementById('not-save-btn');
    if (saveBtn) saveBtn.textContent = 'Salva modifiche';
    const cancelBtn = document.getElementById('not-cancel-edit');
    if (cancelBtn) cancelBtn.style.display = '';
  }

  document.getElementById('not-cancel-edit')?.addEventListener('click', () => {
    resetNotizieForm();
  });


/* ====== STAFF ====== */

    const STAFF_DEFAULT_COLORS = [
      '#f97373','#fb923c','#facc15','#4ade80',
      '#22c55e','#2dd4bf','#38bdf8','#60a5fa',
      '#a855f7','#ec4899'
    ];

    function staffEnsureColor(member, index) {
      if (member.colore) return member.colore;
      const used = new Set((staff || []).map(s => s.colore).filter(Boolean));
      let color = STAFF_DEFAULT_COLORS[index % STAFF_DEFAULT_COLORS.length];
      let i = 0;
      while (used.has(color) && i < STAFF_DEFAULT_COLORS.length) {
        color = STAFF_DEFAULT_COLORS[i++];
      }
      member.colore = color;
      saveList(STORAGE_KEYS.staff, staff);
      return color;
    }

    function staffCountAssignments(staffId) {
      const res = { notizie: 0, immobili: 0, attivita: 0, appuntamenti: 0 };
      (notizie || []).forEach(n => { if (n.responsabileId === staffId) res.notizie++; });
      (immobili || []).forEach(i => { if (i.responsabileId === staffId) res.immobili++; });
      (attivita || []).forEach(a => {
        if (a.responsabileId === staffId) {
          res.attivita++;
          if (a.tipo === 'appuntamento') res.appuntamenti++;
        }
      });
      return res;
    }

    function staffNavigateTo(tipo, staffId) {
      if (!staffId) return;
      if (tipo === 'notizie') setView('notizie');
      else if (tipo === 'immobili') setView('immobili');
      else setView('attivita');
      if (globalSearchInput) {
        globalSearchInput.value = staffId;
      }
    }

    function renderStaffTable() {
      const container = document.getElementById('staff-list-container');
      const staffFilterSel = document.getElementById('agenda-staff-filter');
      if (!container) return;
      container.innerHTML = '';

      // aggiorna filtro agenda staff
      if (staffFilterSel) {
        staffFilterSel.innerHTML = '<option value="tutti">Tutti</option>';
        (staff || []).forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.nome || '';
          staffFilterSel.appendChild(opt);
        });
      }

      const list = staff || [];
      if (!list.length) {
        const div = document.createElement('div');
        div.className = 'muted';
        div.textContent = 'Nessun membro staff. Usa "Nuovo membro" in basso a destra.';
        container.appendChild(div);
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';

      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Colore</th>
            <th>Nome</th>
            <th>Ruolo</th>
            <th>Contatti</th>
            <th>Riepilogo</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      list.forEach((m, idx) => {
        const tr = document.createElement('tr');
        const col = staffEnsureColor(m, idx);
        const stats = staffCountAssignments(m.id);
        const tdColor = document.createElement('td');
        const dot = document.createElement('span');
        dot.style.display = 'inline-block';
        dot.style.width = '14px';
        dot.style.height = '14px';
        dot.style.borderRadius = '999px';
        dot.style.background = col;
        dot.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.6)';
        tdColor.appendChild(dot);

        const tdNome = document.createElement('td');
        tdNome.textContent = m.nome || '';
        const tdRuolo = document.createElement('td');
        tdRuolo.textContent = m.ruolo || '';

        const tdContatti = document.createElement('td');
        const parts = [];
        if (m.telefono) parts.push('📞 ' + m.telefono);
        if (m.email) parts.push('✉️ ' + m.email);
        tdContatti.textContent = parts.join(' · ');

        const tdStats = document.createElement('td');
        tdStats.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:2px;font-size:11px;">
            <button class="btn btn-ghost btn-sm" data-staff="${m.id}" data-tipo="notizie" style="justify-content:flex-start;padding:2px 4px;">
              🔎 Notizie: <strong>${stats.notizie}</strong>
            </button>
            <button class="btn btn-ghost btn-sm" data-staff="${m.id}" data-tipo="immobili" style="justify-content:flex-start;padding:2px 4px;">
              🏠 Immobili: <strong>${stats.immobili}</strong>
            </button>
            <button class="btn btn-ghost btn-sm" data-staff="${m.id}" data-tipo="attivita" style="justify-content:flex-start;padding:2px 4px;">
              ✅ Attività: <strong>${stats.attivita}</strong>
            </button>
            <button class="btn btn-ghost btn-sm" data-staff="${m.id}" data-tipo="appuntamenti" style="justify-content:flex-start;padding:2px 4px;">
              📅 Appuntamenti: <strong>${stats.appuntamenti}</strong>
            </button>
          </div>
        `;

        const tdActions = document.createElement('td');
        tdActions.style.whiteSpace = 'nowrap';
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-outline';
        btnEdit.textContent = 'Modifica';
        btnEdit.addEventListener('click', () => staffOpenDialog(m));

        const btnAssign = document.createElement('button');
        btnAssign.className = 'btn btn-sm btn-outline';
        btnAssign.textContent = 'Assegna';
        btnAssign.addEventListener('click', () => staffOpenAssignDialog(m));

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-sm btn-danger';
        btnDel.innerHTML = '🗑️';
        btnDel.title = 'Elimina';
        btnDel.addEventListener('click', () => {
          if (!confirm(`Eliminare ${m.nome || 'questo membro'}?`)) return;
          const idx = staff.indexOf(m);
          if (idx >= 0) {
            staff.splice(idx, 1);
            saveList(STORAGE_KEYS.staff, staff);
            renderStaffTable();
            renderAgendaWeek();
          }
        });

        tdActions.appendChild(btnEdit);
        tdActions.appendChild(btnAssign);
        tdActions.appendChild(btnDel);

        tr.appendChild(tdColor);
        tr.appendChild(tdNome);
        tr.appendChild(tdRuolo);
        tr.appendChild(tdContatti);
        tr.appendChild(tdStats);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });

      wrap.appendChild(table);
      container.appendChild(wrap);

      container.querySelectorAll('button[data-staff]').forEach(btn => {
        btn.addEventListener('click', () => {
          const staffId = btn.getAttribute('data-staff');
          const tipo = btn.getAttribute('data-tipo');
          staffNavigateTo(tipo, staffId);
        });
      });
    }

    function staffOpenDialog(existing) {
      const overlay = document.getElementById('staff-dialog-overlay');
      const title = document.getElementById('staff-dialog-title');
      const idEl = document.getElementById('staff-id');
      const nomeEl = document.getElementById('staff-nome');
      const ruoloEl = document.getElementById('staff-ruolo');
      const colEl = document.getElementById('staff-colore');
      const telEl = document.getElementById('staff-telefono');
      const mailEl = document.getElementById('staff-email');
      const noteEl = document.getElementById('staff-note');

      if (!overlay) return;
      if (existing) {
        title.textContent = 'Modifica membro staff';
        idEl.value = existing.id;
        nomeEl.value = existing.nome || '';
        ruoloEl.value = existing.ruolo || '';
        colEl.value = existing.colore || '#22c55e';
        telEl.value = existing.telefono || '';
        mailEl.value = existing.email || '';
        noteEl.value = existing.note || '';
      } else {
        title.textContent = 'Nuovo membro staff';
        idEl.value = genId('stf');
        nomeEl.value = '';
        ruoloEl.value = '';
        colEl.value = '#22c55e';
        telEl.value = '';
        mailEl.value = '';
        noteEl.value = '';
      }
      overlay.style.display = 'flex';
    }

    function staffCloseDialog() {
      const overlay = document.getElementById('staff-dialog-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    function staffOpenAssignDialog(member) {
      const overlay = document.getElementById('staff-assign-overlay');
      const staffIdHidden = document.getElementById('staff-assign-staff-id');
      const title = document.getElementById('staff-assign-title');
      const tipoSel = document.getElementById('staff-assign-tipo');
      const voceSel = document.getElementById('staff-assign-voce');
      if (!overlay || !member) return;

      overlay.style.display = 'flex';
      if (staffIdHidden) staffIdHidden.value = member.id;
      if (title) title.textContent = `Assegna schede a ${member.nome || ''}`;
      if (tipoSel) tipoSel.value = 'immobili';
      buildStaffAssignOptions(voceSel, 'immobili');
    }

    function staffCloseAssignDialog() {
      const overlay = document.getElementById('staff-assign-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    function buildStaffAssignOptions(selectEl, tipo) {
      if (!selectEl) return;
      let list = [];
      if (tipo === 'immobili') list = immobili || [];
      else if (tipo === 'notizie') list = notizie || [];
      else list = attivita || [];
      selectEl.innerHTML = '<option value="">Seleziona…</option>';
      list.forEach(el => {
        if (!el || !el.id) return;
        const opt = document.createElement('option');
        opt.value = el.id;
        if (tipo === 'immobili') {
          opt.textContent = (el.rif || '') + ' ' + (el.indirizzo || '');
        } else if (tipo === 'notizie') {
          opt.textContent = (el.nome || '') + ' ' + (el.cognome || '');
        } else {
          const label = `[${formatDateIT(el.data)} ${el.ora || ''}] ${el.descrizione || el.tipo || ''}`;
          opt.textContent = label;
        }
        selectEl.appendChild(opt);
      });
    }

    // bind staff UI
    document.getElementById('btn-staff-add')?.addEventListener('click', () => staffOpenDialog(null));
    document.getElementById('staff-dialog-close')?.addEventListener('click', staffCloseDialog);
    document.getElementById('staff-dialog-cancel')?.addEventListener('click', staffCloseDialog);

    document.getElementById('staff-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('staff-id').value;
      const nome = document.getElementById('staff-nome').value.trim();
      if (!nome) { alert('Inserisci un nome.'); return; }
      const ruolo = document.getElementById('staff-ruolo').value.trim();
      const colore = document.getElementById('staff-colore').value || '#22c55e';
      const telefono = document.getElementById('staff-telefono').value.trim();
      const email = document.getElementById('staff-email').value.trim();
      const note = document.getElementById('staff-note').value.trim();

      if (!Array.isArray(staff)) staff = [];
      const existing = staff.find(s => s.id === id);
      if (existing) {
        existing.nome = nome;
        existing.ruolo = ruolo;
        existing.colore = colore;
        existing.telefono = telefono;
        existing.email = email;
        existing.note = note;
      } else {
        staff.push({ id, nome, ruolo, colore, telefono, email, note });
      }
      saveList(STORAGE_KEYS.staff, staff);
      staffCloseDialog();
      renderStaffTable();
      renderAgendaWeek();
    });

    document.getElementById('staff-assign-cancel-top')?.addEventListener('click', staffCloseAssignDialog);
    document.getElementById('staff-assign-cancel-bottom')?.addEventListener('click', staffCloseAssignDialog);

    document.getElementById('staff-assign-tipo')?.addEventListener('change', (e) => {
      const tipo = e.target.value;
      const select = document.getElementById('staff-assign-voce');
      buildStaffAssignOptions(select, tipo);
    });

    document.getElementById('staff-assign-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const staffId = document.getElementById('staff-assign-staff-id').value;
      const tipo = document.getElementById('staff-assign-tipo').value;
      const voceId = document.getElementById('staff-assign-voce').value;
      if (!staffId || !tipo || !voceId) {
        alert('Seleziona tipo ed elemento.');
        return;
      }
      if (tipo === 'immobili') {
        const el = (immobili || []).find(i => i.id === voceId);
        if (el) el.responsabileId = staffId;
        saveList(STORAGE_KEYS.immobili, immobili);
        renderImmobili();
      } else if (tipo === 'notizie') {
        const el = (notizie || []).find(n => n.id === voceId);
        if (el) el.responsabileId = staffId;
        saveList(STORAGE_KEYS.notizie, notizie);
        renderNotizie();
      } else {
        const el = (attivita || []).find(a => a.id === voceId);
        if (el) el.responsabileId = staffId;
        saveList(STORAGE_KEYS.attivita, attivita);
        renderAttivita();
        renderAgendaWeek();
      }
      staffCloseAssignDialog();
      renderStaffTable();
    });

    /* ====== OMI ====== */

    function renderOmi() {
      const tbody = document.getElementById('omi-body');
      if (!tbody) return;
      tbody.innerHTML = '';
      (omi || []).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.citta || ''}</td>
          <td>${row.zona || ''}</td>
          <td>${row.tipologia || ''}</td>
          <td>${row.min ? formatEuro(row.min) : ''}</td>
          <td>${row.max ? formatEuro(row.max) : ''}</td>
          <td><button class="btn btn-sm btn-danger">🗑️</button></td>
        `;
        tr.querySelector('button')?.addEventListener('click', () => {
          if (!confirm('Eliminare questo valore OMI?')) return;
          const idx = omi.indexOf(row);
          if (idx >= 0) {
            omi.splice(idx, 1);
            saveList(STORAGE_KEYS.omi, omi);
            renderOmi();
          }
        });
        tbody.appendChild(tr);
      });
    }

    document.getElementById('omi-new-btn')?.addEventListener('click', () => {
      const citta = prompt('Città:');
      if (!citta) return;
      const zona = prompt('Zona:') || '';
      const tipo = prompt('Tipologia (residenziale, commerciale…):', 'residenziale') || 'residenziale';
      const min = Number(prompt('€/mq minimo:', '3000') || 0);
      const max = Number(prompt('€/mq massimo:', '6000') || 0);
      omi.push({ id: genId('omi'), citta, zona, tipologia: tipo, min, max });
      saveList(STORAGE_KEYS.omi, omi);
      renderOmi();
    });

  /* ====== IA LOCALE (Mistral via Ollama) ====== */

  // Ollama deve essere avviato e avere il modello "mistral" disponibile:
  //   ollama pull mistral
  //   ollama run mistral
  const LOCAL_LLM_ENDPOINT = 'http://localhost:11434/api/generate';
  const LOCAL_LLM_MODEL = 'mistral';

  function aiSetStatus(text) {
    const status = document.getElementById('ai-status');
    if (status) status.textContent = text;
  }

  function aiAppendOutput(text) {
    const out = document.getElementById('ai-output');
    if (!out) return;
    if (out.textContent.includes('Nessun testo ancora generato')) {
      out.textContent = '';
    }
    const block = document.createElement('div');
    block.style.marginBottom = '8px';
    block.innerHTML = String(text).replace(/\n/g, '<br>');
    out.appendChild(block);
    out.scrollTop = out.scrollHeight;
  }

  async function aiGenerate() {
    const promptEl = document.getElementById('ai-prompt');
    if (!promptEl) return;
    const prompt = promptEl.value.trim();
    if (!prompt) {
      alert('Inserisci un prompt.');
      return;
    }

    const tone = document.getElementById('ai-tone')?.value || 'professionale';
    const type = document.getElementById('ai-output-type')?.value || 'altro';
    const len = document.getElementById('ai-length')?.value || 'media';
    const lang = document.getElementById('ai-language')?.value || 'italiano';
    const ctx = document.getElementById('ai-context')?.value.trim() || '';

    let systemPrompt = 'Sei un assistente che supporta un agente immobiliare italiano, generando testi giuridicamente sensati ma da far verificare al notaio o al legale.';
    systemPrompt += ` Tono: ${tone}. Tipo di testo: ${type}. Lunghezza: ${len}. Lingua: ${lang}.`;
    if (ctx) systemPrompt += ` Contesto aggiuntivo: ${ctx}.`;

    aiSetStatus('Contatto il modello locale (Mistral via Ollama)…');

    try {
      const res = await fetch(LOCAL_LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LOCAL_LLM_MODEL,
          prompt: systemPrompt + '\n\nTesto utente:\n' + prompt,
          stream: false
        })
      });

      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' - impossibile raggiungere ' + LOCAL_LLM_ENDPOINT);
      }

      const data = await res.json();
      const text =
        data.response ||                        // formato tipico Ollama
        (data.choices?.[0]?.message?.content) || // fallback stile OpenAI
        JSON.stringify(data);

      aiAppendOutput(text);
      aiSetStatus('Risposta ricevuta dal modello Mistral locale.');
    } catch (err) {
      aiSetStatus('Errore nella chiamata al modello locale (Mistral).');
      aiAppendOutput('[ERRORE MODELLO LOCALE]\n' + (err.message || String(err)));
    }
  }

  document.getElementById('ai-generate-btn')?.addEventListener('click', aiGenerate);

  document.getElementById('ai-clear-btn')?.addEventListener('click', () => {
    const promptEl = document.getElementById('ai-prompt');
    const ctxEl = document.getElementById('ai-context');
    const out = document.getElementById('ai-output');
    if (promptEl) promptEl.value = '';
    if (ctxEl) ctxEl.value = '';
    if (out) {
      out.textContent = 'Nessun testo ancora generato. Inserisci un prompt e premi “Genera testo”.';
    }
    aiSetStatus('Pronto. Assicurati che Mistral sia avviato in Ollama su http://localhost:11434/.');
  });

  document.getElementById('ai-copy-btn')?.addEventListener('click', async () => {
    const out = document.getElementById('ai-output');
    if (!out) return;
    const text = out.innerText || out.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      aiSetStatus('Testo copiato negli appunti.');
    } catch {
      aiSetStatus('Impossibile copiare negli appunti.');
    }
  });

  /* ====== ARCHIVIO INTESTAZIONI (HEADER + FOOTER) ====== */

  function getSelectedTemplate() {
    const select = document.getElementById('ai-letterhead-select');
    if (!select) return null;
    const id = select.value;
    if (!id) return null;
    return (intestazioni || []).find(t => t.id === id) || null;
  }

  function renderIntestazioniUI() {
    const select = document.getElementById('ai-letterhead-select');
    const list = document.getElementById('ai-templates-list');

    // Combo per scelta intestazione
    if (select) {
      const current = select.value;
      select.innerHTML = '';
      const baseOpt = document.createElement('option');
      baseOpt.value = '';
      baseOpt.textContent = 'Seleziona modello intestazione…';
      select.appendChild(baseOpt);

      (intestazioni || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name || 'Modello senza nome';
        select.appendChild(opt);
      });

      if (current && (intestazioni || []).some(t => t.id === current)) {
        select.value = current;
      }
    }

    // Lista archivio
    if (list) {
      if (!intestazioni || !intestazioni.length) {
        list.textContent = 'Nessun modello intestazione salvato.';
      } else {
        list.innerHTML = '';
        (intestazioni || []).forEach(t => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
          row.style.gap = '8px';
          row.style.padding = '2px 0';

          const label = document.createElement('span');
          label.textContent = t.name || 'Modello senza nome';

          const btn = document.createElement('button');
          btn.className = 'btn btn-xs';
          btn.textContent = '🗑️';
          btn.addEventListener('click', () => {
            if (!confirm('Eliminare questo modello di intestazione?')) return;
            const idx = intestazioni.indexOf(t);
            if (idx >= 0) {
              intestazioni.splice(idx, 1);
              saveList(STORAGE_KEYS.intestazioni, intestazioni);
              renderIntestazioniUI();
            }
          });

          row.appendChild(label);
          row.appendChild(btn);
          list.appendChild(row);
        });
      }
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Errore lettura file.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleAddIntestazione() {
    const nameInput = document.getElementById('ai-template-name');
    const headerInput = document.getElementById('ai-template-header');
    const footerInput = document.getElementById('ai-template-footer');
    if (!nameInput || !headerInput || !footerInput) return;

    const name = (nameInput.value || '').trim();
    const headerFile = headerInput.files?.[0] || null;
    const footerFile = footerInput.files?.[0] || null;

    if (!name) {
      alert('Inserisci un nome per il modello di intestazione.');
      return;
    }
    if (!headerFile && !footerFile) {
      alert('Carica almeno un file per header o footer.');
      return;
    }

    let headerDataUrl = null;
    let footerDataUrl = null;

    if (headerFile) {
      if (!headerFile.type.startsWith('image/')) {
        alert('Per ora sono supportate solo immagini (JPG/PNG) per l\'header.');
      } else {
        headerDataUrl = await readFileAsDataUrl(headerFile);
      }
    }

    if (footerFile) {
      if (!footerFile.type.startsWith('image/')) {
        alert('Per ora sono supportate solo immagini (JPG/PNG) per il footer.');
      } else {
        footerDataUrl = await readFileAsDataUrl(footerFile);
      }
    }

    const template = {
      id: genId('int'),
      name,
      headerDataUrl,
      footerDataUrl
    };

    intestazioni.push(template);
    saveList(STORAGE_KEYS.intestazioni, intestazioni);

    nameInput.value = '';
    headerInput.value = '';
    footerInput.value = '';

    renderIntestazioniUI();
    aiSetStatus('Modello intestazione salvato.');
  }

  document.getElementById('ai-add-template-btn')?.addEventListener('click', () => {
    handleAddIntestazione().catch(err => {
      console.error(err);
      alert('Errore nel salvataggio dell\'intestazione.');
    });
  });

  /* ====== EXPORT WORD / PDF ====== */

  function buildDocHtml(rawText, template) {
    const safeText = (rawText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const bodyHtml = safeText.split('\n').join('<br>');

    const headerHtml = template?.headerDataUrl
      ? `<div style="text-align:center;margin-bottom:16px;">
           <img src="${template.headerDataUrl}" style="max-height:120px;"><hr>
         </div>`
      : '';

    const footerHtml = template?.footerDataUrl
      ? `<hr><div style="text-align:center;margin-top:16px;">
           <img src="${template.footerDataUrl}" style="max-height:80px;">
         </div>`
      : '';

    return `
<html>
<head><meta charset="UTF-8"></head>
<body>
${headerHtml}
<div>${bodyHtml}</div>
${footerHtml}
</body>
</html>`;
  }

  function aiExportWord() {
    const out = document.getElementById('ai-output');
    if (!out) return;
    const rawText = out.innerText || out.textContent || '';
    if (!rawText.trim()) {
      alert('Non c\'è alcun testo generato da esportare.');
      return;
    }

    const titleInput = document.getElementById('ai-doc-title');
    let filename = (titleInput?.value || '').trim() || 'documento_ai';
    filename = filename.replace(/[\\/:*?"<>|]+/g, '_');

    const useLetterhead = document.getElementById('ai-use-letterhead')?.checked;
    const template = useLetterhead ? getSelectedTemplate() : null;

    if (useLetterhead && !template) {
      alert('Hai attivato l\'intestazione ma non hai selezionato alcun modello.');
      return;
    }

    const html = buildDocHtml(rawText, template);
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    aiSetStatus('Documento Word esportato.');
  }

  document.getElementById('ai-word-btn')?.addEventListener('click', aiExportWord);

  function inferImageFormat(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
    return null;
  }

  function aiExportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Libreria jsPDF non trovata. Verifica di aver incluso lo script nel <head>.');
      return;
    }

    const out = document.getElementById('ai-output');
    if (!out) return;
    const rawText = out.innerText || out.textContent || '';
    if (!rawText.trim()) {
      alert('Non c\'è alcun testo generato da esportare.');
      return;
    }

    const useLetterhead = document.getElementById('ai-use-letterhead')?.checked;
    const template = useLetterhead ? getSelectedTemplate() : null;

    if (useLetterhead && !template) {
      alert('Hai attivato l\'intestazione ma non hai selezionato alcun modello.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const hasHeader = !!template?.headerDataUrl && !!inferImageFormat(template.headerDataUrl);
    const hasFooter = !!template?.footerDataUrl && !!inferImageFormat(template.footerDataUrl);

    const topMargin = hasHeader ? 140 : 60;
    const bottomMargin = hasFooter ? 100 : 60;
    const textWidth = pageWidth - 80;

    const headerFormat = hasHeader ? inferImageFormat(template.headerDataUrl) : null;
    const footerFormat = hasFooter ? inferImageFormat(template.footerDataUrl) : null;

    function drawHeader() {
      if (!hasHeader) return;
      try {
        doc.addImage(
          template.headerDataUrl,
          headerFormat,
          40,
          30,
          pageWidth - 80,
          80
        );
      } catch {}
    }

    function drawFooter() {
      if (!hasFooter) return;
      try {
        doc.addImage(
          template.footerDataUrl,
          footerFormat,
          40,
          pageHeight - 80,
          pageWidth - 80,
          40
        );
      } catch {}
    }

    drawHeader();

    const lines = doc.splitTextToSize(rawText, textWidth);
    let y = topMargin;

    lines.forEach(line => {
      if (y > pageHeight - bottomMargin) {
        doc.addPage();
        drawHeader();
        y = topMargin;
      }
      doc.text(line, 40, y);
      y += 14;
    });

    if (hasFooter) {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter();
      }
    }

    const titleInput = document.getElementById('ai-doc-title');
    let filename = (titleInput?.value || '').trim() || 'documento_ai';
    filename = filename.replace(/[\\/:*?"<>|]+/g, '_');

    doc.save(filename + '.pdf');
    aiSetStatus('PDF esportato.');
  }

  document.getElementById('ai-pdf-btn')?.addEventListener('click', aiExportPdf);

    /* ====== MAPPA (immobili + notizie) ====== */

    let mappa = null;
    let mappaCluster = null;
    let mappaSelectedItem = null;
    let mappaBaseStreet = null;
    let mappaBaseSatellite = null;
    let mappaLayerControl = null;


    // Stato interno mappa (evita doppie inizializzazioni / fitBounds aggressivi)
    let mappaUiBound = false;
    let mappaUserInteracted = false;
    let mappaAutoFitted = false;
    let mappaLastFitSig = '';


    // Marker ricerca indirizzo (Nominatim)
    let mappaSearchMarker = null;

    function ensureMappaSearchUI() {
      const actions = document.querySelector('#view-mappa .card .card-header .card-actions');
      if (!actions) return;

      // Evita duplicati
      if (document.getElementById('mappa-address-search')) return;

      const wrap = document.createElement('div');
      wrap.className = 'form-group';
      wrap.id = 'mappa-address-search';
      wrap.style.minWidth = '260px';

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'mappa-search';
      input.placeholder = 'Cerca indirizzo…';
      input.style.width = '100%';

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '6px';
      btnRow.style.marginTop = '4px';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.id = 'mappa-search-btn';
      btn.textContent = 'Cerca';

      const btnClear = document.createElement('button');
      btnClear.type = 'button';
      btnClear.className = 'btn btn-sm btn-ghost';
      btnClear.id = 'mappa-search-clear';
      btnClear.textContent = 'Pulisci';

      btnRow.appendChild(btn);
      btnRow.appendChild(btnClear);

      wrap.appendChild(input);
      wrap.appendChild(btnRow);

      // Inserisci all'inizio dei controlli per non spostare troppo la UI
      actions.insertBefore(wrap, actions.firstChild);

      const run = () => {
        const q = (input.value || '').trim();
        if (!q) return;
        searchAddressOnMap(q);
      };

      btn.addEventListener('click', run);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          run();
        }
      });

      btnClear.addEventListener('click', () => {
        input.value = '';
        if (mappaSearchMarker && mappa) {
          try { mappa.removeLayer(mappaSearchMarker); } catch {}
        }
        mappaSearchMarker = null;
      });
    
      /* ====== POLIGONI (Area ricerca + Condomini) ====== */
      if (!document.getElementById('mappa-poligoni-tools')) {
        const tools = document.createElement('div');
        tools.id = 'mappa-poligoni-tools';
        tools.className = 'mappa-poligoni-tools';

        const btnArea = document.createElement('button');
        btnArea.type = 'button';
        btnArea.className = 'btn btn-sm';
        btnArea.id = 'btn-draw-area';
        btnArea.title = 'Disegna area ricerca';
        btnArea.textContent = '✏️ Area';

        const btnCondo = document.createElement('button');
        btnCondo.type = 'button';
        btnCondo.className = 'btn btn-sm';
        btnCondo.id = 'btn-draw-condo';
        btnCondo.title = 'Disegna poligono condominio';
        btnCondo.textContent = '🏢 Condominio';

        const btnToggle = document.createElement('button');
        btnToggle.type = 'button';
        btnToggle.className = 'btn btn-sm';
        btnToggle.id = 'btn-toggle-poligoni';
        btnToggle.title = 'Mostra/Nasconde livello poligoni';
        btnToggle.textContent = '👁️ Poligoni';

        const btnList = document.createElement('button');
        btnList.type = 'button';
        btnList.className = 'btn btn-sm';
        btnList.id = 'btn-list-condomini';
        btnList.title = 'Apri lista condomini';
        btnList.textContent = '📁 Condomini';

        tools.appendChild(btnArea);
        tools.appendChild(btnCondo);
        tools.appendChild(btnToggle);
        tools.appendChild(btnList);

        actions.appendChild(tools);
      }
}

    async function searchAddressOnMap(query) {
      if (!mappa) return;
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=' + encodeURIComponent(query);

      try {
        // Nota: Nominatim ha policy anti-abuso; evitiamo chiamate ripetute inutili
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) {
          alert('Nessun risultato trovato per: ' + query);
          return;
        }
        const hit = data[0];
        const lat = Number(hit.lat);
        const lon = Number(hit.lon);
        if (!isFinite(lat) || !isFinite(lon)) {
          alert('Risultato non valido.');
          return;
        }

        const label = hit.display_name || query;

        if (mappaSearchMarker) {
          try { mappa.removeLayer(mappaSearchMarker); } catch {}
          mappaSearchMarker = null;
        }

        mappaSearchMarker = L.marker([lat, lon], { title: label });
        mappaSearchMarker.addTo(mappa);
        mappaSearchMarker.bindPopup('<strong>📍 Ricerca</strong><br>' + escapeHtml(label)).openPopup();

        // Centra con un po' di zoom
        mappa.setView([lat, lon], Math.max(14, mappa.getZoom() || 14), { animate: true });
      } catch (e) {
        console.warn('[MAPPA] Errore ricerca indirizzo', e);
        alert('Errore durante la ricerca indirizzo. Controlla la connessione.');
      }
    }

function initMappa() {
      const mapEl = document.getElementById('map');
      if (!mapEl) return;
      // UI ricerca indirizzo
      ensureMappaSearchUI();

      // Se la mappa esiste già: evita re-init e forza ricalcolo dimensioni (Leaflet in tab nascosti fa spesso “mappa grigia”)
      if (mappa) {
        setTimeout(() => { try { mappa.invalidateSize(true); } catch {} }, 120);
        renderMappa();
        return;
      }

      // Prima inizializzazione
      mappa = L.map('map', { preferCanvas: true }).setView([45.0703, 7.6869], 8); // Nord Ovest Italia

      // Base layers (Strade / Satellite)
      mappaBaseStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      });

      // Satellite (Esri World Imagery) – no API key
      mappaBaseSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri'
      });

      // Default: Strade
      mappaBaseStreet.addTo(mappa);

      // Toggle layer control (added once)
      if (!mappaLayerControl) {
        try {
          mappaLayerControl = L.control.layers(
            { 'Strade': mappaBaseStreet, 'Satellite': mappaBaseSatellite },
            {},
            { position: 'topright' }
          ).addTo(mappa);
        } catch (e) {
          console.warn('[MAPPA] Layer control non disponibile:', e);
        }
      }

      mappaCluster = L.markerClusterGroup();
      mappa.addLayer(mappaCluster);

      // Traccia interazioni utente: se l’utente ha mosso/zoomato, non rifacciamo fitBounds a ogni filtro
      mappa.on('movestart', () => { mappaUserInteracted = true; });
      mappa.on('zoomstart', () => { mappaUserInteracted = true; });

      // Bind UI una sola volta
      if (!mappaUiBound) {
        const closeBtn = document.getElementById('map-detail-close');
        if (closeBtn) closeBtn.addEventListener('click', hideMapDetail);

        const openBtn = document.getElementById('map-detail-open-btn');
        if (openBtn) {
          openBtn.addEventListener('click', () => {
            if (!mappaSelectedItem) return;
            if (mappaSelectedItem.tipo === 'immobile') openSchedaImmobile(mappaSelectedItem.id);
            else if (mappaSelectedItem.tipo === 'notizia') openSchedaNotizia(mappaSelectedItem.id);
          });
        }

        // Eventi filtri: de-dup (alcuni listener erano duplicati nel file)
        const bind = (id, ev) => {
          const el = document.getElementById(id);
          if (!el) return;
          const key = `__bound_${id}_${ev}`;
          if (el[key]) return;
          el.addEventListener(ev, () => {
            // quando si cambia filtro, permettiamo un fit (una tantum) se l’utente non ha ancora interagito
            mappaAutoFitted = false;
            renderMappa();
          });
          el[key] = true;
        };
        bind('mappa-filter', 'change');
        bind('mappa-tipologia', 'change');
        bind('mappa-stato', 'change');
        bind('mappa-solo-caldo', 'change');
        bind('mappa-prezzo-min', 'input');
        bind('mappa-prezzo-max', 'input');
        bind('mappa-mq-min', 'input');
        bind('mappa-mq-max', 'input');

        const btnImm = document.getElementById('mappa-geocode-imm');
        if (btnImm && !btnImm.__bound_click) {
          btnImm.addEventListener('click', () => geocodeMancanti('immobili'));
          btnImm.__bound_click = true;
        }
        const btnNot = document.getElementById('mappa-geocode-not');
        if (btnNot && !btnNot.__bound_click) {
          btnNot.addEventListener('click', () => geocodeMancanti('notizie'));
          btnNot.__bound_click = true;
        }

        mappaUiBound = true;
      }

      setTimeout(() => { try { mappa.invalidateSize(true); } catch {} }, 120);
      renderMappa();
    
      // Init livello poligoni (aree + condomini)
      try { initPoligoniModule(); } catch (e) { console.warn('[POLIGONI] init error', e); }
}


/* ======================================================
   MAPPA – LIVELLO POLIGONI (AREE + CONDOMINI)
   - 2 tipi: "area" (delimitazione ricerca), "condominio" (cartella)
   - chiusura poligono: clic sul 1° vertice (ancora) oppure doppio click
   - alla chiusura "condominio" apre UI (nome + indirizzo) e salva in archivio
====================================================== */

let mappaPoligoni = { aree: [], condomini: [] };
let mappaPoligoniVisible = true;

// Layer groups
let layerPoligoniRoot = null;
let layerAree = null;
let layerCondomini = null;

// Drawing state
let drawingMode = null; // 'area' | 'condominio' | null
let drawingPoints = [];
let drawingLine = null;
let drawingVertices = null;
let drawingFirstVertex = null;

function loadPoligoni() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.poligoni);
    if (!raw) return { aree: [], condomini: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { aree: [], condomini: [] };
    return {
      aree: Array.isArray(parsed.aree) ? parsed.aree : [],
      condomini: Array.isArray(parsed.condomini) ? parsed.condomini : []
    };
  } catch (e) {
    console.warn('[POLIGONI] load error', e);
    return { aree: [], condomini: [] };
  }
}

function savePoligoni() {
  try { localStorage.setItem(STORAGE_KEYS.poligoni, JSON.stringify(mappaPoligoni)); }
  catch (e) { console.warn('[POLIGONI] save error', e); }
}


function getCondominioByNome(nome) {
  const n = (nome || '').trim().toLowerCase();
  if (!n) return null;
  const pol = loadPoligoni();
  const list = (pol && Array.isArray(pol.condomini)) ? pol.condomini : [];
  return list.find(c => ((c.nome || '').trim().toLowerCase() === n)) || null;
}

function formatCondominioAddress(condo) {
  if (!condo) return '';
  const parts = [];
  const a = (condo.indirizzo || '').trim();
  const c = (condo.citta || '').trim();
  const p = (condo.provincia || '').trim();
  if (a) parts.push(a);
  if (c) parts.push(c);
  if (p) parts.push(p);
  return parts.join(', ');
}

function applyCondominioAddressTo(prefix, condoName) {
  const condo = getCondominioByNome(condoName);
  if (!condo) return;

  const target = {
    indirizzo: (condo.indirizzo || '').trim(),
    citta: (condo.citta || '').trim(),
    provincia: (condo.provincia || '').trim()
  };

  // Se non abbiamo nulla da applicare, esci
  if (!target.indirizzo && !target.citta && !target.provincia) return;

  const els = {
    indirizzo: document.getElementById(prefix + '-indirizzo'),
    citta: document.getElementById(prefix + '-citta'),
    provincia: document.getElementById(prefix + '-provincia')
  };

  // Se i campi della scheda non esistono, esci
  if (!els.indirizzo && !els.citta && !els.provincia) return;

  const current = {
    indirizzo: (els.indirizzo?.value || '').trim(),
    citta: (els.citta?.value || '').trim(),
    provincia: (els.provincia?.value || '').trim()
  };

  // Applica in automatico solo dove vuoto
  let needsConfirm = false;
  const diffs = [];

  (['indirizzo','citta','provincia']).forEach(k => {
    if (!els[k]) return;
    const cur = current[k];
    const tar = target[k];
    if (!tar) return;

    if (!cur) {
      // riempi subito
      els[k].value = tar;
    } else if (cur !== tar) {
      needsConfirm = true;
      diffs.push({ field: k, from: cur, to: tar });
    }
  });

  if (needsConfirm) {
    const pretty = (k) => (k === 'indirizzo' ? 'Indirizzo' : (k === 'citta' ? 'Città' : 'Provincia'));
    const msg = [
      'Vuoi sostituire i dati indirizzo con quelli del Condominio?',
      'Condominio: ' + (condo.nome || ''),
      'Dati condominio: ' + formatCondominioAddress(condo),
      '',
      'Differenze rilevate:',
      ...diffs.map(d => `- ${pretty(d.field)}: "${d.from}" → "${d.to}"`)
    ].join('\n');

    if (confirm(msg)) {
      diffs.forEach(d => {
        if (els[d.field]) els[d.field].value = d.to;
      });
    }
  }
}


function ensurePoligoniLayers() {
  if (!mappa) return;
  if (!layerPoligoniRoot) {
    layerPoligoniRoot = L.layerGroup();
    layerAree = L.layerGroup();
    layerCondomini = L.layerGroup();
    layerPoligoniRoot.addLayer(layerAree);
    layerPoligoniRoot.addLayer(layerCondomini);
  }
  if (mappaPoligoniVisible) {
    if (!mappa.hasLayer(layerPoligoniRoot)) layerPoligoniRoot.addTo(mappa);
  } else {
    if (mappa.hasLayer(layerPoligoniRoot)) mappa.removeLayer(layerPoligoniRoot);
  }
}

function clearPoligoniMap() {
  try { layerAree && layerAree.clearLayers(); } catch {}
  try { layerCondomini && layerCondomini.clearLayers(); } catch {}
}

function polygonStyle(kind) {
  // stile più leggibile: linee evidenti e riempimento leggero
  if (kind === 'condominio') {
    return { color: '#2563EB', weight: 3, opacity: 0.95, fillColor: '#2563EB', fillOpacity: 0.10, dashArray: null };
  }
  return { color: '#111827', weight: 3, opacity: 0.85, fillColor: '#111827', fillOpacity: 0.06, dashArray: '6,6' };
}

function addPolygonToMap(rec) {
  if (!mappa || !rec || !Array.isArray(rec.latlngs)) return;
  const latlngs = rec.latlngs.map(p => [p.lat, p.lng]);

  const kind = rec.kind;
  const layer = L.polygon(latlngs, polygonStyle(kind));

  layer.__polyId = rec.id;
  layer.__polyKind = kind;

  // Tooltip/label
  if (kind === 'condominio') {
    const label = (rec.nome || 'Condominio');
    layer.bindTooltip(label, { sticky: true, direction: 'top' });
    layer.on('click', () => openCondominioPanel(rec.id));
    layerCondomini && layerCondomini.addLayer(layer);
  } else {
    layer.bindTooltip('Area ricerca', { sticky: true, direction: 'top' });
    layerAree && layerAree.addLayer(layer);
  }
}

function renderPoligoni() {
  ensurePoligoniLayers();
  clearPoligoniMap();
  (mappaPoligoni.aree || []).forEach(addPolygonToMap);
  (mappaPoligoni.condomini || []).forEach(addPolygonToMap);
  renderCondominiList();
}

function setDrawingCursor(active) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  mapEl.classList.toggle('drawing-active', !!active);
}

function stopDrawing(resetOnly=false) {
  drawingMode = null;
  setDrawingCursor(false);
  if (!resetOnly) {
    try { drawingLine && mappa.removeLayer(drawingLine); } catch {}
    try { drawingVertices && mappa.removeLayer(drawingVertices); } catch {}
  }
  drawingPoints = [];
  drawingLine = null;
  drawingVertices = null;
  drawingFirstVertex = null;
}

function startDrawing(mode) {
  if (!mappa) return;
  ensurePoligoniLayers();
  stopDrawing();
  drawingMode = mode;
  setDrawingCursor(true);
  drawingVertices = L.layerGroup().addTo(mappa);
  drawingLine = L.polyline([], { weight: 3, opacity: 1.0, dashArray: '4,6' }).addTo(mappa);
}

function addVertexMarker(latlng, isFirst=false) {
  if (!drawingVertices) return null;
  const marker = L.circleMarker(latlng, {
    radius: isFirst ? 7 : 6,
    weight: 2,
    opacity: 1,
    fillOpacity: 1,
    color: isFirst ? '#111827' : '#111827',
    fillColor: isFirst ? '#F59E0B' : '#60A5FA'
  });
  marker.addTo(drawingVertices);
  marker._isFirstVertex = !!isFirst;

  // L'ancora (1° vertice) chiude il poligono
  if (isFirst) {
    marker.on('click', () => {
      if (drawingMode && drawingPoints.length >= 3) finalizePolygon();
    });
  }
  return marker;
}

function onMapClickForDrawing(e) {
  if (!drawingMode || !e || !e.latlng) return;

  drawingPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
  drawingLine && drawingLine.setLatLngs(drawingPoints.map(p => [p.lat, p.lng]));

  if (drawingPoints.length === 1) {
    drawingFirstVertex = addVertexMarker(e.latlng, true);
  } else {
    addVertexMarker(e.latlng, false);
  }
}

function onMapDblClickForDrawing(e) {
  if (!drawingMode) return;
  // dblclick chiude comunque (se sufficiente)
  if (drawingPoints.length >= 3) {
    try { L.DomEvent.stop(e); } catch {}
    finalizePolygon();
  }
}

function openCondominioModal(initialNome='', initialIndirizzo='', initialCitta='', initialProvincia='', initialCap='') {
  const modal = document.getElementById('condominio-modal');
  if (!modal) {
    alert('UI condominio non trovata (condominio-modal).');
    return null;
  }
  const nameEl = document.getElementById('condominio-nome');
  const addrEl = document.getElementById('condominio-indirizzo');
  const cityEl = document.getElementById('condominio-citta');
  const provEl = document.getElementById('condominio-provincia');
  const capEl = document.getElementById('condominio-cap');
  if (nameEl) nameEl.value = initialNome || '';
  if (addrEl) addrEl.value = initialIndirizzo || '';
  if (cityEl) cityEl.value = initialCitta || '';
  if (provEl) provEl.value = initialProvincia || '';
  if (capEl) capEl.value = initialCap || '';

  modal.classList.add('open');
  setTimeout(() => { try { nameEl && nameEl.focus(); } catch {} }, 0);

  return new Promise((resolve) => {
    const btnSave = document.getElementById('condominio-save');
    const btnCancel = document.getElementById('condominio-cancel');
    const btnClose = document.getElementById('condominio-close');

    const cleanup = () => {
      [btnSave, btnCancel, btnClose].forEach(b => b && b.removeEventListener('click', onSaveOrCancel));
    };

    const onSaveOrCancel = (ev) => {
      const id = ev?.currentTarget?.id;
      if (id === 'condominio-save') {
        const nome = (nameEl?.value || '').trim();
        const indirizzo = (addrEl?.value || '').trim();
        const citta = (cityEl?.value || '').trim();
        const provincia = (provEl?.value || '').trim();
        const cap = (capEl?.value || '').trim();
        if (!nome) { alert('Inserisci un nome condominio.'); return; }
        modal.classList.remove('open');
        cleanup();
        resolve({ ok: true, nome, indirizzo, citta, provincia, cap });
      } else {
        modal.classList.remove('open');
        cleanup();
        resolve({ ok: false });
      }
    };

    btnSave && btnSave.addEventListener('click', onSaveOrCancel);
    btnCancel && btnCancel.addEventListener('click', onSaveOrCancel);
    btnClose && btnClose.addEventListener('click', onSaveOrCancel);
  });
}

async function finalizePolygon() {
  if (!drawingMode) return;
  if (drawingPoints.length < 3) return;

  const latlngs = [...drawingPoints];
  const kind = drawingMode;

  // Reset drawing UI immediately (così non resta “appeso”)
  stopDrawing(true);

  if (kind === 'condominio') {
    const res = await openCondominioModal('', '');
    if (!res || !res.ok) {
      // annullato: niente salvataggio
      stopDrawing();
      return;
    }
    const rec = {
      id: genId('condo'),
      kind: 'condominio',
      nome: res.nome,
      indirizzo: res.indirizzo || '',
      citta: res.citta || '',
      provincia: res.provincia || '',
      cap: res.cap || '',
      latlngs,
      createdAt: Date.now()
    };
    mappaPoligoni.condomini.push(rec);
    savePoligoni();
    renderPoligoni();
    updateCondominiDatalist();
    renderCondominiList();
    // zoom sul nuovo poligono
    try { mappa.fitBounds(L.polygon(latlngs.map(p=>[p.lat,p.lng])).getBounds(), { padding: [20,20] }); } catch {}
    openCondominioPanel(rec.id);
  } else {
    const rec = {
      id: genId('area'),
      kind: 'area',
      latlngs,
      createdAt: Date.now()
    };
    mappaPoligoni.aree.push(rec);
    savePoligoni();
    renderPoligoni();
    try { mappa.fitBounds(L.polygon(latlngs.map(p=>[p.lat,p.lng])).getBounds(), { padding: [20,20] }); } catch {}
  }

  stopDrawing();
}

/* ====== Pannello condomini (lista + contenuto) ====== */
function ensureCondominiPanel() {
  const mapWrap = document.getElementById('view-mappa');
  if (!mapWrap) return;
  if (document.getElementById('condomini-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'condomini-panel';
  panel.className = 'condomini-panel';
  panel.innerHTML = `
    <div class="condomini-panel__header">
      <div class="condomini-panel__title">Condomini</div>
      <button type="button" class="condomini-panel__close" id="condomini-panel-close">✕</button>
    </div>
    <div class="condomini-panel__body">
      <div id="condomini-list" class="condomini-list"></div>
      <div id="condominio-detail" class="condominio-detail" style="display:none;"></div>
    </div>
  `;
  mapWrap.appendChild(panel);

  const closeBtn = panel.querySelector('#condomini-panel-close');
  closeBtn && closeBtn.addEventListener('click', () => panel.classList.remove('open'));
}

function updateCondominiDatalist() {
  const dl = document.getElementById('condomini-datalist');
  if (!dl) return;
  dl.innerHTML = '';
  const arr = (mappaPoligoni.condomini || []).slice().sort((a,b)=> (a.nome||'').localeCompare(b.nome||''));
  arr.forEach(c => {
    if (!c || !c.nome) return;
    const opt = document.createElement('option');
    opt.value = c.nome;
    dl.appendChild(opt);
  });
}

function renderCondominiList() {
  ensureCondominiPanel();
  updateCondominiDatalist();
  const listEl = document.getElementById('condomini-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const arr = (mappaPoligoni.condomini || []).slice().sort((a,b)=> (a.nome||'').localeCompare(b.nome||''));
  if (!arr.length) {
    listEl.innerHTML = `<div class="muted">Nessun condominio censito.</div>`;
    return;
  }

  arr.forEach(c => {
    const item = document.createElement('div');
    item.className = 'condominio-item';
    const key = (c.nome || '').trim().toLowerCase();
    const immCount = (immobili || []).filter(im => ((im.condominio || '').trim().toLowerCase() === key)).length;
    const notCount = (notizie || []).filter(n => ((n.condominio || '').trim().toLowerCase() === key)).length;
    item.innerHTML = `
      <div class="condominio-item__name">${escapeHtml(c.nome || 'Condominio')}</div>
      <div class="condominio-item__addr">${escapeHtml(formatCondominioAddress(c) || '')}</div>
      <div class="condominio-item__meta">${immCount} immobili · ${notCount} notizie</div>
    `;
    item.addEventListener('click', () => {
      try {
        const bounds = L.polygon(c.latlngs.map(p=>[p.lat,p.lng])).getBounds();
        mappa.fitBounds(bounds, { padding: [20,20] });
      } catch {}
      openCondominioPanel(c.id);
    });
    listEl.appendChild(item);
  });
}

function openCondominioPanel(condoId) {
  ensureCondominiPanel();
  const panel = document.getElementById('condomini-panel');
  const detail = document.getElementById('condominio-detail');
  if (!panel || !detail) return;

  const c = (mappaPoligoni.condomini || []).find(x => x.id === condoId);
  if (!c) return;

  panel.classList.add('open');

  // filtra contenuti associati per nome condominio (immobili + notizie)
  const key = (c.nome || '').trim().toLowerCase();
  const contenutiImm = (immobili || []).filter(im => ((im.condominio || '').trim().toLowerCase() === key));
  const contenutiNot = (notizie || []).filter(n => ((n.condominio || '').trim().toLowerCase() === key));

  detail.style.display = 'block';
  detail.innerHTML = `
    <div class="condominio-detail__head">
      <div>
        <div class="condominio-detail__name">${escapeHtml(c.nome || 'Condominio')}</div>
        <div class="condominio-detail__addr">${escapeHtml(formatCondominioAddress(c) || '')}</div>
      </div>
      <div class="condominio-detail__count">${contenutiImm.length} immobili · ${contenutiNot.length} notizie</div>
    </div>

    <div class="condominio-detail__section">
      <div class="condominio-detail__section-title">🏠 Immobili</div>
      <div class="condominio-detail__list">
        ${contenutiImm.map(im => `
          <div class="condominio-imm in-condominio-immobile">
            <div class="condominio-imm__main">
              <div class="condominio-imm__rif">${escapeHtml(im.rif || im.id || '')}</div>
              <div class="condominio-imm__addr">${escapeHtml(im.indirizzo || '')}</div>
            </div>
            <button type="button" class="btn btn-sm" data-open-imm="${escapeHtml(im.id)}">Apri</button>
          </div>
        `).join('') || `<div class="muted">Nessun immobile associato (compila il campo “Condominio” nella scheda immobile).</div>`}
      </div>
    </div>

    <div class="condominio-detail__section" style="margin-top:10px;">
      <div class="condominio-detail__section-title">🧾 Notizie</div>
      <div class="condominio-detail__list">
        ${contenutiNot.map(n => {
          const nome = ((n.nome || '') + ' ' + (n.cognome || '')).trim() || '—';
          const addr = [n.indirizzo || '', n.citta || ''].filter(Boolean).join(' - ');
          return `
            <div class="condominio-imm condominio-notizia">
              <div class="condominio-imm__main">
                <div class="condominio-imm__rif">${escapeHtml(nome)}</div>
                <div class="condominio-imm__addr">${escapeHtml(addr)}</div>
              </div>
              <button type="button" class="btn btn-sm" data-open-not="${escapeHtml(n.id)}">Apri</button>
            </div>
          `;
        }).join('') || `<div class="muted">Nessuna notizia associata (compila il campo “Condominio” nella scheda notizia).</div>`}
      </div>
    </div>
  `;

  // Bind pulsanti
  detail.querySelectorAll('[data-open-imm]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-open-imm');
      if (id && typeof openSchedaImmobile === 'function') openSchedaImmobile(id);
    });
  });
  detail.querySelectorAll('[data-open-not]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-open-not');
      if (id && typeof openSchedaNotizia === 'function') openSchedaNotizia(id);
    });
  });
}



function hookPoligoniUI() {
  // bottoni creati da ensureMappaSearchUI
  const btnArea = document.getElementById('btn-draw-area');
  const btnCondo = document.getElementById('btn-draw-condo');
  const btnToggle = document.getElementById('btn-toggle-poligoni');
  const btnList = document.getElementById('btn-list-condomini');

  if (btnArea && !btnArea.__hooked) {
    btnArea.__hooked = true;
    btnArea.addEventListener('click', () => startDrawing('area'));
  }
  if (btnCondo && !btnCondo.__hooked) {
    btnCondo.__hooked = true;
    btnCondo.addEventListener('click', () => startDrawing('condominio'));
  }
  if (btnToggle && !btnToggle.__hooked) {
    btnToggle.__hooked = true;
    btnToggle.addEventListener('click', () => {
      mappaPoligoniVisible = !mappaPoligoniVisible;
      ensurePoligoniLayers();
    });
  }
  if (btnList && !btnList.__hooked) {
    btnList.__hooked = true;
    btnList.addEventListener('click', () => {
      ensureCondominiPanel();
      const panel = document.getElementById('condomini-panel');
      if (panel) panel.classList.toggle('open');
      renderCondominiList();
    });
  }
}

function initPoligoniModule() {
  if (!mappa) return;
  mappaPoligoni = loadPoligoni();
  ensurePoligoniLayers();
  renderPoligoni();

  // Eventi mappa per disegno
  try { mappa.off('click', onMapClickForDrawing); } catch {}
  try { mappa.off('dblclick', onMapDblClickForDrawing); } catch {}
  mappa.on('click', onMapClickForDrawing);
  mappa.on('dblclick', onMapDblClickForDrawing);

  ensureCondominiPanel();
  hookPoligoniUI();
}




    function hideMapDetail() {
      const panel = document.getElementById('map-detail-panel');
      if (panel) panel.classList.add('hidden');
      mappaSelectedItem = null;
    }

    function showMapDetail(item) {
      mappaSelectedItem = item;
      const panel = document.getElementById('map-detail-panel');
      const titleEl = document.getElementById('map-detail-title');
      const bodyEl = document.getElementById('map-detail-body');
      if (!panel || !titleEl || !bodyEl) return;

      const tipoLabel = item.tipo === 'immobile' ? 'Immobile' : 'Notizia';
      const titolo = item.tipo === 'immobile'
        ? (item.rif || item.indirizzo || 'Immobile')
        : ((item.nome || '') + ' ' + (item.cognome || '')).trim() || (item.indirizzo || 'Notizia');

      titleEl.textContent = `${tipoLabel} · ${titolo}`;

      const rows = [];
      const ind = [item.indirizzo || '', item.citta || '', item.provincia || ''].filter(Boolean).join(', ');
      if (ind) rows.push(`<div><strong>Indirizzo:</strong> ${escapeHtml(ind)}</div>`);
      if (item.tipologia) rows.push(`<div><strong>Tipologia:</strong> ${escapeHtml(item.tipologia)}</div>`);
      if (item.mq != null) rows.push(`<div><strong>mq:</strong> ${item.mq}</div>`);
      if (item.prezzo != null) rows.push(`<div><strong>Prezzo:</strong> ${formatEuro(item.prezzo)}</div>`);
      if (item.stato) rows.push(`<div><strong>Stato:</strong> ${escapeHtml(item.stato)}</div>`);
      if (item.caldo) rows.push(`<div><strong>Stato commerciale:</strong> 🔥 caldo</div>`);

      bodyEl.innerHTML = rows.join('') || '<div class="muted">Nessun dettaglio aggiuntivo.</div>';

      panel.classList.remove('hidden');
    }

    function getMappaFilters() {
      const fTipo = document.getElementById('mappa-filter')?.value || 'tutti';
      const fTipologia = document.getElementById('mappa-tipologia')?.value || 'tutte';
      const fStato = document.getElementById('mappa-stato')?.value || 'tutti';
      const fCaldo = document.getElementById('mappa-solo-caldo')?.checked || false;
      const fPrezzoMin = parseFloat(document.getElementById('mappa-prezzo-min')?.value || '') || null;
      const fPrezzoMax = parseFloat(document.getElementById('mappa-prezzo-max')?.value || '') || null;
      const fMqMin = parseFloat(document.getElementById('mappa-mq-min')?.value || '') || null;
      const fMqMax = parseFloat(document.getElementById('mappa-mq-max')?.value || '') || null;

      return { fTipo, fTipologia, fStato, fCaldo, fPrezzoMin, fPrezzoMax, fMqMin, fMqMax };
    }

    function passaFiltriMappa(item, filters) {
      const {
        fTipo, fTipologia, fStato, fCaldo,
        fPrezzoMin, fPrezzoMax, fMqMin, fMqMax
      } = filters;

      if (fTipo === 'immobili' && item.tipo !== 'immobile') return false;
      if (fTipo === 'notizie' && item.tipo !== 'notizia') return false;

      if (fTipologia !== 'tutte' && item.tipologia !== fTipologia) return false;

      if (item.tipo === 'immobile' && fStato !== 'tutti') {
        if ((item.stato || '') !== fStato) return false;
      }

      if (fCaldo && !item.caldo) return false;

      if (fPrezzoMin != null && item.prezzo != null && item.prezzo < fPrezzoMin) return false;
      if (fPrezzoMax != null && item.prezzo != null && item.prezzo > fPrezzoMax) return false;

      if (fMqMin != null && item.mq != null && item.mq < fMqMin) return false;
      if (fMqMax != null && item.mq != null && item.mq > fMqMax) return false;

      return true;
    }

    
    function renderMappa() {
      if (!mappa || !mappaCluster) return;

      // Evita render mentre Leaflet non ha ancora calcolato dimensioni (es. view appena aperta)
      try { mappa.invalidateSize(false); } catch {}

      mappaCluster.clearLayers();
      hideMapDetail();

      const filters = getMappaFilters();
      const items = [];

      // Immobili (se non filtrato solo Notizie)
      if (filters.fTipo !== 'notizie') {
        (immobili || []).forEach(imm => {
          if (imm.lat != null && imm.lng != null) {
            items.push({ ...imm, tipo: 'immobile', id: imm.id });
          }
        });
      }

      // Notizie (se non filtrato solo Immobili)
      if (filters.fTipo !== 'immobili') {
        (notizie || []).forEach(n => {
          if (n.lat != null && n.lng != null) {
            items.push({ ...n, tipo: 'notizia', id: n.id });
          }
        });
      }

      const filtered = items.filter(item => passaFiltriMappa(item, filters));

      filtered.forEach(item => {
        const isImmobile = item.tipo === 'immobile';
        const color = isImmobile ? '#22c55e' : '#f97316';

        const iconHtml = `
          <div style="
            width:14px;
            height:14px;
            border-radius:999px;
            border:2px solid #0f172a;
            box-shadow:0 0 0 2px rgba(15,23,42,0.85);
            background:${color};
          "></div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'map-dot-icon',
          iconSize: [14, 14]
        });

        const marker = L.marker([item.lat, item.lng], { icon });
        marker.on('click', () => showMapDetail(item));
        mappaCluster.addLayer(marker);
      });

      // FitBounds “intelligente”: non resettiamo la mappa a ogni filtro se l’utente sta navigando
      if (filtered.length > 0) {
        const bounds = mappaCluster.getBounds();
        const sig = `${filtered.length}:${filters.fTipo}:${filters.fTipologia}:${filters.fStato}:${filters.fCaldo}:${filters.fPrezzoMin ?? ''}-${filters.fPrezzoMax ?? ''}:${filters.fMqMin ?? ''}-${filters.fMqMax ?? ''}`;
        const shouldFit = (!mappaUserInteracted) && (!mappaAutoFitted || sig !== mappaLastFitSig);

        if (shouldFit && bounds && bounds.isValid && bounds.isValid()) {
          try {
            mappa.fitBounds(bounds, { padding: [40, 40] });
            mappaAutoFitted = true;
            mappaLastFitSig = sig;
          } catch {}
        }
      }
    }

// Geocodifica via Nominatim (best effort, per uso leggero)
    async function geocodeAddress(fullAddress) {
      if (!fullAddress) return null;
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
        encodeURIComponent(fullAddress);
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) return null;
        const first = data[0];
        return {
          lat: parseFloat(first.lat),
          lng: parseFloat(first.lon)
        };
      } catch {
        return null;
      }
    }

    async function geocodeMancanti(tipo) {
      const isImmobili = (tipo === 'immobili');
      const arr = isImmobili ? (immobili || []) : (notizie || []);
      let count = 0;

      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (item.lat != null && item.lng != null) continue;

        const indParts = [item.indirizzo || '', item.citta || '', item.provincia || ''].filter(Boolean);
        if (!indParts.length) continue;

        const fullAddress = indParts.join(', ') + ', Italia';
        const coords = await geocodeAddress(fullAddress);
        if (coords) {
          item.lat = coords.lat;
          item.lng = coords.lng;
          count++;
        }
      }

      if (isImmobili) {
        saveList(STORAGE_KEYS.immobili, immobili);
      } else {
        saveList(STORAGE_KEYS.notizie, notizie);
      }

      alert(`Geocodifica completata: aggiornati ${count} ${isImmobili ? 'immobili' : 'notizie'}.`);
      renderMappa();
    }

    // Eventi filtri mappa
    document.getElementById('mappa-filter')?.addEventListener('change', renderMappa);
    document.getElementById('mappa-tipologia')?.addEventListener('change', renderMappa);
    document.getElementById('mappa-stato')?.addEventListener('change', renderMappa);
    document.getElementById('mappa-solo-caldo')?.addEventListener('change', renderMappa);
    document.getElementById('mappa-prezzo-min')?.addEventListener('input', renderMappa);
    document.getElementById('mappa-prezzo-max')?.addEventListener('input', renderMappa);
    document.getElementById('mappa-mq-min')?.addEventListener('input', renderMappa);
    document.getElementById('mappa-mq-max')?.addEventListener('input', renderMappa);

    document.getElementById('mappa-geocode-imm')?.addEventListener('click', () => {
      geocodeMancanti('immobili');
    });
    document.getElementById('mappa-geocode-not')?.addEventListener('click', () => {
      geocodeMancanti('notizie');
    });

  /* ====== INIT ====== */

  function initData() {
    immobili = loadList(STORAGE_KEYS.immobili);
    notizie = loadList(STORAGE_KEYS.notizie);
    attivita = loadList(STORAGE_KEYS.attivita);
    staff = loadList(STORAGE_KEYS.staff);
    omi = loadList(STORAGE_KEYS.omi);
    contatti = loadList(STORAGE_KEYS.contatti);
    intestazioni = loadList(STORAGE_KEYS.intestazioni || 'crm10_intestazioni');
  }

  
  function init() {
    initData();
    renderDashboard();
    renderImmobili();
    renderNotizie();
    if (typeof renderRubrica === 'function') {
      renderRubrica();
    }
    renderAttivita();
    renderOperazioni();
    renderStaffTable();
    renderOmi();
    renderAgendaWeek();
    renderAgendaMonth();
    initMappa();

    // sincronizzazione realtime con Firebase, se attiva
    try {
      if (typeof cloudSync !== 'undefined' && FIREBASE_ENABLED) {
        cloudSync.subscribe(STORAGE_KEYS.immobili, data => {
          immobili = data || [];
          renderImmobili();
          renderMappa();
        });
        cloudSync.subscribe(STORAGE_KEYS.notizie, data => {
          notizie = data || [];
          renderNotizie();
        renderMappa();
        });
        cloudSync.subscribe(STORAGE_KEYS.attivita, data => {
          attivita = data || [];
          renderAttivita();
          renderOperazioni();
          renderAgendaWeek();
          renderAgendaMonth();
          renderDashboard();
        });
        cloudSync.subscribe(STORAGE_KEYS.staff, data => {
          staff = data || [];
          renderStaffTable();
        });
        cloudSync.subscribe(STORAGE_KEYS.omi, data => {
          omi = data || [];
          renderOmi();
        });
        cloudSync.subscribe(STORAGE_KEYS.contatti, data => {
          contatti = data || [];
          if (typeof renderRubrica === 'function') {
            renderRubrica();
          }
        });
        cloudSync.subscribe(STORAGE_KEYS.intestazioni || 'crm10_intestazioni', data => {
          intestazioni = data || [];
        });
      }
    } catch (e) {
      console.warn('[SYNC] Errore init cloudSync subscribe', e);
    }

    // filtri rubrica, se presenti
    const rubricaFilter = document.getElementById('rubrica-filter');
    const rubricaClear = document.getElementById('rubrica-filter-clear');
    if (rubricaFilter && typeof renderRubrica === 'function') {
      rubricaFilter.addEventListener('input', () => renderRubrica());
    }
    if (rubricaClear && rubricaFilter && typeof renderRubrica === 'function') {
      rubricaClear.addEventListener('click', () => {
        rubricaFilter.value = '';
        renderRubrica();
      });
    }

    // UI intestazioni
    if (typeof renderIntestazioniUI === 'function') {
      renderIntestazioniUI();
    }

    
  // Scheda appuntamento: eventi modale
      document.getElementById('appuntamento-dialog-close')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeAppuntamentoDialog();
      });
      document.getElementById('app-annulla')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeAppuntamentoDialog();
      });

      // Elimina appuntamento direttamente dalla scheda
      document.getElementById('app-elimina')?.addEventListener('click', (e) => {
        e.preventDefault();
        const idInput = document.getElementById('app-id');
        const rawId = idInput ? (idInput.value || '') : '';
        if (!rawId) {
          closeAppuntamentoDialog();
          return;
        }
        attivita = (attivita || []).filter(a => !(a && a.id === rawId));
        saveList(STORAGE_KEYS.attivita, attivita);
        renderAgendaWeek();
        renderAgendaMonth();
        renderAttivita();
        renderDashboard();
        closeAppuntamentoDialog();
      });

      // Esito negativo: setta stato e lancia il salvataggio
      document.getElementById('app-esito-neg')?.addEventListener('click', (e) => {
        e.preventDefault();
        const statoSel = document.getElementById('app-stato');
        if (statoSel) statoSel.value = 'chiusa';
        const descrInput = document.getElementById('app-descrizione');
        if (descrInput && !descrInput.value.includes('[esito negativo]')) {
          descrInput.value = (descrInput.value ? descrInput.value + ' ' : '') + '[esito negativo]';
        }
        const form = document.getElementById('appuntamento-form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      // Esito positivo: setta stato e lancia il salvataggio
      document.getElementById('app-esito-pos')?.addEventListener('click', (e) => {
        e.preventDefault();
        const statoSel = document.getElementById('app-stato');
        if (statoSel) statoSel.value = 'chiusa';
        const descrInput = document.getElementById('app-descrizione');
        if (descrInput && !descrInput.value.includes('[esito positivo]')) {
          descrInput.value = (descrInput.value ? descrInput.value + ' ' : '') + '[esito positivo]';
        }
        const form = document.getElementById('appuntamento-form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      document.getElementById('appuntamento-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
  
        const idInput = document.getElementById('app-id');
        const dataInput = document.getElementById('app-data');
        const oraInput = document.getElementById('app-ora');
        const oraFineInput = document.getElementById('app-ora-fine');
        const tipoSel = document.getElementById('app-tipo');
        const respSel = document.getElementById('app-resp');
        const cliSel = document.getElementById('app-cliente');
        const immSel = document.getElementById('app-immobile');
        const notSel = document.getElementById('app-notizia');
        const descrInput = document.getElementById('app-descrizione');
        const statoSel = document.getElementById('app-stato');
        const bollenteChk = document.getElementById('app-bollente');
        const luogoInput = document.getElementById('app-luogo');
        const inUfficioChk = document.getElementById('app-in-ufficio');
        const cittaUfficioSel = document.getElementById('app-citta-ufficio');
  
        let app = null;
        const rawId = idInput ? (idInput.value || '') : '';
  
        if (rawId) {
          // Modifica appuntamento esistente
          app = (attivita || []).find(a => a && a.id === rawId);
        } else {
          // Nuovo appuntamento
          app = {
            id: genId('app'),
            tipo: 'appuntamento',
            stato: 'aperta',
            bollente: !!(bollenteChk && bollenteChk.checked)
          };
          attivita.push(app);
          lastCreatedAppId = app.id;
        }
        if (!app) {
          closeAppuntamentoDialog();
          return;
        }
  
        app.tipo = 'appuntamento';
        if (dataInput && dataInput.value) app.data = dataInput.value;
        if (oraInput && oraInput.value) app.ora = oraInput.value;
        if (oraFineInput && oraFineInput.value) app.oraFine = oraFineInput.value;
        if (tipoSel) app.tipoDettaglio = tipoSel.value || 'sopralluogo';
        if (respSel) app.responsabileId = respSel.value || null;
        if (cliSel) {
          const val = cliSel.value || '';
          app.clienteId = val;
          if (val) app.contattoId = val;
        }
        if (immSel) {
          const valImm = immSel.value || '';
          app.immobileId = valImm || null;
        }
        if (notSel) {
          const valNot = notSel.value || '';
          app.notiziaId = valNot || null;
        }
        if (descrInput) app.descrizione = descrInput.value || '';
        if (bollenteChk) app.bollente = !!bollenteChk.checked;
        if (statoSel) app.stato = statoSel.value || 'aperta';
        if (luogoInput) app.luogo = luogoInput.value || '';
        if (inUfficioChk) app.inUfficio = !!inUfficioChk.checked;
        if (cittaUfficioSel) app.cittaUfficio = cittaUfficioSel.value || '';
  
        // Aggiorna hidden id (utile se prima era vuoto)
        if (idInput && !rawId) {
          idInput.value = app.id;
        }
  
        saveList(STORAGE_KEYS.attivita, attivita);
        renderAgendaWeek();
        renderAgendaMonth();
        renderAttivita();
        renderDashboard();
        closeAppuntamentoDialog();
      });
  
  
      
setView('home');

// Autocomplete indirizzi (Immobile / Notizia / Condominio)
setupAddressAutocomplete({ inputId: 'imm-indirizzo', cityId: 'imm-citta', provId: 'imm-provincia', capId: 'imm-cap' });
setupAddressAutocomplete({ inputId: 'not-indirizzo', cityId: 'not-citta', provId: 'not-provincia', capId: 'not-cap' });
setupAddressAutocomplete({ inputId: 'condominio-indirizzo', cityId: 'condominio-citta', provId: 'condominio-provincia', capId: 'condominio-cap' });

  }

  
  document.getElementById('imm-export-csv')?.addEventListener('click', exportImmobiliCsv);
  document.getElementById('not-export-csv')?.addEventListener('click', exportNotizieCsv);
  document.getElementById('rubrica-export-csv')?.addEventListener('click', exportRubricaCsv);
  document.getElementById('operazioni-export-csv')?.addEventListener('click', exportOperazioniCsv);
  document.getElementById('btn-print-view')?.addEventListener('click', () => window.print());


document.addEventListener('DOMContentLoaded', init);


    function highlightRowById(view, id) {
      requestAnimationFrame(() => {
        const sel = '#view-' + view + ' tbody tr';
        document.querySelectorAll(sel).forEach(row => {
          const isTarget = row.dataset.id === id;
          row.classList.toggle('row-highlight', isTarget);
          if (isTarget) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      });
    }

    function openSchedaImmobile(id) {
      setView('immobili');
      highlightRowById('immobili', id);
    }

    function openSchedaNotizia(id) {
      setView('notizie');
      highlightRowById('notizie', id);
    }


/* ====== RUBRICA MENU LATERALE & FILTRI ====== */
const ENABLE_LEGACY_RUBRICA = false;
if (ENABLE_LEGACY_RUBRICA) {
document.addEventListener('DOMContentLoaded', () => {
  const rubricaMenu = document.querySelector('.nav-item[data-view="rubrica"]');
  const rubricaSub = document.getElementById('rubrica-submenu');
  const rubricaList = document.getElementById('rubrica-list');
  const counter = document.getElementById('rubrica-counter');

  if (!rubricaMenu || !rubricaSub) return;

  // espansione menu laterale
  rubricaMenu.addEventListener('click', () => {
    rubricaSub.style.display = 'block';
    showRubrica('lista');
  });

  // click sottosezioni
  rubricaSub.querySelectorAll('.nav-item-sub').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const sub = item.getAttribute('data-rubrica-sub');
      showRubrica(sub);
    });
  });

  function getContacts() {
    try {
      return JSON.parse(localStorage.getItem('rubrica') || '[]');
    } catch {
      return [];
    }
  }

  function showRubrica(mode) {
    const all = getContacts();
    let filtered = all;

    if (mode === 'acquirenti') {
      filtered = all.filter(c => c.acquirente);
    } else if (mode === 'venditori') {
      filtered = all.filter(c => c.venditore);
    } else if (mode === 'nuovo') {
      document.getElementById('rubrica-dialog-overlay').style.display = 'flex';
      return;
    }

    renderList(filtered);
    updateCounter(all);
  }

  function renderList(list) {
    if (!rubricaList) return;
    rubricaList.innerHTML = list.map(c => `
      <div class="rubrica-row">
        <strong>${c.nome || ''}</strong>
        <span>${c.telefono || ''}</span>
        <span>${c.email || ''}</span>
      </div>
    `).join('');
  }

  function updateCounter(all) {
    const acq = all.filter(c => c.acquirente).length;
    const ven = all.filter(c => c.venditore).length;
    counter.textContent = `Totale: ${all.length} · Acquirenti: ${acq} · Venditori: ${ven}`;
  }

  // inizializza
  updateCounter(getContacts());
});
}




/* ====== RUBRICA: CRUSCOTTO HOME + COLLABORATORI (FIX DEFINITIVO) ====== */
(function(){
  function qs(id){ return document.getElementById(id); }

  const rubricaView = qs('view-rubrica');
  if (!rubricaView) return;

  const counter = qs('rubrica-counter');
  const list = qs('rubrica-list');
  const submenu = qs('rubrica-submenu');

  // aggiunge voce Collaboratori al menu laterale se manca
  if (submenu && !submenu.querySelector('[data-rubrica-sub="collaboratori"]')) {
    const div = document.createElement('div');
    div.className = 'nav-item nav-item-sub';
    div.dataset.rubricaSub = 'collaboratori';
    div.innerHTML = `
      <div class="nav-item-main">
        <div class="nav-icon">🤝</div>
        <div>
          <div class="nav-label-title">Lista collaboratori</div>
          <div class="nav-label-sub">Contatti collaboratori</div>
        </div>
      </div>`;
    submenu.appendChild(div);
  }

  function getContacts(){
    try { return JSON.parse(localStorage.getItem('rubrica')||'[]'); }
    catch { return []; }
  }

  function renderDashboard(){
    if (!counter) return;
    const all = getContacts();
    const stats = {
      all: all.length,
      acq: all.filter(c=>c.acquirente).length,
      ven: all.filter(c=>c.venditore).length,
      coll: all.filter(c=>c.collaboratore).length,
      other: all.filter(c=>c.altro).length
    };
    counter.innerHTML = `
      <div class="rubrica-dashboard">
        <div class="rubrica-kpi" data-go="lista">👥 Tutti<br><strong>${stats.all}</strong></div>
        <div class="rubrica-kpi" data-go="acquirenti">🏡 Acquirenti<br><strong>${stats.acq}</strong></div>
        <div class="rubrica-kpi" data-go="venditori">🏠 Venditori<br><strong>${stats.ven}</strong></div>
        <div class="rubrica-kpi" data-go="collaboratori">🤝 Collaboratori<br><strong>${stats.coll}</strong></div>
        <div class="rubrica-kpi" data-go="altro">📌 Altro<br><strong>${stats.other}</strong></div>
      </div>`;
    counter.querySelectorAll('.rubrica-kpi').forEach(k=>{
      k.addEventListener('click', ()=>showRubrica(k.dataset.go));
    });
  }

  window.showRubrica = function(mode){
    const all = getContacts();
    let filtered = all;
    if (mode==='acquirenti') filtered = all.filter(c=>c.acquirente);
    if (mode==='venditori') filtered = all.filter(c=>c.venditore);
    if (mode==='collaboratori') filtered = all.filter(c=>c.collaboratore);
    if (mode==='altro') filtered = all.filter(c=>c.altro);

    if (list){
      list.innerHTML = filtered.map(c=>`
        <div class="rubrica-row">
          <strong>${c.nome||''}</strong>
          <span>${c.telefono||''}</span>
          <span>${c.email||''}</span>
        </div>`).join('');
    }
    renderDashboard();
  };

  // inizializzazione quando si entra in Rubrica
  document.querySelector('.nav-item[data-view="rubrica"]')
    ?.addEventListener('click', ()=>{ showRubrica('lista'); });

})();



/* ====== RUBRICA: CRUSCOTTO HOME (DESIGN) ====== */
(function(){
  const view = document.getElementById('view-rubrica');
  if(!view) return;

  const counter = document.getElementById('rubrica-counter');
  const list = document.getElementById('rubrica-list');

  function getContacts(){
    try { return JSON.parse(localStorage.getItem('rubrica')||'[]'); }
    catch { return []; }
  }

  function stats(){
    const a = getContacts();
    return {
      all: a.length,
      acq: a.filter(c=>c.acquirente).length,
      ven: a.filter(c=>c.venditore).length,
      coll: a.filter(c=>c.collaboratore).length,
      other: a.filter(c=>c.altro).length
    };
  }

  function renderDashboard(){
    if(!counter) return;
    const s = stats();
    counter.innerHTML = `
      <div class="rubrica-dashboard-grid">
        <div class="rubrica-card" data-go="lista">
          <div class="rubrica-card-title">Tutti i contatti</div>
          <div class="rubrica-card-value">${s.all}</div>
        </div>
        <div class="rubrica-card" data-go="acquirenti">
          <div class="rubrica-card-title">Acquirenti</div>
          <div class="rubrica-card-value">${s.acq}</div>
        </div>
        <div class="rubrica-card" data-go="venditori">
          <div class="rubrica-card-title">Venditori</div>
          <div class="rubrica-card-value">${s.ven}</div>
        </div>
        <div class="rubrica-card" data-go="collaboratori">
          <div class="rubrica-card-title">Collaboratori</div>
          <div class="rubrica-card-value">${s.coll}</div>
        </div>
        <div class="rubrica-card" data-go="altro">
          <div class="rubrica-card-title">Altro</div>
          <div class="rubrica-card-value">${s.other}</div>
        </div>
      </div>
    `;
    counter.querySelectorAll('.rubrica-card').forEach(c=>{
      c.addEventListener('click',()=>showRubrica(c.dataset.go));
    });
  }

  window.showRubrica = function(mode){
    const all = getContacts();
    let f = all;
    if(mode==='acquirenti') f = all.filter(c=>c.acquirente);
    if(mode==='venditori') f = all.filter(c=>c.venditore);
    if(mode==='collaboratori') f = all.filter(c=>c.collaboratore);
    if(mode==='altro') f = all.filter(c=>c.altro);

    if(list){
      list.innerHTML = f.map(c=>`
        <div class="rubrica-row">
          <strong>${c.nome||''}</strong>
          <span>${c.telefono||''}</span>
          <span>${c.email||''}</span>
        </div>
      `).join('');
    }
    renderDashboard();
  };

  // inject minimal CSS once
  if(!document.getElementById('rubrica-dashboard-style')){
    const style = document.createElement('style');
    style.id = 'rubrica-dashboard-style';
    style.innerHTML = `
      .rubrica-dashboard-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
        gap:12px;
        margin-bottom:14px;
      }
      .rubrica-card{
        background:#111827;
        border:1px solid #1f2937;
        border-radius:12px;
        padding:14px;
        cursor:pointer;
        transition:all .15s ease;
      }
      .rubrica-card:hover{
        transform:translateY(-2px);
        border-color:#3b82f6;
      }
      .rubrica-card-title{
        font-size:12px;
        color:#9ca3af;
        margin-bottom:6px;
      }
      .rubrica-card-value{
        font-size:22px;
        font-weight:600;
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelector('.nav-item[data-view="rubrica"]')
    ?.addEventListener('click',()=>showRubrica('lista'));
})();



/* ====== RUBRICA DASHBOARD FORCE RENDER ====== */
(function(){
  const rubricaView = document.getElementById('view-rubrica');
  if(!rubricaView) return;

  let dash = document.getElementById('rubrica-dashboard-forced');
  if(!dash){
    dash = document.createElement('div');
    dash.id = 'rubrica-dashboard-forced';
    dash.style.marginBottom = '16px';
    const counter = document.getElementById('rubrica-counter');
    if(counter){
      counter.replaceWith(dash);
    } else {
      rubricaView.prepend(dash);
    }
  }

  function getContacts(){
    try { return JSON.parse(localStorage.getItem('rubrica')||'[]'); }
    catch { return []; }
  }

  function render(mode){
    const a = getContacts();
    const s = {
      all:a.length,
      acq:a.filter(c=>c.acquirente).length,
      ven:a.filter(c=>c.venditore).length,
      coll:a.filter(c=>c.collaboratore).length,
      other:a.filter(c=>c.altro).length
    };
    dash.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
        ${card('Tutti i contatti',s.all,'lista')}
        ${card('Acquirenti',s.acq,'acquirenti')}
        ${card('Venditori',s.ven,'venditori')}
        ${card('Collaboratori',s.coll,'collaboratori')}
        ${card('Altro',s.other,'altro')}
      </div>
    `;
    dash.querySelectorAll('[data-go]').forEach(c=>{
      c.onclick = ()=>window.showRubrica(c.dataset.go);
    });
  }

  function card(title,val,go){
    return `<div data-go="${go}" style="
      background:#111827;border:1px solid #1f2937;border-radius:12px;
      padding:14px;cursor:pointer">
      <div style="font-size:12px;color:#9ca3af">${title}</div>
      <div style="font-size:22px;font-weight:600">${val}</div>
    </div>`;
  }

  const nav = document.querySelector('.nav-item[data-view="rubrica"]');
  nav && nav.addEventListener('click',()=>render('lista'));
})();



/* ====== RUBRICA DASHBOARD: UX MIGLIORATA (CLICK, 1 RIGA, AZIONI SOTTO) ====== */
(function(){
  const rubricaView = document.getElementById('view-rubrica');
  if(!rubricaView) return;

  // Inject CSS once
  if(!document.getElementById('rubrica-dashboard-ux-style')){
    const style = document.createElement('style');
    style.id = 'rubrica-dashboard-ux-style';
    style.textContent = `
      /* Nasconde i bottoni lista/nuovo/acq/vend sotto il cruscotto (tabs) */
      .rubrica-subnav{ display:none !important; }

      /* Cruscotto: una riga sola */
      #rubrica-dashboard-forced .rb-row{
        display:flex;
        gap:10px;
        flex-wrap:nowrap;
        overflow-x:auto;
        padding-bottom:2px;
        -webkit-overflow-scrolling:touch;
      }
      #rubrica-dashboard-forced .rb-card{
        flex:1 0 140px;
        min-width:140px;
        background:#111827;
        border:1px solid #1f2937;
        border-radius:12px;
        padding:10px 12px;
        cursor:pointer;
        user-select:none;
        transition:transform .12s ease, border-color .12s ease, box-shadow .12s ease;
      }
      #rubrica-dashboard-forced .rb-card:hover{
        border-color:#334155;
      }
      #rubrica-dashboard-forced .rb-card:active{
        transform:scale(.98);
      }
      #rubrica-dashboard-forced .rb-card.rb-active{
        border-color:#3b82f6;
        box-shadow:0 0 0 3px rgba(59,130,246,.18);
      }
      #rubrica-dashboard-forced .rb-title{
        font-size:11px;
        color:#9ca3af;
        margin-bottom:6px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      #rubrica-dashboard-forced .rb-value{
        font-size:18px;
        font-weight:700;
        line-height:1.1;
      }

      /* Barra azioni sotto il cruscotto */
      #rubrica-dashboard-actions{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
        margin:10px 0 12px 0;
      }
      #rubrica-dashboard-actions .search-input{
        flex:1 1 260px;
        min-width:220px;
      }
    `;
    document.head.appendChild(style);
  }

  const dash = document.getElementById('rubrica-dashboard-forced');
  if(!dash) return;

  // Create/ensure actions bar right under dashboard
  let actions = document.getElementById('rubrica-dashboard-actions');
  if(!actions){
    actions = document.createElement('div');
    actions.id = 'rubrica-dashboard-actions';
    dash.insertAdjacentElement('afterend', actions);
  }

  // Move search + clear under dashboard (keep same elements, so listeners remain)
  const search = document.getElementById('rubrica-filter');
  const clear = document.getElementById('rubrica-filter-clear');

  // Create a "Nuovo contatto" button under dashboard that triggers the existing one
  let newBtn = document.getElementById('rubrica-new-btn');
  if(newBtn){
    // Hide the header button to avoid duplicates
    newBtn.style.display = 'none';
  }

  let newBtnProxy = document.getElementById('rubrica-new-btn-proxy');
  if(!newBtnProxy){
    newBtnProxy = document.createElement('button');
    newBtnProxy.id = 'rubrica-new-btn-proxy';
    newBtnProxy.className = 'btn btn-sm btn-primary';
    newBtnProxy.textContent = '+ Nuovo contatto';
    newBtnProxy.addEventListener('click', () => {
      // Open the existing dialog directly (robusto anche se il bottone originale è nascosto)
      const overlay = document.getElementById('rubrica-dialog-overlay');
      if(overlay) overlay.style.display = 'flex';
      // Focus sul primo campo
      setTimeout(()=>document.getElementById('rubrica-nome')?.focus(), 50);
    });
  }

  // Rebuild actions bar
  function renderActions(){
    actions.innerHTML = '';
    if(search) actions.appendChild(search);
    if(clear) actions.appendChild(clear);
    actions.appendChild(newBtnProxy);
  }

  // Enhance dashboard rendering with active click effect
  const originalShow = window.showRubrica;
  window.showRubrica = function(mode){
    // call existing behavior if present
    if(typeof originalShow === 'function'){
      originalShow(mode);
    }
    // set active on cards
    dash.querySelectorAll('.rb-card').forEach(el=>{
      el.classList.toggle('rb-active', el.dataset.go === mode || (mode==='lista' && el.dataset.go==='lista'));
    });
    renderActions();
  };

  // Patch the card markup produced by the FORCE renderer: upgrade classnames if needed
  function upgradeDashboardMarkup(){
    // if current markup doesn't have rb-row/rb-card, rewrite it based on current numbers
    const a = (function(){
      try { return JSON.parse(localStorage.getItem('rubrica')||'[]'); } catch { return []; }
    })();
    const s = {
      all:a.length,
      acq:a.filter(c=>c.acquirente).length,
      ven:a.filter(c=>c.venditore).length,
      coll:a.filter(c=>c.collaboratore).length,
      other:a.filter(c=>c.altro).length
    };
    dash.innerHTML = `
      <div class="rb-row">
        ${card('Tutti i contatti',s.all,'lista')}
        ${card('Acquirenti',s.acq,'acquirenti')}
        ${card('Venditori',s.ven,'venditori')}
        ${card('Collaboratori',s.coll,'collaboratori')}
        ${card('Altro',s.other,'altro')}
      </div>
    `;
    dash.querySelectorAll('.rb-card').forEach(c=>{
      c.addEventListener('click',()=>window.showRubrica(c.dataset.go));
    });
  }

  function card(title,val,go){
    return `<div class="rb-card" data-go="${go}">
      <div class="rb-title">${title}</div>
      <div class="rb-value">${val}</div>
    </div>`;
  }

  // Ensure markup upgraded when entering rubrica
  const nav = document.querySelector('.nav-item[data-view="rubrica"]');
  if(nav){
    nav.addEventListener('click', ()=>{
      upgradeDashboardMarkup();
      window.showRubrica('lista');
    });
  }

  // Also run once if rubrica already visible
  upgradeDashboardMarkup();
  renderActions();
})();



/* ====== RUBRICA PRO (ADD-ON) ======
   Obiettivo: aggiungere funzioni "pro" SENZA modificare la struttura/HTML esistente.
   - Non tocca renderRubrica internamente: la wrappa e poi arricchisce il DOM.
   - Salva le preferenze su ciascun contatto (campo: proPrefs) per il gruppo (buildKey).
   - Matching semplice contatto->immobili (città/zona/tipo/operazione/budget/mq).
*/
(function(){
  try {
    const RUBRICA_PRO_ENABLED = true;
    if (!RUBRICA_PRO_ENABLED) return;

    // Evita doppio wrap
    if (typeof renderRubrica === 'function' && !renderRubrica.__rubricaProWrapped) {
      const _orig = renderRubrica;
      const wrapped = function() {
        _orig();
        try { rubricaProEnhanceDOM(); } catch(e) { console.warn('[RUBRICA PRO] enhance err', e); }
      };
      wrapped.__rubricaProWrapped = true;
      renderRubrica = wrapped;
    }

    // CSS minimale (solo per modale + badge + bottone)
    if (!document.getElementById('rubrica-pro-style')) {
      const st = document.createElement('style');
      st.id = 'rubrica-pro-style';
      st.textContent = `
        .rubrica-pro-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:11px;line-height:18px;margin-left:8px}
        .rubrica-pro-badge.warn{border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.08)}
        .rubrica-pro-badge.ok{border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.06)}
        .rubrica-pro-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:18px}
        .rubrica-pro-modal{width:min(980px,100%);max-height:min(90vh,860px);overflow:auto;background:#0b1220;border:1px solid rgba(255,255,255,.10);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.45)}
        .rubrica-pro-modal header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 16px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
        .rubrica-pro-modal h3{margin:0;font-size:18px}
        .rubrica-pro-modal .sub{color:rgba(255,255,255,.70);font-size:12px;margin-top:4px}
        .rubrica-pro-modal .body{padding:14px 16px 16px}
        .rubrica-pro-grid{display:grid;grid-template-columns: 1fr 1fr;gap:14px}
        .rubrica-pro-card{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;background:rgba(255,255,255,.03)}
        .rubrica-pro-card h4{margin:0 0 8px;font-size:13px;color:rgba(255,255,255,.82)}
        .rubrica-pro-fields{display:grid;grid-template-columns: 1fr 1fr;gap:10px}
        .rubrica-pro-fields .full{grid-column:1 / -1}
        .rubrica-pro-modal label{display:block;font-size:11px;color:rgba(255,255,255,.70);margin:0 0 4px}
        .rubrica-pro-modal input,.rubrica-pro-modal select,.rubrica-pro-modal textarea{
          width:100%;box-sizing:border-box;background:#0a162a;border:1px solid rgba(255,255,255,.10);color:#fff;
          border-radius:10px;padding:9px 10px;font-size:12px;outline:none
        }
        .rubrica-pro-modal textarea{min-height:86px;resize:vertical}
        .rubrica-pro-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .rubrica-pro-actions .btn{border-radius:10px}
        .rubrica-pro-list{margin:0;padding:0;list-style:none}
        .rubrica-pro-list li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;margin-bottom:8px;background:rgba(255,255,255,.02)}
        .rubrica-pro-list small{color:rgba(255,255,255,.65)}
        .rubrica-pro-pill{font-size:11px;padding:2px 8px;border:1px solid rgba(255,255,255,.10);border-radius:999px;color:rgba(255,255,255,.78)}
      `;
      document.head.appendChild(st);
    }

    // Modale (creato on-demand)
    function ensureModal() {
      let ov = document.getElementById('rubrica-pro-overlay');
      if (ov) return ov;

      ov = document.createElement('div');
      ov.id = 'rubrica-pro-overlay';
      ov.className = 'rubrica-pro-modal-overlay';
      ov.innerHTML = `
        <div class="rubrica-pro-modal" role="dialog" aria-modal="true">
          <header>
            <div>
              <h3 id="rubrica-pro-title">Scheda Contatto</h3>
              <div class="sub" id="rubrica-pro-sub">—</div>
            </div>
            <div class="rubrica-pro-actions">
              <button class="btn btn-xs" id="rubrica-pro-call">📞 Chiama</button>
              <button class="btn btn-xs" id="rubrica-pro-wa">💬 WhatsApp</button>
              <button class="btn btn-xs" id="rubrica-pro-mail">✉️ Email</button>
              <button class="btn btn-xs" id="rubrica-pro-close">✕</button>
            </div>
          </header>
          <div class="body">
            <div class="rubrica-pro-grid">
              <div class="rubrica-pro-card">
                <h4>Profilo & Priorità</h4>
                <div class="rubrica-pro-fields">
                  <div>
                    <label>Stato contatto</label>
                    <select id="rp-stato">
                      <option value="">—</option>
                      <option value="lead">Lead</option>
                      <option value="qualificato">Qualificato</option>
                      <option value="attivo">Attivo</option>
                      <option value="freddo">Freddo</option>
                      <option value="chiuso">Chiuso</option>
                    </select>
                  </div>
                  <div>
                    <label>Priorità</label>
                    <select id="rp-priority">
                      <option value="">—</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="bassa">Bassa</option>
                    </select>
                  </div>
                  <div class="full">
                    <label>Note interne</label>
                    <textarea id="rp-note" placeholder="Es. preferisce trilocale, cash buyer, urgenza 60gg..."></textarea>
                  </div>
                </div>
              </div>

              <div class="rubrica-pro-card">
                <h4>Preferenze (Acquirente/Conduttore)</h4>
                <div class="rubrica-pro-fields">
                  <div>
                    <label>Operazione</label>
                    <select id="rp-op">
                      <option value="">—</option>
                      <option value="vendita">Vendita</option>
                      <option value="affitto">Affitto</option>
                    </select>
                  </div>
                  <div>
                    <label>Tipologia</label>
                    <input id="rp-tipo" placeholder="Es. appartamento, villa, ufficio..."/>
                  </div>
                  <div>
                    <label>Città</label>
                    <input id="rp-citta" placeholder="Es. Milano"/>
                  </div>
                  <div>
                    <label>Zona</label>
                    <input id="rp-zona" placeholder="Es. Brera, Crocetta..."/>
                  </div>
                  <div>
                    <label>Budget min</label>
                    <input id="rp-bmin" type="number" min="0" step="1000" placeholder="€"/>
                  </div>
                  <div>
                    <label>Budget max</label>
                    <input id="rp-bmax" type="number" min="0" step="1000" placeholder="€"/>
                  </div>
                  <div>
                    <label>Mq min</label>
                    <input id="rp-mmin" type="number" min="0" step="1" placeholder="mq"/>
                  </div>
                  <div>
                    <label>Mq max</label>
                    <input id="rp-mmax" type="number" min="0" step="1" placeholder="mq"/>
                  </div>
                </div>
              </div>

              <div class="rubrica-pro-card">
                <h4>Matching immobili (compatibili)</h4>
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
                  <span class="rubrica-pro-pill" id="rp-match-count">0 match</span>
                  <button class="btn btn-xs" id="rp-refresh">↻ Aggiorna</button>
                  <button class="btn btn-xs" id="rp-save">💾 Salva</button>
                </div>
                <ul class="rubrica-pro-list" id="rp-match-list"></ul>
                <div class="muted" style="font-size:11px" id="rp-match-empty">Nessun match con i criteri attuali.</div>
              </div>

              <div class="rubrica-pro-card">
                <h4>Follow-up</h4>
                <div class="muted" style="font-size:12px;margin-bottom:8px" id="rp-follow">—</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button class="btn btn-xs" id="rp-touch">📌 Segna contatto</button>
                  <button class="btn btn-xs" id="rp-logcall">☎️ Log telefonata</button>
                  <button class="btn btn-xs" id="rp-logmail">✉️ Log email</button>
                  <button class="btn btn-xs" id="rp-logvisit">🏠 Log visita</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(ov);

      // chiusura
      ov.addEventListener('click', (e) => {
        if (e.target === ov) closeModal();
      });
      ov.querySelector('#rubrica-pro-close')?.addEventListener('click', closeModal);

      return ov;
    }

    function closeModal() {
      const ov = document.getElementById('rubrica-pro-overlay');
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
    }

    function openModal() {
      const ov = ensureModal();
      ov.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function normStr(s){ return (s || '').toString().trim().toLowerCase(); }
    function toNum(v){
      const n = Number((v ?? '').toString().replace(/[^\d.]/g,''));
      return isFinite(n) ? n : null;
    }

    function getGroupByKey(key) {
      const groups = (typeof groupRubrica === 'function') ? groupRubrica(contatti || []) : [];
      return (groups || []).find(g => g && g.key === key) || null;
    }

    function getPrefsForKey(key) {
      const c = (contatti || []).find(x => x && typeof buildKey==='function' && buildKey(x) === key);
      return (c && c.proPrefs) ? c.proPrefs : {};
    }

    function setPrefsForKey(key, prefs) {
      (contatti || []).forEach(c => {
        if (typeof buildKey === 'function' && buildKey(c) === key) {
          c.proPrefs = Object.assign({}, c.proPrefs || {}, prefs || {});
        }
      });
      saveList(STORAGE_KEYS.contatti, contatti);
    }

    function daysSince(isoOrNull) {
      if (!isoOrNull) return null;
      const d = new Date(isoOrNull);
      if (isNaN(d)) return null;
      const diff = Date.now() - d.getTime();
      return Math.floor(diff / (1000*60*60*24));
    }

    function findImmobileFields(i){
      // Tenta di capire i campi in modo robusto (il tuo modello potrebbe cambiare).
      const op = normStr(i?.operazione || i?.tipoOperazione || i?.venditaAffitto || i?.contratto);
      const citta = i?.citta || i?.comune || '';
      const zona = i?.zona || i?.quartiere || i?.localita || '';
      const tipo = i?.tipologia || i?.tipo || i?.categoria || '';
      const prezzo = toNum(i?.prezzo || i?.prezzoVendita || i?.canone || i?.affitto || i?.valore);
      const mq = toNum(i?.mq || i?.superficie || i?.metriQuadri);
      return { op, citta, zona, tipo, prezzo, mq };
    }

    function isMatchImm(i, prefs) {
      const f = findImmobileFields(i);
      const opPref = normStr(prefs.op || '');
      const tipoPref = normStr(prefs.tipo || '');
      const cittaPref = normStr(prefs.citta || '');
      const zonaPref = normStr(prefs.zona || '');

      if (opPref && f.op && !f.op.includes(opPref)) return false;

      if (cittaPref) {
        const ic = normStr(f.citta);
        if (ic && !ic.includes(cittaPref)) return false;
      }
      if (zonaPref) {
        const iz = normStr(f.zona);
        if (iz && !iz.includes(zonaPref)) return false;
      }
      if (tipoPref) {
        const it = normStr(f.tipo);
        if (it && !it.includes(tipoPref)) return false;
      }

      const bmin = toNum(prefs.bmin); const bmax = toNum(prefs.bmax);
      if (f.prezzo != null) {
        if (bmin != null && f.prezzo < bmin) return false;
        if (bmax != null && f.prezzo > bmax) return false;
      }

      const mmin = toNum(prefs.mmin); const mmax = toNum(prefs.mmax);
      if (f.mq != null) {
        if (mmin != null && f.mq < mmin) return false;
        if (mmax != null && f.mq > mmax) return false;
      }

      return true;
    }

    function computeMatches(prefs) {
      const arr = (immobili || []).filter(i => i && isMatchImm(i, prefs));
      // ordina: prima quelli con città/zona ok + prezzo presente
      return arr.slice(0, 50);
    }

    function setMatchList(items) {
      const ul = document.getElementById('rp-match-list');
      const empty = document.getElementById('rp-match-empty');
      const badge = document.getElementById('rp-match-count');
      if (!ul || !badge || !empty) return;

      ul.innerHTML = '';
      badge.textContent = `${items.length} match`;
      empty.style.display = items.length ? 'none' : 'block';

      items.forEach(i => {
        const f = findImmobileFields(i);
        const li = document.createElement('li');
        const title = (i.titolo || i.nome || i.indirizzo || ('Immobile ' + (i.id || ''))) + '';
        const meta = [
          f.citta || '',
          f.zona ? ('· ' + f.zona) : '',
          f.prezzo != null ? ('· €' + f.prezzo.toLocaleString('it-IT')) : '',
          f.mq != null ? ('· ' + f.mq + ' mq') : ''
        ].join(' ');
        li.innerHTML = `
          <div style="min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
            <small>${escapeHtml(meta)}</small>
          </div>
          <button class="btn btn-xs" data-pro-open-imm="${escapeHtml(i.id || '')}">Apri</button>
        `;
        ul.appendChild(li);
      });
    }

    function openRubricaPro(key) {
      const g = getGroupByKey(key);
      if (!g) return;

      const prefs = Object.assign({
        stato: '', priority: '', note: '',
        op: '', tipo: '', citta: '', zona: '',
        bmin: '', bmax: '', mmin: '', mmax: ''
      }, getPrefsForKey(key));

      openModal();

      // header
      const titleEl = document.getElementById('rubrica-pro-title');
      const subEl = document.getElementById('rubrica-pro-sub');
      if (titleEl) titleEl.textContent = g.nome || 'Scheda Contatto';
      const subParts = [];
      if (g.telefono) subParts.push(g.telefono);
      if (g.email) subParts.push(g.email);
      if (g.citta || g.provincia) subParts.push([g.citta, g.provincia].filter(Boolean).join(' '));
      if (subEl) subEl.textContent = subParts.join(' · ') || '—';

      // fill fields
      const $ = (id) => document.getElementById(id);
      if ($('rp-stato')) $('rp-stato').value = prefs.stato || '';
      if ($('rp-priority')) $('rp-priority').value = prefs.priority || '';
      if ($('rp-note')) $('rp-note').value = prefs.note || '';
      if ($('rp-op')) $('rp-op').value = prefs.op || '';
      if ($('rp-tipo')) $('rp-tipo').value = prefs.tipo || '';
      if ($('rp-citta')) $('rp-citta').value = prefs.citta || '';
      if ($('rp-zona')) $('rp-zona').value = prefs.zona || '';
      if ($('rp-bmin')) $('rp-bmin').value = prefs.bmin || '';
      if ($('rp-bmax')) $('rp-bmax').value = prefs.bmax || '';
      if ($('rp-mmin')) $('rp-mmin').value = prefs.mmin || '';
      if ($('rp-mmax')) $('rp-mmax').value = prefs.mmax || '';

      // follow-up
      const days = daysSince(g.ultimoContatto);
      const follow = $('rp-follow');
      if (follow) {
        follow.textContent = (days == null)
          ? 'Nessun contatto registrato. Suggerimento: logga un evento o usa 📌 Segna contatto.'
          : (days <= 3 ? `Ultimo contatto: ${days} gg fa (ok).` : `Ultimo contatto: ${days} gg fa → follow-up consigliato.`);
      }

      // call/wa/mail actions
      const callBtn = $('rubrica-pro-call');
      const waBtn = $('rubrica-pro-wa');
      const mailBtn = $('rubrica-pro-mail');
      const tel = (g.telefono || '').replace(/\s+/g,'');
      const mail = (g.email || '').trim();

      if (callBtn) callBtn.onclick = () => { if (tel) window.location.href = 'tel:' + tel; };
      if (waBtn) waBtn.onclick = () => { if (tel) window.open('https://wa.me/' + tel.replace(/^\+/,''), '_blank'); };
      if (mailBtn) mailBtn.onclick = () => { if (mail) window.location.href = 'mailto:' + mail; };

      // refresh/save/match
      const refresh = $('rp-refresh');
      const saveBtn = $('rp-save');

      const readPrefsFromUI = () => ({
        stato: $('rp-stato')?.value || '',
        priority: $('rp-priority')?.value || '',
        note: $('rp-note')?.value || '',
        op: $('rp-op')?.value || '',
        tipo: $('rp-tipo')?.value || '',
        citta: $('rp-citta')?.value || '',
        zona: $('rp-zona')?.value || '',
        bmin: $('rp-bmin')?.value || '',
        bmax: $('rp-bmax')?.value || '',
        mmin: $('rp-mmin')?.value || '',
        mmax: $('rp-mmax')?.value || ''
      });

      const doRefresh = () => {
        const p = readPrefsFromUI();
        const matches = computeMatches(p);
        setMatchList(matches);
      };

      if (refresh) refresh.onclick = doRefresh;
      if (saveBtn) saveBtn.onclick = () => {
        const p = readPrefsFromUI();
        setPrefsForKey(key, p);
        doRefresh();
        // riflette badge/indicatori in lista
        if (typeof renderRubrica === 'function') renderRubrica();
      };

      // log helpers
      const touchBtn = $('rp-touch');
      const logCall = $('rp-logcall');
      const logMail = $('rp-logmail');
      const logVisit = $('rp-logvisit');

      function pushEvent(tipo, nota){
        const nowIso = new Date().toISOString();
        (contatti || []).forEach(c => {
          if (typeof buildKey === 'function' && buildKey(c) === key) {
            if (!Array.isArray(c.eventi)) c.eventi = [];
            c.eventi.push({ id: (typeof genId==='function' ? genId('evt') : ('evt_' + Date.now())), data: nowIso, tipo, nota: nota || '' });
            c.ultimoContatto = nowIso;
          }
        });
        saveList(STORAGE_KEYS.contatti, contatti);
        if (typeof renderRubrica === 'function') renderRubrica();
      }

      if (touchBtn) touchBtn.onclick = () => { pushEvent('touch', 'Segnato come contatto effettuato dalla scheda PRO.'); doRefresh(); };
      if (logCall) logCall.onclick = () => {
        const nota = prompt('Nota telefonata (facoltativa):', '');
        if (nota === null) return;
        pushEvent('telefonata', (nota || '').trim());
        doRefresh();
      };
      if (logMail) logMail.onclick = () => {
        const nota = prompt('Nota email (facoltativa):', '');
        if (nota === null) return;
        pushEvent('email', (nota || '').trim());
        doRefresh();
      };
      if (logVisit) logVisit.onclick = () => {
        const nota = prompt('Nota visita (facoltativa):', '');
        if (nota === null) return;
        pushEvent('visita', (nota || '').trim());
        doRefresh();
      };

      // prima render match
      doRefresh();
    }

    // Arricchimento DOM lista rubrica: badge follow-up + bottone ⚡
    function rubricaProEnhanceDOM() {
      const container = document.getElementById('rubrica-list');
      if (!container) return;

      const rows = container.querySelectorAll('.rubrica-row');
      if (!rows.length) return;

      rows.forEach(row => {
        const actions = row.querySelector('.rubrica-actions');
        const main = row.querySelector('.rubrica-summary-main > div'); // blocco nome/ruoli
        const keyBtn = row.querySelector('.rubrica-toggle');
        const key = keyBtn?.dataset?.key || keyBtn?.getAttribute?.('data-key') || null;
        if (!key || !actions || !main) return;

        // bottone PRO (aggiunto una sola volta)
        if (!actions.querySelector('[data-pro-open]')) {
          const b = document.createElement('button');
          b.className = 'btn btn-xs';
          b.textContent = '⚡';
          b.title = 'Apri scheda PRO';
          b.setAttribute('data-pro-open', key);
          actions.insertBefore(b, actions.firstChild);
        }

        // badge follow-up (aggiunto una sola volta)
        if (!main.querySelector('.rubrica-pro-badge')) {
          const g = getGroupByKey(key);
          const days = g ? daysSince(g.ultimoContatto) : null;

          const badge = document.createElement('span');
          badge.className = 'rubrica-pro-badge ' + ((days == null || days > 7) ? 'warn' : 'ok');
          badge.innerHTML = (days == null)
            ? 'Follow-up: mai'
            : `Follow-up: ${days}gg`;
          main.appendChild(badge);
        }
      });
    }

    // Click handler (delegato): apre modale, apre immobile da match
    document.addEventListener('click', (e) => {
      const t = e.target;
      const proBtn = t.closest('[data-pro-open]');
      if (proBtn) {
        const key = proBtn.getAttribute('data-pro-open');
        if (key) openRubricaPro(key);
        return;
      }
      const openImm = t.closest('[data-pro-open-imm]');
      if (openImm) {
        const id = openImm.getAttribute('data-pro-open-imm');
        if (id && typeof openSchedaImmobile === 'function') openSchedaImmobile(id);
        return;
      }
    });

  } catch(err) {
    console.warn('[RUBRICA PRO] init error', err);
  }
  })();

/* ======================================================
   MAPPA ADDON – STABILITÀ + RICERCA + SATELLITE
   NON modifica altre sezioni del CRM
====================================================== */

(function () {

  // Stato interno mappa (non globale invasivo)
  const MAP_ADDON_STATE = {
    initialized: false,
    streetLayer: null,
    satelliteLayer: null,
    searchMarker: null
  };

  // salva riferimento all'init originale se esiste
  const _initMappaOriginal = window.initMappa;

  // override controllato
  window.initMappa = function () {

    // prima esegui init originale (marker, filtri, ecc.)
    if (typeof _initMappaOriginal === 'function') {
      _initMappaOriginal();
    }

    if (!window.MAP_STATE || !MAP_STATE.map) return;

    // evita doppia inizializzazione
    if (MAP_ADDON_STATE.initialized) {
      MAP_STATE.map.invalidateSize();
      return;
    }

    /* ===== BASE LAYERS ===== */

    MAP_ADDON_STATE.streetLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }
    );

    MAP_ADDON_STATE.satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles © Esri'
      }
    );

    // aggiungi controllo layer solo una volta
    L.control.layers(
      {
        'Strade': MAP_ADDON_STATE.streetLayer,
        'Satellite': MAP_ADDON_STATE.satelliteLayer
      },
      {}
    ).addTo(MAP_STATE.map);

    /* ===== RICERCA INDIRIZZO ===== */

    const searchControl = L.control({ position: 'topright' });

    searchControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      div.style.background = '#020617';
      div.style.padding = '6px';

      div.innerHTML = `
        <input id="map-address-search"
               type="text"
               placeholder="Cerca indirizzo…"
               style="width:180px;padding:4px;border-radius:6px;border:1px solid #374151;">
      `;

      L.DomEvent.disableClickPropagation(div);
      return div;
    };

    searchControl.addTo(MAP_STATE.map);

    document
      .getElementById('map-address-search')
      .addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;

        const q = e.target.value.trim();
        if (!q) return;

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`)
          .then(r => r.json())
          .then(res => {
            if (!res || !res.length) return;

            const lat = parseFloat(res[0].lat);
            const lon = parseFloat(res[0].lon);

            if (MAP_ADDON_STATE.searchMarker) {
              MAP_STATE.map.removeLayer(MAP_ADDON_STATE.searchMarker);
            }

            MAP_ADDON_STATE.searchMarker = L.marker([lat, lon])
              .addTo(MAP_STATE.map)
              .bindPopup(q)
              .openPopup();

            MAP_STATE.map.setView([lat, lon], 16);
          });
      });

    MAP_ADDON_STATE.initialized = true;
  };

})();