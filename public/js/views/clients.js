// Clients view
const ClientsView = {
  pendingFilter: null,

  async render() {
    // Check for pending filter from dashboard deep-link
    const pending = State.get('viewFilter');
    if (pending && pending.view === 'clients') {
      this.pendingFilter = pending.filter || null;
      State.set('viewFilter', null);
    } else {
      this.pendingFilter = null;
    }

    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Clients</h2>
        ${this.pendingFilter === 'ai-created' ? '<button class="btn btn-sm" id="clients-clear-filter" style="margin-left:8px">✕ Showing AI-registered only</button>' : ''}
      </div>
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="client-search" placeholder="Search by name, phone, or email...">
      </div>
      <div class="card">
        <table class="data-table" id="clients-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Postcode</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="clients-tbody"></tbody>
        </table>
      </div>
    `;

    document.getElementById('client-search').addEventListener('input', (e) => {
      this.pendingFilter = null; // clear filter when user searches
      const clearBtn = document.getElementById('clients-clear-filter');
      if (clearBtn) clearBtn.remove();
      this.loadClients(e.target.value);
    });

    const clearBtn = document.getElementById('clients-clear-filter');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.pendingFilter = null;
        clearBtn.remove();
        this.loadClients();
      });
    }

    await this.loadClients();
  },

  async loadClients(search = '') {
    const params = search ? { search } : {};
    let clients = await API.clients.list(params);
    if (this.pendingFilter === 'ai-created') {
      clients = clients.filter(c => c.createdBy === 'ai-receptionist');
    }
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    // Sort AI-registered clients to the top so new entries are instantly visible
    clients.sort((a, b) => {
      const aiA = a.createdBy === 'ai-receptionist' ? 0 : 1;
      const aiB = b.createdBy === 'ai-receptionist' ? 0 : 1;
      if (aiA !== aiB) return aiA - aiB;
      return (b.id || 0) - (a.id || 0);
    });

    tbody.innerHTML = clients.map(c => `
      <tr data-id="${c.id}" class="${c.createdBy === 'ai-receptionist' ? 'row-new-client' : ''}">
        <td>
          ${c.createdBy === 'ai-receptionist' ? '<span class="new-client-dot" title="Registered by AI receptionist"></span>' : ''}
          <strong>${c.title || ''} ${c.firstName} ${c.lastName}</strong>
          ${c.createdBy === 'ai-receptionist' ? '<span class="tag tag-new-client">NEW — AI</span>' : ''}
        </td>
        <td>${c.phone}</td>
        <td>${c.email}</td>
        <td>${c.postcode}</td>
        <td class="text-muted text-small">${c.notes || '—'}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => this.showClient(Number(row.dataset.id)));
    });
  },

  async showClient(id) {
    const client = await API.clients.get(id);
    const patients = client.patients || [];

    Modal.open(`
      <h3>${client.title || ''} ${client.firstName} ${client.lastName} ${client.createdBy === 'ai-receptionist' ? '<span class="tag tag-new-client">NEW — AI Registered</span>' : ''}</h3>
      <div class="modal-field">
        <label>Phone</label>
        <div class="value">${client.phone}</div>
      </div>
      <div class="modal-field">
        <label>Email</label>
        <div class="value">${client.email}</div>
      </div>
      <div class="modal-field">
        <label>Address</label>
        <div class="value">${client.address}, ${client.postcode}</div>
      </div>
      ${client.notes ? `
        <div class="modal-field">
          <label>Notes</label>
          <div class="value">${client.notes}</div>
        </div>
      ` : ''}
      <div class="modal-field">
        <label>Patients (${patients.length})</label>
        <div class="value">
          ${patients.map(p => `
            <div class="mt-8">
              ${State.getSpeciesIcon(p.species)} <strong>${p.name}</strong> — ${p.breed} (${p.species})
              ${p.alerts && p.alerts.length ? p.alerts.map(a => `<span class="tag tag-alert">${a}</span>`).join(' ') : ''}
            </div>
          `).join('')}
          ${patients.length === 0 ? '<span class="text-muted">No patients registered</span>' : ''}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  }
};

// SSE: refresh on new/updated client. If the user isn't currently on the
// clients view, flash the sidebar item so they know something landed.
const _refreshClients = () => {
  if (State.get('currentView') === 'clients') {
    ClientsView.loadClients();
  } else {
    const navBtn = document.querySelector('[data-view="clients"]');
    if (navBtn) {
      navBtn.classList.add('nav-flash');
      setTimeout(() => navBtn.classList.remove('nav-flash'), 3000);
    }
  }
};
SSE.on('clients:created', _refreshClients);
SSE.on('clients:updated', _refreshClients);
SSE.on('patients:created', _refreshClients);
