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
      <div class="card" style="overflow-x:auto">
        <table class="data-table" id="calls-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Client</th>
              <th>Patient</th>
              <th>Outcome</th>
              <th>Successful</th>
              <th>Sentiment</th>
              <th>Summary</th>
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
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:40px">No calls found</td></tr>`;
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
      const successIcon = c.status === 'missed' ? '—' : (c.successful ? '<span class="tag tag-status">Yes</span>' : '<span class="tag tag-alert">No</span>');
      const sentimentTag = this.sentimentTag(c.sentiment);
      const summaryPreview = c.summary ? (c.summary.length > 60 ? c.summary.substring(0, 60) + '...' : c.summary) : '—';

      return `
        <tr data-call-id="${c.id}">
          <td>${this.formatDate(c.date)}</td>
          <td>${c.startTime}</td>
          <td>${clientName}</td>
          <td>${patientName}</td>
          <td><span class="tag ${outcomeClass}">${outcomeLabel}</span></td>
          <td>${successIcon}</td>
          <td>${sentimentTag}</td>
          <td class="text-small">${summaryPreview}</td>
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
    const successLabel = call.status === 'missed' ? 'N/A' : (call.successful ? '<span class="tag tag-status">Successful</span>' : '<span class="tag tag-alert">Unsuccessful</span>');
    const sentimentLabel = this.sentimentTag(call.sentiment);

    Modal.open(`
      <h3>Call Detail</h3>
      <div class="modal-field"><label>Call ID</label><div class="value">${call.callId}</div></div>
      <div class="modal-field"><label>Date & Time</label><div class="value">${this.formatDate(call.date)} at ${call.startTime}${call.endTime ? ' – ' + call.endTime : ''}</div></div>
      <div class="modal-field"><label>Duration</label><div class="value">${call.duration > 0 ? call.duration + ' minutes' : 'N/A'}</div></div>
      <div class="modal-field"><label>Client</label><div class="value">${clientName}</div></div>
      <div class="modal-field"><label>Patient</label><div class="value">${patientName}</div></div>
      <div class="modal-field"><label>Outcome</label><div class="value"><span class="tag ${this.outcomeClass(call.outcome, call.status)}">${outcomeLabel}</span></div></div>
      <div class="modal-field"><label>Successful</label><div class="value">${successLabel}</div></div>
      <div class="modal-field"><label>Client Sentiment</label><div class="value">${sentimentLabel}</div></div>
      ${call.summary ? `<div class="modal-field"><label>Call Summary</label><div class="value">${call.summary}</div></div>` : ''}
      <div class="modal-field"><label>Resolution</label><div class="value">${call.resolution || '—'}</div></div>
      ${call.notes ? `<div class="modal-field"><label>Notes</label><div class="value">${call.notes}</div></div>` : ''}
      <div class="modal-field"><label>Handled By</label><div class="value">${call.createdBy === 'ai-receptionist' ? 'Clinevo AI Receptionist' : call.createdBy}</div></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  },

  sentimentTag(sentiment) {
    if (!sentiment) return '—';
    const config = {
      positive: { icon: '😊', cls: 'tag-status' },
      neutral: { icon: '😐', cls: 'tag-info' },
      anxious: { icon: '😰', cls: 'tag-callback' },
      concerned: { icon: '😟', cls: 'tag-callback' },
      negative: { icon: '😠', cls: 'tag-emergency' }
    };
    const c = config[sentiment] || { icon: '❓', cls: '' };
    return `<span class="tag ${c.cls}">${c.icon} ${sentiment}</span>`;
  },

  formatOutcome(outcome, status) {
    if (status === 'missed') return 'Missed';
    const labels = {
      appointment_booked: 'Booked',
      info_provided: 'Info',
      callback_requested: 'Callback',
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
