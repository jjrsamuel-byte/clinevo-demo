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
})();
