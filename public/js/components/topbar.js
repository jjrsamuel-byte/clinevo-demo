function renderTopbar() {
  const el = document.getElementById('topbar');
  const date = State.get('currentDate');
  const aiOpen = State.get('aiDrawerOpen');

  el.innerHTML = `
    <div class="topbar-left">
      <h3>Oakwood Veterinary Practice</h3>
      <span class="topbar-date">${State.formatDate(date)}</span>
    </div>
    <div class="topbar-center">
      <div class="global-search-wrap">
        <span class="global-search-icon">🔍</span>
        <input type="text" id="global-search" class="global-search-input" placeholder="Search clients or patients..." autocomplete="off">
        <div class="global-search-results" id="global-search-results"></div>
      </div>
    </div>
    <div class="topbar-right">
      <button class="btn btn-reset" id="btn-reset-demo">Reset Demo</button>
      <button class="btn btn-ai" id="btn-toggle-ai">
        <svg width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
          <path d="M17.63,14.77 A9,9 0 1 1 17.63,5.23" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2.2"/>
          <path d="M14.75,12.97 A5.6,5.6 0 1 1 14.75,7.03" fill="none" stroke="#45C4BC" stroke-width="1.5"/>
          <path d="M12.37,11.48 A2.8,2.8 0 1 1 12.37,8.52" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>
        </svg>
        Clinevo AI
      </button>
    </div>
  `;

  document.getElementById('btn-toggle-ai').addEventListener('click', () => {
    State.set('aiDrawerOpen', !State.get('aiDrawerOpen'));
  });

  document.getElementById('btn-reset-demo').addEventListener('click', async () => {
    if (confirm('Reset all demo data to defaults?')) {
      await API.reset();
      State.set('aiMessages', []);
      State.set('aiActions', []);
      State.set('aiRunning', false);
      State.set('currentView', State.get('currentView'));
    }
  });

  // Global search
  const searchInput = document.getElementById('global-search');
  const searchResults = document.getElementById('global-search-results');
  let searchTimeout;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      searchResults.classList.remove('open');
      searchResults.innerHTML = '';
      return;
    }
    searchTimeout = setTimeout(async () => {
      const data = await API.search.global(q);
      renderSearchResults(data, searchResults);
    }, 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      searchResults.classList.add('open');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.global-search-wrap')) {
      searchResults.classList.remove('open');
    }
  });
}

function renderSearchResults(data, container) {
  const { clients, patients } = data;
  if (clients.length === 0 && patients.length === 0) {
    container.innerHTML = '<div class="search-no-results">No results found</div>';
    container.classList.add('open');
    return;
  }

  let html = '';

  if (clients.length > 0) {
    html += '<div class="search-section-label">Clients</div>';
    html += clients.map(c => `
      <div class="search-result-item" data-type="client" data-id="${c.id}">
        <span class="search-result-icon">👤</span>
        <div class="search-result-body">
          <div class="search-result-name">${c.title || ''} ${c.firstName} ${c.lastName}</div>
          <div class="search-result-meta">${c.phone} ${c.petNames ? '· 🐾 ' + c.petNames : ''}</div>
        </div>
      </div>
    `).join('');
  }

  if (patients.length > 0) {
    html += '<div class="search-section-label">Patients</div>';
    html += patients.map(p => `
      <div class="search-result-item" data-type="patient" data-id="${p.id}">
        <span class="search-result-icon">${State.getSpeciesIcon(p.species)}</span>
        <div class="search-result-body">
          <div class="search-result-name">${p.name}</div>
          <div class="search-result-meta">${p.breed} · Owner: ${p.ownerName}</div>
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = html;
  container.classList.add('open');

  // Click handlers
  container.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      const id = Number(item.dataset.id);
      container.classList.remove('open');
      document.getElementById('global-search').value = '';

      if (type === 'client') {
        showClientProfile(id);
      } else {
        PatientsView.showPatient(id);
      }
    });
  });
}

// Full client profile page with all AI interactions
async function showClientProfile(clientId) {
  const data = await API.get('/search/profile/' + clientId);
  if (!data || !data.client) return;

  const { client, patients, calls, comms, appointments } = data;
  const clientName = `${client.title || ''} ${client.firstName} ${client.lastName}`.trim();

  // Build timeline of all interactions
  let timeline = [];

  calls.forEach(c => {
    const patient = patients.find(p => p.id === c.patientId);
    timeline.push({
      date: new Date(c.date + 'T' + c.startTime),
      type: 'call',
      icon: c.direction === 'outbound' ? '📤' : (c.status === 'missed' ? '📵' : '📞'),
      label: c.direction === 'outbound' ? 'Outbound Call' : (c.status === 'missed' ? 'Missed Call' : 'Inbound Call'),
      patient: patient ? patient.name : '',
      detail: c.resolution || c.notes || 'No details',
      summary: c.summary || '',
      sentiment: c.sentiment,
      successful: c.successful,
      status: c.status,
      reviewSent: c.reviewSent,
      revenueRecovered: c.revenueRecovered,
      transcript: c.transcript || null
    });
  });

  comms.forEach(c => {
    const patient = patients.find(p => p.id === c.patientId);
    const channelIcon = { sms: '💬', email: '📧', whatsapp: '📱', phone: '☎️' };
    const channelLabel = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', phone: 'Phone Note' };
    timeline.push({
      date: c.sentAt ? new Date(c.sentAt) : new Date('2099-01-01'),
      type: 'comms',
      icon: channelIcon[c.channel] || '📩',
      label: `${channelLabel[c.channel] || c.channel}`,
      patient: patient ? patient.name : '',
      detail: c.message,
      summary: '',
      sentiment: null,
      successful: c.status === 'sent',
      status: c.status,
      reviewSent: false,
      revenueRecovered: 0,
      transcript: null
    });
  });

  appointments.forEach(a => {
    const patient = patients.find(p => p.id === a.patientId);
    const type = State.getTypeById(a.typeId);
    const staff = State.getStaffById(a.staffId);
    timeline.push({
      date: new Date(a.date + 'T' + a.startTime),
      type: 'appointment',
      icon: '📅',
      label: type ? type.name : 'Appointment',
      patient: patient ? patient.name : '',
      detail: `${a.startTime}–${a.endTime} with ${staff ? staff.name : 'TBC'} — ${a.notes || 'No notes'}`,
      summary: '',
      sentiment: null,
      successful: true,
      status: a.status,
      reviewSent: false,
      revenueRecovered: 0,
      transcript: null,
      isAiBooked: a.createdBy === 'ai-receptionist'
    });
  });

  timeline.sort((a, b) => b.date - a.date);

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="view-header" style="margin-bottom:0">
      <div class="flex items-center gap-16">
        <button class="btn btn-sm btn-ghost" id="profile-back">◀ Back</button>
        <h2>👤 ${clientName}</h2>
      </div>
    </div>

    <div class="profile-grid">
      <div class="profile-sidebar">
        <div class="card">
          <h3 class="dash-section-title">Client Details</h3>
          <div class="profile-detail"><span class="profile-label">Phone</span><span>${client.phone}</span></div>
          <div class="profile-detail"><span class="profile-label">Email</span><span>${client.email}</span></div>
          <div class="profile-detail"><span class="profile-label">Address</span><span>${client.address}, ${client.postcode}</span></div>
          ${client.notes ? `<div class="profile-detail"><span class="profile-label">Notes</span><span>${client.notes}</span></div>` : ''}
        </div>

        <div class="card">
          <h3 class="dash-section-title">Patients (${patients.length})</h3>
          ${patients.map(p => `
            <div class="profile-patient-card">
              <div class="profile-patient-icon">${State.getSpeciesIcon(p.species)}</div>
              <div>
                <div class="profile-patient-name">${p.name}</div>
                <div class="text-small text-muted">${p.breed} · ${p.sex}</div>
                ${p.alerts && p.alerts.length ? `<div class="mt-4">${p.alerts.map(a => `<span class="tag tag-alert" style="font-size:9px">${a}</span>`).join(' ')}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <h3 class="dash-section-title">Summary</h3>
          <div class="profile-detail"><span class="profile-label">Total Calls</span><span>${calls.length}</span></div>
          <div class="profile-detail"><span class="profile-label">Total Comms</span><span>${comms.length}</span></div>
          <div class="profile-detail"><span class="profile-label">Appointments</span><span>${appointments.length}</span></div>
          ${calls.some(c => c.reviewSent) ? `<div class="profile-detail"><span class="profile-label">Review Sent</span><span>⭐ Yes</span></div>` : ''}
          ${calls.some(c => c.revenueRecovered) ? `<div class="profile-detail"><span class="profile-label">Revenue Recovered</span><span>£${calls.reduce((s, c) => s + (c.revenueRecovered || 0), 0)}</span></div>` : ''}
        </div>
      </div>

      <div class="profile-timeline">
        <div class="card">
          <h3 class="dash-section-title">Complete AI Interaction History</h3>
          <div class="timeline-list">
            ${timeline.length === 0 ? '<div class="text-muted text-center" style="padding:20px">No interactions recorded</div>' : ''}
            ${timeline.map(e => `
              <div class="timeline-item ${e.status === 'missed' ? 'timeline-missed' : ''}">
                <div class="timeline-dot" style="background:${e.type === 'call' ? 'var(--clinevo-purple)' : e.type === 'comms' ? 'var(--signal-teal)' : 'var(--forest-teal)'}"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-icon">${e.icon}</span>
                    <span class="timeline-label">${e.label}</span>
                    ${e.patient ? `<span class="tag tag-species" style="font-size:10px">🐾 ${e.patient}</span>` : ''}
                    ${e.isAiBooked ? `<span class="tag tag-species" style="font-size:10px">🤖 AI Booked</span>` : ''}
                    ${e.reviewSent ? `<span class="tag tag-review" style="font-size:10px">⭐ Review</span>` : ''}
                    ${e.revenueRecovered ? `<span class="tag tag-revenue" style="font-size:10px">+£${e.revenueRecovered}</span>` : ''}
                    <span class="timeline-date">${e.date.getFullYear() > 2050 ? 'Pending' : e.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + e.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div class="timeline-detail">${e.detail}</div>
                  ${e.summary ? `<div class="timeline-summary">${e.summary}</div>` : ''}
                  ${e.sentiment ? `<div class="timeline-meta"><span class="tag ${e.sentiment === 'positive' ? 'tag-status' : e.sentiment === 'anxious' || e.sentiment === 'concerned' ? 'tag-callback' : 'tag-info'}">${e.sentiment}</span> ${e.successful ? '<span class="tag tag-status">Resolved</span>' : ''}</div>` : ''}
                  ${e.transcript ? `
                    <div class="timeline-transcript">
                      <button class="btn btn-sm btn-ghost transcript-toggle" onclick="this.nextElementSibling.classList.toggle('hidden');this.textContent=this.textContent.includes('Show')?'Hide Transcript':'Show Transcript'">Show Transcript</button>
                      <div class="transcript-content hidden">${e.transcript}</div>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('profile-back').addEventListener('click', () => {
    // Re-render current view
    const view = State.get('currentView');
    State.set('currentView', view);
  });
}

State.on('aiDrawerOpen', (open) => {
  document.getElementById('app').classList.toggle('ai-open', open);
});

State.on('currentDate', () => renderTopbar());
