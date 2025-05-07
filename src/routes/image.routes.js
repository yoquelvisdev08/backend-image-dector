const express = require('express');
const router = express.Router();
const imageController = require('../controllers/image.controller');

// Ruta para obtener una imagen almacenada
router.get('/:scanId/:fileName', imageController.getImage.bind(imageController));

module.exports = router; 