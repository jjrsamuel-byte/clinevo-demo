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

  // When the AI receptionist books an appointment, jump the diary to that
  // date so the prospect sees the slot fill in live during the demo call.
  SSE.on('appointments:created', (appt) => {
    if (!appt || appt.createdBy !== 'ai-receptionist') return;
    if (appt.date) State.set('currentDate', appt.date);
    if (State.get('currentView') !== 'calendar') {
      State.set('currentView', 'calendar');
    }
  });
})();
