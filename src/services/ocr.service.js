const axios = require('axios');
const sharp = require('sharp');
const FormData = require('form-data');

const OCR_SPACE_API_KEY = 'K88084778688957';
const OCR_SPACE_API_URL = 'https://api.ocr.space/parse/image';
const MAX_SIZE = 1024 * 1024; // 1MB

class OCRService {
  async recognizeText(imageUrl, language = 'spa') {
    let buffer = null;
    let resizedBuffer = null;
    try {
      // Descargar la imagen en buffer
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
      buffer = Buffer.from(response.data);

      // Comprimir/redimensionar hasta que pese menos de 1MB
      let quality = 80;
      let width = null;
      let height = null;
      let format = 'jpeg';
      let sharpInstance = sharp(buffer);
      const metadata = await sharpInstance.metadata();
      width = metadata.width;
      height = metadata.height;
      if (metadata.format === 'png') format = 'png';

      resizedBuffer = await sharpInstance
        .resize({ width: Math.min(width, 1200) })
        .toFormat(format, { quality })
        .toBuffer();

      // Si sigue pesando más de 1MB, reducir calidad y tamaño progresivamente
      while (resizedBuffer.length > MAX_SIZE && quality > 30) {
        quality -= 10;
        width = Math.round(width * 0.85);
        resizedBuffer = await sharp(buffer)
          .resize({ width })
          .toFormat(format, { quality })
          .toBuffer();
      }

      // Si aún así no baja de 1MB, forzar a 800px de ancho
      if (resizedBuffer.length > MAX_SIZE) {
        resizedBuffer = await sharp(buffer)
          .resize({ width: 800 })
          .toFormat(format, { quality: 60 })
          .toBuffer();
      }

      // Crear form-data para enviar a ocr.space
      const form = new FormData();
      form.append('file', resizedBuffer, {
        filename: 'image.' + format,
        contentType: format === 'png' ? 'image/png' : 'image/jpeg',
      });
      form.append('language', language);
      form.append('apikey', OCR_SPACE_API_KEY);
      form.append('isOverlayRequired', 'false');

      // Enviar a ocr.space
      const ocrResponse = await axios.post(OCR_SPACE_API_URL, form, {
        headers: form.getHeaders(),
        maxContentLength: MAX_SIZE,
        timeout: 30000
      });

      const data = ocrResponse.data;
      if (data.IsErroredOnProcessing) {
        throw new Error(data.ErrorMessage || 'Error en OCR.space');
      }
      const parsed = data.ParsedResults && data.ParsedResults[0];
      return {
        text: parsed ? parsed.ParsedText : '',
        confidence: parsed ? parsed.ParsedText ? 100 : 0 : 0,
        words: [],
        raw: parsed
      };
    } catch (error) {
      console.error('Error usando OCR.space:', error.message);
      throw error;
    } finally {
      // Limpiar buffers de memoria
      buffer = null;
      resizedBuffer = null;
      global.gc && global.gc(); // Si Node está en modo --expose-gc
    }
  }
}

module.exports = new OCRService(); 