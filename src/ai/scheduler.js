// Smart scheduling algorithm
function scoreSlot(slot, appointment, store) {
  let score = 50;
  const vet = store.getById('staff', slot.staffId);
  const type = store.getById('appointment_types', appointment.typeId);

  if (!vet || !type) return score;

  // 1. Vet-case match (40% weight)
  if (vet.specialisms && vet.specialisms.length > 0) {
    const typeLower = type.name.toLowerCase();
    const match = vet.specialisms.some(s =>
      typeLower.includes(s.toLowerCase().split(' ')[0])
    );
    if (match) score += 40;
  }

  // 2. Gap filling (30% weight)
  const dayAppts = store.getAll('appointments', { date: slot.date, staffId: String(slot.staffId) })
    .filter(a => a.status !== 'cancelled');

  const slotStart = timeToMinutes(slot.startTime);
  const slotEnd = slotStart + type.duration;

  const hasAdjBefore = dayAppts.some(a => timeToMinutes(a.endTime) === slotStart);
  const hasAdjAfter = dayAppts.some(a => timeToMinutes(a.startTime) === slotEnd);

  if (hasAdjBefore && hasAdjAfter) score += 30;
  else if (hasAdjBefore || hasAdjAfter) score += 15;

  // 3. Workload balance (20% weight)
  score += Math.max(0, 20 - dayAppts.length * 3);

  // 4. Continuity (10% weight)
  if (appointment.patientId) {
    const pastAppts = store.getAll('appointments').filter(a =>
      a.patientId === appointment.patientId && a.staffId === slot.staffId
    );
    if (pastAppts.length > 0) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

module.exports = { scoreSlot };
