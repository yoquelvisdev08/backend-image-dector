const express = require('express');
const router = express.Router();
const ocrService = require('../services/ocr.service');

// Cambiar la ruta de /api/ocr a /ocr ya que el prefijo /api se agrega en app.js
router.post('/ocr', async (req, res) => {
  try {
    const { imageUrl, language } = req.body;
    const result = await ocrService.recognizeText(imageUrl, language);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar la imagen'
    });
  }
});

module.exports = router; 