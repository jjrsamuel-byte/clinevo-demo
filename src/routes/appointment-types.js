const router = require('express').Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  res.json(store.getAll('appointment_types'));
});

module.exports = router;
