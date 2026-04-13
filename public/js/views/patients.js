// Patients view
const PatientsView = {
  currentFilter: 'all',

  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Patients</h2>
      </div>
      <div class="filter-tabs" id="species-filter">
        <button class="active" data-filter="all">All</button>
        <button data-filter="Cat">Cats</button>
        <button data-filter="Dog">Dogs</button>
        <button data-filter="other">Other</button>
      </div>
      <div class="card-grid" id="patients-grid"></div>
    `;

    document.querySelectorAll('#species-filter button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#species-filter button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.loadPatients();
      });
    });

    await this.loadPatients();
  },

  async loadPatients() {
    let patients = await API.patients.list();

    if (this.currentFilter === 'other') {
      patients = patients.filter(p => p.species !== 'Cat' && p.species !== 'Dog');
    } else if (this.currentFilter !== 'all') {
      patients = patients.filter(p => p.species === this.currentFilter);
    }

    const grid = document.getElementById('patients-grid');
    if (!grid) return;

    grid.innerHTML = patients.map(p => {
      const age = this.calcAge(p.dateOfBirth);
      return `
        <div class="patient-card" data-id="${p.id}">
          <div class="species-icon">${State.getSpeciesIcon(p.species)}</div>
          <div class="patient-name">${p.name}</div>
          <div class="patient-breed">${p.breed} · ${p.sex}</div>
          <div class="text-small text-muted mb-8">${age} · ${p.weight}kg</div>
          <div class="patient-meta">
            <span class="tag tag-species">${p.species}</span>
            ${(p.alerts || []).map(a => `<span class="tag tag-alert">${a}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.patient-card').forEach(card => {
      card.addEventListener('click', () => this.showPatient(Number(card.dataset.id)));
    });
  },

  formatTimeAgo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },

  calcAge(dob) {
    const birth = new Date(dob);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    if (years < 1) return `${Math.max(1, months + (years * 12))} months`;
    if (years === 1 && months < 0) return `${12 + months} months`;
    return `${years} year${years !== 1 ? 's' : ''} old`;
  },

  async showPatient(id) {
    const data = await API.patients.get(id);
    const client = data.client;
    const clientName = client ? `${client.title || ''} ${client.firstName} ${client.lastName}`.trim() : 'Unknown';

    Modal.open(`
      <h3>${State.getSpeciesIcon(data.species)} ${data.name}</h3>
      <div class="modal-field">
        <label>Breed</label>
        <div class="value">${data.breed} (${data.colour})</div>
      </div>
      <div class="modal-field">
        <label>Sex</label>
        <div class="value">${data.sex}</div>
      </div>
      <div class="modal-field">
        <label>Age / DOB</label>
        <div class="value">${this.calcAge(data.dateOfBirth)} — Born ${new Date(data.dateOfBirth).toLocaleDateString('en-GB')}</div>
      </div>
      <div class="modal-field">
        <label>Weight</label>
        <div class="value">${data.weight} kg</div>
      </div>
      <div class="modal-field">
        <label>Microchip</label>
        <div class="value">${data.microchip || 'Not chipped'}</div>
      </div>
      <div class="modal-field">
        <label>Owner</label>
        <div class="value">${clientName}${client ? ` — ${client.phone}` : ''}</div>
      </div>
      ${data.notes ? `
        <div class="modal-field">
          <label>Notes</label>
          <div class="value">${data.notes}</div>
        </div>
      ` : ''}
      ${data.alerts && data.alerts.length ? `
        <div class="modal-field">
          <label>Alerts</label>
          <div class="value">${data.alerts.map(a => `<span class="tag tag-alert">${a}</span>`).join(' ')}</div>
        </div>
      ` : ''}
      ${data.vaccinationDue ? `
        <div class="modal-field">
          <label>Vaccination Due</label>
          <div class="value">${new Date(data.vaccinationDue).toLocaleDateString('en-GB')}</div>
        </div>
      ` : ''}
      <div style="border-top:1px solid var(--border-light);margin:16px 0 12px;padding-top:12px">
        <h4 style="font-size:13px;margin-bottom:10px;color:var(--clinevo-purple)">Activity & Communications</h4>
      </div>
      <div class="modal-field">
        <label>Last Action</label>
        <div class="value">${data.lastAction
          ? `<span class="tag ${data.lastAction.type === 'call' ? 'tag-booked' : 'tag-info'}">${data.lastAction.type === 'call' ? '📞 Call' : '📤 Comms'}</span> ${data.lastAction.description} <span class="text-small text-muted">(${this.formatTimeAgo(data.lastAction.date)})</span>`
          : '<span class="text-muted">No activity recorded</span>'
        }</div>
      </div>
      <div class="modal-field">
        <label>Next Communication</label>
        <div class="value">${data.nextComm
          ? `<span class="tag tag-pending">⏳ Pending</span> ${data.nextComm.message.substring(0, 80)}...`
          : data.lastAction
            ? '<span class="tag tag-status">✓ All sent</span> No pending communications'
            : '<span class="text-muted">None scheduled</span>'
        }</div>
      </div>
      ${data.lastCall ? `
        <div class="modal-field">
          <label>Last Call</label>
          <div class="value">${data.lastCall.resolution || 'Phone call'} <span class="text-small text-muted">(${data.lastCall.date})</span></div>
        </div>
      ` : ''}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  }
};
