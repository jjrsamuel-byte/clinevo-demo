// Calendar view
const CalendarView = {
  async render() {
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

  async loadCalendar() {
    const date = State.get('currentDate');
    const vets = State.get('staff').filter(s =>
      s.role.includes('Veterinary Surgeon') || s.role.includes('Nurse')
    ).filter(s => s.role !== 'Head Receptionist');

    const appointments = await API.appointments.list({ date });

    // Pre-cache patients for display
    const patientIds = [...new Set(appointments.map(a => a.patientId))];
    await Promise.all(patientIds.map(id => State.getPatient(id)));

    const container = document.getElementById('cal-grid');
    if (container) {
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
