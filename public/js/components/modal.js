const Modal = {
  open(content) {
    document.getElementById('modal').innerHTML = content;
    document.getElementById('modal-overlay').classList.add('open');
  },

  close() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal').innerHTML = '';
  },

  init() {
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) {
        Modal.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Modal.close();
    });
  },

  // Appointment detail modal
  async showAppointment(appt) {
    const staff = State.getStaffById(appt.staffId);
    const type = State.getTypeById(appt.typeId);
    const patient = await State.getPatient(appt.patientId);
    const client = await State.getClient(appt.clientId);
    const clientName = client ? `${client.title || ''} ${client.firstName} ${client.lastName}`.trim() : 'Unknown';

    Modal.open(`
      <h3>${patient ? patient.name : 'Unknown'} — ${type ? type.name : 'Appointment'}</h3>
      <div class="modal-field">
        <label>Date & Time</label>
        <div class="value">${State.formatDate(appt.date)}, ${appt.startTime} – ${appt.endTime}</div>
      </div>
      <div class="modal-field">
        <label>Veterinarian</label>
        <div class="value">${staff ? staff.name : 'Unassigned'}</div>
      </div>
      <div class="modal-field">
        <label>Owner</label>
        <div class="value">${clientName}${client ? ` — ${client.phone}` : ''}</div>
      </div>
      <div class="modal-field">
        <label>Patient</label>
        <div class="value">${patient ? `${State.getSpeciesIcon(patient.species)} ${patient.name} (${patient.breed}, ${patient.species})` : 'Unknown'}</div>
      </div>
      ${patient && patient.alerts && patient.alerts.length ? `
        <div class="modal-field">
          <label>Alerts</label>
          <div class="value">${patient.alerts.map(a => `<span class="tag tag-alert">${a}</span>`).join(' ')}</div>
        </div>
      ` : ''}
      <div class="modal-field">
        <label>Notes</label>
        <div class="value">${appt.notes || 'No notes'}</div>
      </div>
      <div class="modal-field">
        <label>Status</label>
        <div class="value"><span class="tag tag-status">${appt.status}</span> ${appt.createdBy === 'ai-receptionist' ? '<span class="tag tag-species">Booked by AI</span>' : ''}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      </div>
    `);
  }
};
