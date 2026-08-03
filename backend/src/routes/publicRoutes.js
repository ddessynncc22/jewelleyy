const express = require('express');
const router = express.Router();
const { getHostContext, checkTlsDomain } = require('../controllers/publicController');

// Unauthenticated by design — both are needed before a session exists.
router.get('/host', getHostContext);
router.get('/tls-check', checkTlsDomain);

module.exports = router;
