// Calendar grid rendering
const CalendarGrid = {
  timeSlots: [],

  init() {
    // Generate time slots from 08:00 to 18:00
    for (let h = 8; h < 18; h++) {
      for (let m = 0; m < 60; m += 15) {
        this.timeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  },

  timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  },

  render(appointments, vets, container) {
    const slotHeight = 20; // px per 15-min slot
    const headerHeight = 44;

    // Grid columns: time label + one per vet
    const cols = `80px ${vets.map(() => '1fr').join(' ')}`;

    let html = `
      <div class="cal-header-row" style="display:grid; grid-template-columns:${cols}">
        <div class="cal-header-cell">Time</div>
        ${vets.map(v => `<div class="cal-header-cell" style="border-left: 3px solid ${v.colour}">${v.name.replace('Dr ', '').replace('Nurse ', '')}</div>`).join('')}
      </div>
      <div class="cal-body" style="position:relative">
    `;

    // Time rows
    for (let i = 0; i < this.timeSlots.length; i++) {
      const time = this.timeSlots[i];
      const isHour = time.endsWith(':00');
      html += `
        <div class="cal-time-row" style="display:grid; grid-template-columns:${cols}; height:${slotHeight}px; ${isHour ? 'border-top: 1px solid var(--border-medium);' : ''}">
          <div class="cal-time-label">${isHour ? time : ''}</div>
          ${vets.map(() => `<div class="cal-cell"></div>`).join('')}
        </div>
      `;
    }

    // Overlay appointments
    html += '<div style="position:absolute; top:0; left:80px; right:0; bottom:0; display:grid; grid-template-columns:' + vets.map(() => '1fr').join(' ') + '">';

    for (let vi = 0; vi < vets.length; vi++) {
      html += `<div style="position:relative">`;
      const vetAppts = appointments.filter(a => a.staffId === vets[vi].id);

      for (const appt of vetAppts) {
        const startMin = this.timeToMinutes(appt.startTime) - this.timeToMinutes('08:00');
        const endMin = this.timeToMinutes(appt.endTime) - this.timeToMinutes('08:00');
        const top = (startMin / 15) * slotHeight;
        const height = ((endMin - startMin) / 15) * slotHeight;

        const type = State.getTypeById(appt.typeId);
        const colour = type ? type.colour : '#888';
        const isNew = appt.createdBy === 'ai-receptionist' && appt._isNew;

        // Get patient name from cache or show loading
        const patient = State._data._patientCache[appt.patientId];
        const patientName = patient ? patient.name : '...';
        const typeName = type ? type.name : '';

        html += `
          <div class="cal-appointment ${isNew ? 'new-booking' : ''}"
               style="top:${top}px; height:${Math.max(height - 2, slotHeight - 2)}px; background:${colour}"
               data-appt-id="${appt.id}" title="${patientName} — ${typeName} (${appt.startTime}–${appt.endTime})">
            <div class="appt-patient">${patientName}</div>
            ${height > slotHeight * 1.5 ? `<div class="appt-type">${typeName}</div>` : ''}
            ${height > slotHeight * 2.5 ? `<div class="appt-time">${appt.startTime}</div>` : ''}
          </div>
        `;
      }
      html += '</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;

    // Click handlers
    container.querySelectorAll('.cal-appointment').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.apptId;
        const appt = appointments.find(a => a.id === Number(id));
        if (appt) Modal.showAppointment(appt);
      });
    });
  }
};

CalendarGrid.init();
