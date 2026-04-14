// App init and routing
(async function() {
  // Load lookup data
  await State.loadLookups();

  // Connect SSE
  SSE.connect();

  // Init modal
  Modal.init();

  // Render shell
  renderSidebar();
  renderTopbar();

  // View routing
  const views = {
    dashboard: DashboardView,
    callLog: CallLogView,
    calendar: CalendarView,
    clients: ClientsView,
    patients: PatientsView,
    staff: StaffView,
    comms: CommsView,
    auditLog: AuditLogView
  };

  async function renderCurrentView() {
    const view = State.get('currentView');
    const handler = views[view];
    if (handler) {
      await handler.render();
      renderSidebar(); // Update active state
    }
  }

  State.on('currentView', renderCurrentView);

  // Initial render
  await renderCurrentView();

  // If AI drawer was open, render it
  if (State.get('aiDrawerOpen')) {
    AIPanel.render();
  }

  // When the AI receptionist books OR reschedules an appointment, jump the
  // diary to the new date so the prospect sees the slot fill in / move live
  // during the demo call. Both events use the same handler — book_appointment
  // upserts in place, so a "move" from the call arrives as appointments:updated.
  const jumpToAiBooking = (appt) => {
    if (!appt || appt.createdBy !== 'ai-receptionist') return;
    if (appt.date) State.set('currentDate', appt.date);
    if (State.get('currentView') !== 'calendar') {
      State.set('currentView', 'calendar');
    } else {
      // Already on calendar — force a reload so the block repositions even if
      // the date didn't change (e.g. same-day time shift).
      if (typeof CalendarView !== 'undefined' && CalendarView.loadCalendar) {
        CalendarView.loadCalendar();
      }
    }
  };
  SSE.on('appointments:created', jumpToAiBooking);
  SSE.on('appointments:updated', jumpToAiBooking);
})();
