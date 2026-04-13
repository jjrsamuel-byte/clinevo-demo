function renderSidebar() {
  const el = document.getElementById('sidebar');
  const currentView = State.get('currentView');

  const pmsLinks = [
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { id: 'clients', icon: '👥', label: 'Clients' },
    { id: 'patients', icon: '🐾', label: 'Patients' },
    { id: 'staff', icon: '🩺', label: 'Staff' }
  ];

  const clinevoLinks = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'callLog', icon: '☎️', label: 'Call Log' },
    { id: 'comms', icon: '💬', label: 'Communications' },
    { id: 'auditLog', icon: '📋', label: 'Audit Log' }
  ];

  el.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-brand-mark">
        <svg width="28" height="28" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.63,14.77 A9,9 0 1 1 17.63,5.23" fill="none" stroke="#534AB7" stroke-width="2.2" stroke-linecap="butt"/>
          <path d="M14.75,12.97 A5.6,5.6 0 1 1 14.75,7.03" fill="none" stroke="#45C4BC" stroke-width="1.5" stroke-linecap="butt"/>
          <path d="M12.37,11.48 A2.8,2.8 0 1 1 12.37,8.52" fill="none" stroke="#DCE0EC" stroke-width="1.2" stroke-linecap="butt"/>
          <line x1="1" y1="8.79" x2="1" y2="11.21" stroke="#534AB7" stroke-width="1.43" stroke-linecap="butt"/>
          <line x1="4.4" y1="9.17" x2="4.4" y2="10.83" stroke="#45C4BC" stroke-width="0.98" stroke-linecap="butt"/>
          <line x1="7.2" y1="9.34" x2="7.2" y2="10.66" stroke="#DCE0EC" stroke-width="0.78" stroke-linecap="butt"/>
        </svg>
      </div>
      <div>
        <h2>Clinevo</h2>
        <span>AI Receptionist</span>
      </div>
    </div>
    <div class="sidebar-practice-name">
      <span class="practice-dot"></span>
      Oakwood Veterinary Practice
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">
        <span class="sidebar-section-icon">🏥</span>
        Practice Management
      </div>
      ${pmsLinks.map(l => `
        <a href="#" data-view="${l.id}" class="${currentView === l.id ? 'active' : ''}">
          <span class="icon">${l.icon}</span>
          ${l.label}
        </a>
      `).join('')}
      <div class="sidebar-section-divider"></div>
      <div class="sidebar-section-label">
        <span class="sidebar-section-icon sidebar-section-icon-clinevo">
          <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.63,14.77 A9,9 0 1 1 17.63,5.23" fill="none" stroke="#534AB7" stroke-width="2.2"/>
            <path d="M14.75,12.97 A5.6,5.6 0 1 1 14.75,7.03" fill="none" stroke="#45C4BC" stroke-width="1.5"/>
          </svg>
        </span>
        Clinevo AI
      </div>
      ${clinevoLinks.map(l => `
        <a href="#" data-view="${l.id}" class="${currentView === l.id ? 'active' : ''}">
          <span class="icon">${l.icon}</span>
          ${l.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="clinevo-tagline">AI for clinics that care.</div>
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
