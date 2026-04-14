// Communications view
const CommsView = {
  currentFilter: 'all',

  async render() {
    // Check for pending filter from dashboard deep-link
    const pending = State.get('viewFilter');
    if (pending && pending.view === 'comms' && pending.filter) {
      this.currentFilter = pending.filter;
      State.set('viewFilter', null);
    }

    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Communications</h2>
        <button class="btn btn-teal btn-sm" id="comms-send-all">📤 Send All Pending</button>
      </div>
      <div class="filter-tabs" id="comms-filter">
        <button ${this.currentFilter === 'all' ? 'class="active"' : ''} data-filter="all">All</button>
        <button ${this.currentFilter === 'appointment_reminder' ? 'class="active"' : ''} data-filter="appointment_reminder">Reminders</button>
        <button ${this.currentFilter === 'post_visit_followup' ? 'class="active"' : ''} data-filter="post_visit_followup">Follow-ups</button>
        <button ${this.currentFilter === 'vaccination_due' ? 'class="active"' : ''} data-filter="vaccination_due">Vaccination</button>
        <button ${this.currentFilter === 'prescription_refill' ? 'class="active"' : ''} data-filter="prescription_refill">Prescriptions</button>
      </div>
      <div class="card">
        <table class="data-table" id="comms-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Channel</th>
              <th>Message</th>
              <th>Status</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody id="comms-body"></tbody>
        </table>
      </div>
    `;

    document.getElementById('comms-send-all').addEventListener('click', () => this.sendAllPending());

    document.querySelectorAll('#comms-filter button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#comms-filter button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.loadComms();
      });
    });

    await this.loadComms();
  },

  async loadComms() {
    const params = this.currentFilter !== 'all' ? { type: this.currentFilter } : {};
    const comms = await API.comms.list(params);

    const tbody = document.getElementById('comms-body');
    if (!tbody) return;

    if (comms.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:40px">No communications yet</td></tr>`;
      return;
    }

    const typeLabels = {
      appointment_reminder: 'Reminder',
      vaccination_due: 'Vaccination',
      post_visit_followup: 'Follow-up',
      prescription_refill: 'Prescription'
    };
    const typeIcons = {
      appointment_reminder: '📅',
      vaccination_due: '💉',
      post_visit_followup: '📋',
      prescription_refill: '💊'
    };

    tbody.innerHTML = comms.map(c => {
      const label = typeLabels[c.type] || c.type;
      const icon = typeIcons[c.type] || '📩';
      const statusClass = c.status === 'sent' ? 'tag-status' : c.status === 'pending' ? 'tag-pending' : 'tag-missed';
      const timeStr = c.sentAt ? NotificationCard.formatTimeAgo(c.sentAt) : '—';
      const msgPreview = c.message.length > 80 ? c.message.substring(0, 80) + '...' : c.message;

      return `
        <tr data-comm-id="${c.id}">
          <td><span class="tag tag-species">${icon} ${label}</span></td>
          <td>${c.channel.toUpperCase()}</td>
          <td class="text-small">${msgPreview}</td>
          <td><span class="tag ${statusClass}">${c.status}</span></td>
          <td class="text-small text-muted">${timeStr}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-comm-id]').forEach(row => {
      row.addEventListener('click', () => {
        const comm = comms.find(c => c.id === Number(row.dataset.commId));
        if (comm) this.showDetail(comm);
      });
    });
  },

  showDetail(comm) {
    const typeLabels = {
      appointment_reminder: 'Appointment Reminder',
      vaccination_due: 'Vaccination Due',
      post_visit_followup: 'Follow-up',
      prescription_refill: 'Prescription Refill'
    };
    Modal.open(`
      <h3>${typeLabels[comm.type] || comm.type}</h3>
      <div class="modal-field"><label>Channel</label><div class="value">${comm.channel.toUpperCase()}</div></div>
      <div class="modal-field"><label>Status</label><div class="value"><span class="tag ${comm.status === 'sent' ? 'tag-status' : 'tag-pending'}">${comm.status}</span></div></div>
      <div class="modal-field"><label>Message</label><div class="value">${comm.message}</div></div>
      ${comm.sentAt ? `<div class="modal-field"><label>Sent</label><div class="value">${new Date(comm.sentAt).toLocaleString('en-GB')}</div></div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  },

  async sendAllPending() {
    const btn = document.getElementById('comms-send-all');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      await API.post('/comms/send-all');
      await this.loadComms();
    } catch (err) {
      console.error('Send all error:', err);
    }

    btn.disabled = false;
    btn.textContent = '📤 Send All Pending';
  }
};

// SSE: new comms appear live
SSE.on('comms:created', () => {
  if (State.get('currentView') === 'comms') CommsView.loadComms();
});
