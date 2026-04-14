// Calendar view
const CalendarView = {
  async render() {
    // Check for pending date from dashboard deep-link
    const pending = State.get('viewFilter');
    if (pending && pending.view === 'calendar' && pending.date) {
      State.set('currentDate', pending.date);
      State.set('viewFilter', null);
    }

    const main = document.getElementById('main');
    const date = State.get('currentDate');
    const mode = State.get('calendarMode');

    main.innerHTML = `
      <div class="calendar-header">
        <div class="flex items-center gap-16">
          <h2>Calendar</h2>
          <div class="calendar-nav">
            <button class="btn btn-sm btn-ghost" id="cal-prev">◀</button>
            <button class="btn btn-sm btn-secondary" id="cal-today">Today</button>
            <button class="btn btn-sm btn-ghost" id="cal-next">▶</button>
          </div>
          <span class="calendar-date-label" id="cal-date-label"></span>
        </div>
        <div class="calendar-view-toggle">
          <button class="${mode === 'day' ? 'active' : ''}" data-mode="day">Day</button>
          <button class="${mode === 'week' ? 'active' : ''}" data-mode="week">Week</button>
        </div>
      </div>
      <div class="calendar-container" id="cal-grid"></div>
    `;

    // Navigation
    document.getElementById('cal-prev').addEventListener('click', () => {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() - (mode === 'week' ? 7 : 1));
      State.set('currentDate', d.toISOString().split('T')[0]);
    });

    document.getElementById('cal-next').addEventListener('click', () => {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() + (mode === 'week' ? 7 : 1));
      State.set('currentDate', d.toISOString().split('T')[0]);
    });

    document.getElementById('cal-today').addEventListener('click', () => {
      State.set('currentDate', new Date().toISOString().split('T')[0]);
    });

    document.querySelectorAll('.calendar-view-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        State.set('calendarMode', btn.dataset.mode);
      });
    });

    await this.loadCalendar();
  },

  getWeekDates(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Sun, 1=Mon
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      // Use local date parts to avoid UTC timezone shift
      const y = dd.getFullYear();
      const m = String(dd.getMonth() + 1).padStart(2, '0');
      const day2 = String(dd.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day2}`);
    }
    return dates;
  },

  async loadCalendar() {
    const date = State.get('currentDate');
    const mode = State.get('calendarMode');
    const vets = State.get('staff').filter(s =>
      s.role.includes('Veterinary Surgeon') || s.role.includes('Nurse')
    ).filter(s => s.role !== 'Head Receptionist');

    let appointments;

    if (mode === 'week') {
      const weekDates = this.getWeekDates(date);
      appointments = await API.appointments.listRange(weekDates[0], weekDates[4]);

      // Update date label
      const labelEl = document.getElementById('cal-date-label');
      if (labelEl) {
        const mon = new Date(weekDates[0] + 'T00:00:00');
        const fri = new Date(weekDates[4] + 'T00:00:00');
        labelEl.textContent = `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
    } else {
      appointments = await API.appointments.list({ date });

      const labelEl = document.getElementById('cal-date-label');
      if (labelEl) {
        labelEl.textContent = State.formatDate(date);
      }
    }

    // Pre-cache patients for display
    const patientIds = [...new Set(appointments.map(a => a.patientId))];
    await Promise.all(patientIds.map(id => State.getPatient(id)));

    const container = document.getElementById('cal-grid');
    if (!container) return;

    if (mode === 'week') {
      const weekDates = this.getWeekDates(date);
      CalendarGrid.renderWeek(appointments, vets, weekDates, container);
    } else {
      CalendarGrid.render(appointments, vets, container);
    }
  }
};

// Re-render calendar when date changes
State.on('currentDate', () => {
  if (State.get('currentView') === 'calendar') CalendarView.render();
});

State.on('calendarMode', () => {
  if (State.get('currentView') === 'calendar') CalendarView.render();
});

// SSE: re-render on appointment changes
SSE.on('appointments:created', () => {
  if (State.get('currentView') === 'calendar') CalendarView.loadCalendar();
});

SSE.on('appointments:updated', () => {
  if (State.get('currentView') === 'calendar') CalendarView.loadCalendar();
});

SSE.on('reset', () => {
  if (State.get('currentView') === 'calendar') CalendarView.loadCalendar();
});
