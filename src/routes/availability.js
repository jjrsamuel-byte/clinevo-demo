const router = require('express').Router();
const store = require('../data/store');

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

router.get('/', (req, res) => {
  const { date, typeId, staffId } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date(targetDate + 'T00:00:00').getDay();
  const dow = dayOfWeek === 0 ? 7 : dayOfWeek;

  const type = typeId ? store.getById('appointment_types', typeId) : null;
  const duration = type ? type.duration : 20;

  const allStaff = store.getAll('staff');
  const vets = allStaff.filter(s => {
    if (staffId && s.id !== Number(staffId)) return false;
    if (type && type.requiresVet && !s.role.includes('Veterinary Surgeon')) return false;
    if (type && !type.requiresVet && !s.role.includes('Nurse') && !s.role.includes('Veterinary Surgeon')) return false;
    return s.available && s.workingDays.includes(dow);
  });

  const dayAppointments = store.getAll('appointments', { date: targetDate });
  const slots = [];

  for (const vet of vets) {
    const vetAppts = dayAppointments
      .filter(a => a.staffId === vet.id && a.status !== 'cancelled')
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const start = timeToMinutes(vet.startTime);
    const end = timeToMinutes(vet.endTime);

    for (let t = start; t + duration <= end; t += 15) {
      const slotStart = minutesToTime(t);
      const slotEnd = minutesToTime(t + duration);

      const conflict = vetAppts.some(a => {
        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        return t < aEnd && t + duration > aStart;
      });

      if (!conflict) {
        // Compute scheduling score
        let score = 50;

        // Gap filling: prefer slots adjacent to existing appointments
        const hasAdjBefore = vetAppts.some(a => timeToMinutes(a.endTime) === t);
        const hasAdjAfter = vetAppts.some(a => timeToMinutes(a.startTime) === t + duration);
        if (hasAdjBefore && hasAdjAfter) score += 30;
        else if (hasAdjBefore || hasAdjAfter) score += 15;

        // Workload balance: fewer appointments = higher score
        const apptCount = vetAppts.length;
        score += Math.max(0, 20 - apptCount * 3);

        // Vet-case match: specialism bonus
        if (type && vet.specialisms) {
          const typeNameLower = type.name.toLowerCase();
          const match = vet.specialisms.some(s => typeNameLower.includes(s.toLowerCase().split(' ')[0]));
          if (match) score += 20;
        }

        score = Math.min(100, Math.max(0, score));

        slots.push({
          staffId: vet.id,
          staffName: vet.name,
          date: targetDate,
          startTime: slotStart,
          endTime: slotEnd,
          score
        });
      }
    }
  }

  slots.sort((a, b) => b.score - a.score);
  res.json(slots);
});

module.exports = router;
