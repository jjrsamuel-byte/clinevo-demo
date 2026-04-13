// Call Log view
const CallLogView = {
  currentFilter: 'all',

  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Call Log</h2>
      </div>
      <div class="filter-tabs" id="call-filter">
        <button class="active" data-filter="all">All</button>
        <button data-filter="appointment_booked">Booked</button>
        <button data-filter="info_provided">Info</button>
        <button data-filter="callback_requested">Callback</button>
        <button data-filter="emergency_escalated">Emergency</button>
        <button data-filter="missed">Missed</button>
      </div>
      <div class="card">
        <table class="data-table" id="calls-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Client</th>
              <th>Patient</th>
              <th>Outcome</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody id="calls-body"></tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('#call-filter button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#call-filter button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.loadCalls();
      });
    });

    await this.loadCalls();
  },

  async loadCalls() {
    const params = {};
    if (this.currentFilter === 'missed') {
      params.status = 'missed';
    } else if (this.currentFilter !== 'all') {
      params.outcome = this.currentFilter;
    }

    const calls = await API.calls.list(params);
    const tbody = document.getElementById('calls-body');
    if (!tbody) return;

    if (calls.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No calls found</td></tr>`;
      return;
    }

    // Pre-fetch client and patient names
    const [clients, patients] = await Promise.all([
      API.clients.list(),
      API.patients.list()
    ]);
    const clientMap = {};
    clients.forEach(c => clientMap[c.id] = `${c.firstName} ${c.lastName}`);
    const patientMap = {};
    patients.forEach(p => patientMap[p.id] = p.name);

    tbody.innerHTML = calls.map(c => {
      const outcomeLabel = this.formatOutcome(c.outcome, c.status);
      const outcomeClass = this.outcomeClass(c.outcome, c.status);
      const clientName = c.clientId ? (clientMap[c.clientId] || 'Unknown') : '—';
      const patientName = c.patientId ? (patientMap[c.patientId] || 'Unknown') : '—';

      return `
        <tr data-call-id="${c.id}">
          <td>${this.formatDate(c.date)}</td>
          <td>${c.startTime}</td>
          <td>${c.duration > 0 ? c.duration + ' min' : '—'}</td>
          <td>${clientName}</td>
          <td>${patientName}</td>
          <td><span class="tag ${outcomeClass}">${outcomeLabel}</span></td>
          <td class="text-small">${c.resolution || '—'}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-call-id]').forEach(row => {
      row.addEventListener('click', () => {
        const call = calls.find(c => c.id === Number(row.dataset.callId));
        if (call) this.showDetail(call, clientMap, patientMap);
      });
    });
  },

  showDetail(call, clientMap, patientMap) {
    const clientName = call.clientId ? (clientMap[call.clientId] || 'Unknown') : 'Unknown caller';
    const patientName = call.patientId ? (patientMap[call.patientId] || 'Unknown') : '—';
    const outcomeLabel = this.formatOutcome(call.outcome, call.status);

    Modal.open(`
      <h3>Call Detail</h3>
      <div class="modal-field"><label>Call ID</label><div class="value">${call.callId}</div></div>
      <div class="modal-field"><label>Date & Time</label><div class="value">${this.formatDate(call.date)} at ${call.startTime}${call.endTime ? ' – ' + call.endTime : ''}</div></div>
      <div class="modal-field"><label>Duration</label><div class="value">${call.duration > 0 ? call.duration + ' minutes' : 'N/A'}</div></div>
      <div class="modal-field"><label>Client</label><div class="value">${clientName}</div></div>
      <div class="modal-field"><label>Patient</label><div class="value">${patientName}</div></div>
      <div class="modal-field"><label>Status</label><div class="value">${call.status}</div></div>
      <div class="modal-field"><label>Outcome</label><div class="value">${outcomeLabel}</div></div>
      <div class="modal-field"><label>Resolution</label><div class="value">${call.resolution || '—'}</div></div>
      ${call.notes ? `<div class="modal-field"><label>Notes</label><div class="value">${call.notes}</div></div>` : ''}
      <div class="modal-field"><label>Handled By</label><div class="value">${call.createdBy === 'ai-receptionist' ? 'Clinevo AI Receptionist' : call.createdBy}</div></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  },

  formatOutcome(outcome, status) {
    if (status === 'missed') return 'Missed';
    const labels = {
      appointment_booked: 'Appointment Booked',
      info_provided: 'Info Provided',
      callback_requested: 'Callback Requested',
      emergency_escalated: 'Emergency'
    };
    return labels[outcome] || outcome || 'Unknown';
  },

  outcomeClass(outcome, status) {
    if (status === 'missed') return 'tag-missed';
    const classes = {
      appointment_booked: 'tag-booked',
      info_provided: 'tag-info',
      callback_requested: 'tag-callback',
      emergency_escalated: 'tag-emergency'
    };
    return classes[outcome] || '';
  },

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
};

// SSE: refresh on new calls
SSE.on('calls:created', () => {
  if (State.get('currentView') === 'callLog') CallLogView.loadCalls();
});
