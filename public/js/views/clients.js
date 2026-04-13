// Clients view
const ClientsView = {
  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Clients</h2>
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
      this.loadClients(e.target.value);
    });

    await this.loadClients();
  },

  async loadClients(search = '') {
    const params = search ? { search } : {};
    const clients = await API.clients.list(params);
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    tbody.innerHTML = clients.map(c => `
      <tr data-id="${c.id}">
        <td><strong>${c.title || ''} ${c.firstName} ${c.lastName}</strong></td>
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
      <h3>${client.title || ''} ${client.firstName} ${client.lastName}</h3>
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
