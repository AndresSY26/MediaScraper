const express = require('express');
const ScrapeController = require('../controllers/scrape.controller');

const router = express.Router();

router.post('/scrape', ScrapeController.handleScrape);

module.exports = router;
