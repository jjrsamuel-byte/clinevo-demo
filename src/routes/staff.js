const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { role, available } = req.query;
  let staff = store.getAll('staff');
  if (role) {
    const r = role.toLowerCase();
    staff = staff.filter(s => s.role.toLowerCase().includes(r));
  }
  if (available === 'true') {
    const today = new Date().getDay();
    staff = staff.filter(s => s.available && s.workingDays.includes(today === 0 ? 7 : today));
  }
  res.json(staff);
});

router.get('/:id', (req, res) => {
  const member = store.getById('staff', req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  res.json(member);
});

module.exports = router;
