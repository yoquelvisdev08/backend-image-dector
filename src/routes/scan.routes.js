const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');
const { validateUrl } = require('../middleware/validator');

// Ruta para escanear un sitio web
router.post('/', validateUrl, scanController.scanWebsite.bind(scanController));

module.exports = router; 