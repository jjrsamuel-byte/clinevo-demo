// Automated communications engine
const store = require('../data/store');

function startCommsEngine() {
  // Generate initial reminders for tomorrow's appointments
  generateReminders();

  // Check for vaccination due dates periodically
  setInterval(() => {
    generateVaccinationReminders();
  }, 30000);

  // Listen for appointment completions
  store.on('change', (event) => {
    if (event.type === 'appointments:updated' && event.data.status === 'completed') {
      setTimeout(() => generateFollowUp(event.data), 2000);
    }
  });
}

function generateReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const appts = store.getAll('appointments', { date: dateStr })
    .filter(a => a.status === 'confirmed');

  for (const appt of appts) {
    const client = store.getById('clients', appt.clientId);
    const patient = store.getById('patients', appt.patientId);
    const staff = store.getById('staff', appt.staffId);
    const type = store.getById('appointment_types', appt.typeId);

    if (!client || !patient) continue;

    // Check if reminder already sent
    const existing = store.getAll('comms', { clientId: appt.clientId })
      .filter(c => c.type === 'appointment_reminder' && c.message.includes(appt.startTime));
    if (existing.length > 0) continue;

    store.create('comms', {
      type: 'appointment_reminder',
      clientId: appt.clientId,
      patientId: appt.patientId,
      channel: 'sms',
      message: `Hi ${client.firstName}, just a reminder that ${patient.name}'s ${type ? type.name.toLowerCase() : 'appointment'} is tomorrow at ${appt.startTime} with ${staff ? staff.name : 'the team'} at Oakwood Veterinary Practice. Reply C to confirm or call 020 7946 0123 to reschedule.`,
      status: 'sent',
      sentAt: new Date().toISOString()
    });
  }
}

function generateVaccinationReminders() {
  const patients = store.getAll('patients');
  const now = new Date();
  const twoWeeksOut = new Date(now);
  twoWeeksOut.setDate(now.getDate() + 14);

  for (const patient of patients) {
    if (!patient.vaccinationDue) continue;
    const dueDate = new Date(patient.vaccinationDue);
    if (dueDate > now && dueDate <= twoWeeksOut) {
      // Check if already reminded
      const existing = store.getAll('comms', { patientId: patient.id })
        .filter(c => c.type === 'vaccination_due');
      if (existing.length > 0) continue;

      const client = store.getById('clients', patient.clientId);
      if (!client) continue;

      const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      store.create('comms', {
        type: 'vaccination_due',
        clientId: patient.clientId,
        patientId: patient.id,
        channel: 'sms',
        message: `Hi ${client.firstName}, ${patient.name}'s annual vaccination is due on ${dueDateStr}. Would you like us to book an appointment? Reply YES or call 020 7946 0123.`,
        status: 'pending',
        sentAt: null
      });
    }
  }
}

function generateFollowUp(appointment) {
  const client = store.getById('clients', appointment.clientId);
  const patient = store.getById('patients', appointment.patientId);
  const staff = store.getById('staff', appointment.staffId);

  if (!client || !patient) return;

  store.create('comms', {
    type: 'post_visit_followup',
    clientId: appointment.clientId,
    patientId: appointment.patientId,
    channel: 'email',
    message: `Dear ${client.firstName}, thank you for bringing ${patient.name} in today. ${staff ? staff.name : 'The vet'} has completed their consultation. If you have any concerns or notice any changes, please don't hesitate to call us on 020 7946 0123. We'll be in touch if any follow-up is needed. Best wishes, Oakwood Veterinary Practice.`,
    sentAt: new Date().toISOString()
  });
}

module.exports = { startCommsEngine };
