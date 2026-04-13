const router = require('express').Router();

router.post('/token', (req, res) => {
  res.json({
    access_token: 'mock-token-clinevo-demo',
    token_type: 'Bearer',
    expires_in: 3600
  });
});

module.exports = router;
