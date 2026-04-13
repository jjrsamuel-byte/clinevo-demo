function renderSidebar() {
  const el = document.getElementById('sidebar');
  const currentView = State.get('currentView');

  const links = [
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { id: 'clients', icon: '👥', label: 'Clients' },
    { id: 'patients', icon: '🐾', label: 'Patients' },
    { id: 'staff', icon: '🩺', label: 'Staff' },
    { id: 'comms', icon: '💬', label: 'Communications' }
  ];

  el.innerHTML = `
    <div class="sidebar-logo">
      <h2>Oakwood Vets</h2>
      <span>Practice Manager</span>
    </div>
    <nav class="sidebar-nav">
      ${links.map(l => `
        <a href="#" data-view="${l.id}" class="${currentView === l.id ? 'active' : ''}">
          <span class="icon">${l.icon}</span>
          ${l.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="powered-by">Powered by</div>
      <div class="clinevo-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#45C4BC" stroke-width="2"/><path d="M8 12l3 3 5-5" stroke="#45C4BC" stroke-width="2" stroke-linecap="round"/></svg>
        Clinevo AI
      </div>
    </div>
  `;

  el.querySelectorAll('[data-view]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      State.set('currentView', a.dataset.view);
    });
  });
}

State.on('currentView', renderSidebar);
