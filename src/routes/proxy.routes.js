const express = require('express');
const ProxyController = require('../controllers/proxy.controller');

const router = express.Router();

router.get('/proxy', ProxyController.handleProxy);

module.exports = router;
