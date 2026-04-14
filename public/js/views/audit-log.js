// Audit Log — unified timeline of all activity
const AuditLogView = {
  currentFilter: 'all',

  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="view-header">
        <h2>Audit Log</h2>
      </div>
      <div class="filter-tabs" id="audit-filter">
        <button class="active" data-filter="all">All</button>
        <button data-filter="call">📞 Calls</button>
        <button data-filter="sms">💬 SMS</button>
        <button data-filter="email">📧 Email</button>
        <button data-filter="whatsapp">📱 WhatsApp</button>
        <button data-filter="phone">☎️ Phone</button>
      </div>
      <div id="audit-list"></div>
    `;

    document.querySelectorAll('#audit-filter button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#audit-filter button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.loadAudit();
      });
    });

    await this.loadAudit();
  },

  async loadAudit() {
    const [calls, comms, clients, patients] = await Promise.all([
      API.calls.list(),
      API.comms.list(),
      API.clients.list(),
      API.patients.list()
    ]);

    const clientMap = {};
    clients.forEach(c => clientMap[c.id] = `${c.firstName} ${c.lastName}`);
    const patientMap = {};
    patients.forEach(p => patientMap[p.id] = p.name);

    // Build unified timeline
    let events = [];

    // Add calls
    calls.forEach(c => {
      events.push({
        type: 'call',
        channel: 'call',
        date: new Date(c.date + 'T' + c.startTime),
        icon: c.status === 'missed' ? '📵' : (c.direction === 'outbound' ? '📤' : '📞'),
        title: c.status === 'missed' ? 'Missed Call' : (c.outcome === 'noshow_rebooked' || c.outcome === 'noshow_pending' ? 'No-show Follow-up' : (c.outcome === 'cancellation_rebooked' ? 'Cancellation Follow-up' : (c.direction === 'outbound' ? 'Outbound Follow-up' : (c.outcome === 'emergency_escalated' ? 'Emergency Call' : 'Inbound Call')))),
        client: c.clientId ? (clientMap[c.clientId] || 'Unknown') : 'Unknown caller',
        patient: c.patientId ? (patientMap[c.patientId] || '') : '',
        description: (c.resolution || c.notes || 'No details') + (c.reviewSent ? ' ⭐ Review link sent' : ''),
        status: c.status === 'completed' ? 'completed' : 'missed',
        successful: c.successful,
        sentiment: c.sentiment,
        handler: c.createdBy === 'ai-receptionist' ? 'Clinevo AI' : c.createdBy || 'System',
        raw: c
      });
    });

    // Add comms
    comms.forEach(c => {
      const channelIcon = { sms: '💬', email: '📧', whatsapp: '📱', phone: '☎️' };
      const channelLabel = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', phone: 'Phone Note' };
      events.push({
        type: 'comms',
        channel: c.channel,
        date: c.sentAt ? new Date(c.sentAt) : new Date('2099-01-01'),
        icon: channelIcon[c.channel] || '📩',
        title: `${channelLabel[c.channel] || c.channel} — ${this.commTypeLabel(c.type)}`,
        client: c.clientId ? (clientMap[c.clientId] || 'Unknown') : 'Unknown',
        patient: c.patientId ? (patientMap[c.patientId] || '') : '',
        description: c.message.length > 120 ? c.message.substring(0, 120) + '...' : c.message,
        status: c.status,
        successful: c.status === 'sent',
        sentiment: null,
        handler: 'Clinevo AI',
        raw: c
      });
    });

    // Filter
    if (this.currentFilter !== 'all') {
      events = events.filter(e => e.channel === this.currentFilter);
    }

    // Sort by date descending
    events.sort((a, b) => b.date - a.date);

    const list = document.getElementById('audit-list');
    if (!list) return;

    if (events.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No activity found</p>
        </div>
      `;
      return;
    }

    // Group by date
    const grouped = {};
    events.forEach(e => {
      const dateKey = e.date.getFullYear() > 2050 ? 'Pending' : e.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    });

    list.innerHTML = Object.entries(grouped).map(([dateLabel, items]) => `
      <div class="audit-date-group">
        <div class="audit-date-label">${dateLabel}</div>
        ${items.map(e => `
          <div class="audit-entry ${e.status === 'missed' ? 'audit-missed' : ''} ${e.status === 'pending' ? 'audit-pending' : ''}" ${e.type === 'call' && e.raw.transcript ? 'data-has-transcript="true"' : ''} data-event-idx="${events.indexOf(e)}">
            <div class="audit-icon">${e.icon}</div>
            <div class="audit-body">
              <div class="audit-header-row">
                <span class="audit-title">${e.title}</span>
                <span class="audit-time">${e.date.getFullYear() > 2050 ? 'Scheduled' : e.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="audit-meta">
                ${e.client !== 'Unknown' && e.client !== 'Unknown caller' ? `<span>👤 ${e.client}</span>` : ''}
                ${e.patient ? `<span>🐾 ${e.patient}</span>` : ''}
                <span class="tag ${e.status === 'sent' || e.status === 'completed' ? 'tag-status' : e.status === 'pending' ? 'tag-pending' : 'tag-missed'}">${e.status}</span>
                ${e.sentiment ? `<span class="tag ${this.sentimentClass(e.sentiment)}">${e.sentiment}</span>` : ''}
                ${e.raw.transcript ? `<span class="tag tag-info" style="font-size:10px">📄 Transcript</span>` : ''}
              </div>
              <div class="audit-desc">${e.description}</div>
              ${e.raw.summary ? `<div class="audit-summary">${e.raw.summary}</div>` : ''}
              <div class="audit-handler">${e.handler}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    // Click handlers for entries with transcripts
    list.querySelectorAll('.audit-entry[data-has-transcript]').forEach(entry => {
      entry.style.cursor = 'pointer';
      entry.addEventListener('click', () => {
        const idx = Number(entry.dataset.eventIdx);
        const event = events[idx];
        if (event && event.raw && event.raw.transcript) {
          this.showTranscriptModal(event);
        }
      });
    });
  },

  showTranscriptModal(event) {
    const call = event.raw;
    Modal.open(`
      <h3>${event.icon} ${event.title}</h3>
      <div class="modal-field"><label>Client</label><div class="value">${event.client}</div></div>
      ${event.patient ? `<div class="modal-field"><label>Patient</label><div class="value">🐾 ${event.patient}</div></div>` : ''}
      <div class="modal-field"><label>Date & Time</label><div class="value">${call.date} at ${call.startTime}${call.endTime ? ' – ' + call.endTime : ''}</div></div>
      ${call.summary ? `<div class="modal-field"><label>Summary</label><div class="value">${call.summary}</div></div>` : ''}
      <div class="modal-field"><label>Resolution</label><div class="value">${call.resolution || '—'}</div></div>
      <div class="modal-field">
        <label>Full Transcript</label>
        <div class="value">
          <div class="call-transcript-box">
            ${call.transcript.split('\n').map(line => {
              const isAI = line.startsWith('AI:');
              const isCaller = line.startsWith('Caller:') || line.startsWith('Client:');
              return `<div class="transcript-line ${isAI ? 'transcript-ai' : ''} ${isCaller ? 'transcript-caller' : ''}">${line}</div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  },

  commTypeLabel(type) {
    const labels = {
      appointment_reminder: 'Appointment Reminder',
      vaccination_due: 'Vaccination Due',
      post_visit_followup: 'Follow-up',
      prescription_refill: 'Prescription Refill'
    };
    return labels[type] || type;
  },

  sentimentClass(sentiment) {
    const map = { positive: 'tag-status', neutral: 'tag-info', anxious: 'tag-callback', concerned: 'tag-callback', negative: 'tag-emergency' };
    return map[sentiment] || '';
  }
};

// SSE: refresh on new activity
const _refreshAuditLog = () => {
  if (State.get('currentView') === 'auditLog') AuditLogView.loadAudit();
};
SSE.on('calls:created', _refreshAuditLog);
SSE.on('calls:updated', _refreshAuditLog);
SSE.on('comms:created', _refreshAuditLog);
SSE.on('comms:updated', _refreshAuditLog);
SSE.on('appointments:created', _refreshAuditLog);
SSE.on('appointments:updated', _refreshAuditLog);
