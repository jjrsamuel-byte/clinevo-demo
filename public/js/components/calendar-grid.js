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

  // ── Day view ──
  render(appointments, vets, container) {
    const slotHeight = 20; // px per 15-min slot

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
        html += this.renderAppointmentBlock(appt, slotHeight);
      }
      html += '</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;

    // Click handlers
    this.attachClickHandlers(container, appointments);
  },

  // ── Week view ──
  renderWeek(appointments, vets, weekDates, container) {
    const slotHeight = 16; // px per 15-min slot (smaller for week)
    const today = new Date().toISOString().split('T')[0];

    // Grid columns: time label + one per day
    const cols = `60px ${weekDates.map(() => '1fr').join(' ')}`;

    let html = `
      <div class="cal-header-row cal-week-header" style="display:grid; grid-template-columns:${cols}">
        <div class="cal-header-cell">Time</div>
        ${weekDates.map(d => {
          const dt = new Date(d + 'T00:00:00');
          const dayName = dt.toLocaleDateString('en-GB', { weekday: 'short' });
          const dayNum = dt.getDate();
          const isToday = d === today;
          return `<div class="cal-header-cell cal-week-day-header ${isToday ? 'cal-today-header' : ''}">
            <span class="cal-day-name">${dayName}</span>
            <span class="cal-day-num ${isToday ? 'cal-today-num' : ''}">${dayNum}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="cal-body" style="position:relative">
    `;

    // Time rows
    for (let i = 0; i < this.timeSlots.length; i++) {
      const time = this.timeSlots[i];
      const isHour = time.endsWith(':00');
      html += `
        <div class="cal-time-row" style="display:grid; grid-template-columns:${cols}; height:${slotHeight}px; ${isHour ? 'border-top: 1px solid var(--border-medium);' : ''}">
          <div class="cal-time-label" style="font-size:10px">${isHour ? time : ''}</div>
          ${weekDates.map(d => `<div class="cal-cell ${d === today ? 'cal-today-col' : ''}"></div>`).join('')}
        </div>
      `;
    }

    // Overlay appointments per day column
    html += '<div style="position:absolute; top:0; left:60px; right:0; bottom:0; display:grid; grid-template-columns:' + weekDates.map(() => '1fr').join(' ') + '">';

    for (let di = 0; di < weekDates.length; di++) {
      html += `<div style="position:relative">`;
      const dayAppts = appointments.filter(a => a.date === weekDates[di]);

      // Group overlapping appointments by staff
      for (const appt of dayAppts) {
        const vet = vets.find(v => v.id === appt.staffId);
        const vetColour = vet ? vet.colour : '#888';
        html += this.renderWeekAppointmentBlock(appt, slotHeight, vetColour, vet);
      }
      html += '</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;

    // Click handlers
    this.attachClickHandlers(container, appointments);
  },

  renderAppointmentBlock(appt, slotHeight) {
    const startMin = this.timeToMinutes(appt.startTime) - this.timeToMinutes('08:00');
    const endMin = this.timeToMinutes(appt.endTime) - this.timeToMinutes('08:00');
    const top = (startMin / 15) * slotHeight;
    const height = ((endMin - startMin) / 15) * slotHeight;

    const type = State.getTypeById(appt.typeId);
    const colour = type ? type.colour : '#888';
    const isNew = appt.createdBy === 'ai-receptionist' && appt._isNew;

    const patient = State._data._patientCache[appt.patientId];
    const patientName = patient ? patient.name : '...';
    const typeName = type ? type.name : '';

    return `
      <div class="cal-appointment ${isNew ? 'new-booking' : ''}"
           style="top:${top}px; height:${Math.max(height - 2, slotHeight - 2)}px; background:${colour}"
           data-appt-id="${appt.id}" title="${patientName} — ${typeName} (${appt.startTime}–${appt.endTime})">
        <div class="appt-patient">${patientName}</div>
        ${height > slotHeight * 1.5 ? `<div class="appt-type">${typeName}</div>` : ''}
        ${height > slotHeight * 2.5 ? `<div class="appt-time">${appt.startTime}</div>` : ''}
      </div>
    `;
  },

  renderWeekAppointmentBlock(appt, slotHeight, vetColour, vet) {
    const startMin = this.timeToMinutes(appt.startTime) - this.timeToMinutes('08:00');
    const endMin = this.timeToMinutes(appt.endTime) - this.timeToMinutes('08:00');
    const top = (startMin / 15) * slotHeight;
    const height = ((endMin - startMin) / 15) * slotHeight;

    const type = State.getTypeById(appt.typeId);
    const colour = type ? type.colour : '#888';
    const isNew = appt.createdBy === 'ai-receptionist';

    const patient = State._data._patientCache[appt.patientId];
    const patientName = patient ? patient.name : '...';
    const vetName = vet ? vet.name.replace('Dr ', '').replace('Nurse ', '') : '';

    // In week view, stack appointments side by side if they overlap
    // Simple approach: use staff index to offset horizontally
    const allStaff = State.get('staff').filter(s =>
      s.role.includes('Veterinary Surgeon') || s.role.includes('Nurse')
    ).filter(s => s.role !== 'Head Receptionist');
    const staffIdx = allStaff.findIndex(s => s.id === appt.staffId);
    const staffCount = allStaff.length;
    const colWidth = 100 / staffCount;
    const left = staffIdx * colWidth;

    return `
      <div class="cal-appointment cal-week-appt ${isNew ? 'new-booking' : ''}"
           style="top:${top}px; height:${Math.max(height - 2, slotHeight - 2)}px; background:${colour}; left:${left}%; width:${colWidth}%; right:auto;"
           data-appt-id="${appt.id}" title="${patientName} — ${vetName} (${appt.startTime}–${appt.endTime})">
        <div class="appt-patient" style="font-size:9px">${patientName}</div>
        ${height > slotHeight * 1.8 ? `<div class="appt-type" style="font-size:8px">${vetName}</div>` : ''}
      </div>
    `;
  },

  attachClickHandlers(container, appointments) {
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
