const axios = require('axios');
const path = require('path');
const { URL } = require('url');

app.get('/api/download', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }
  try {
    const response = await axios.get(imageUrl, { responseType: 'stream' });
    const urlObj = new URL(imageUrl);
    let filename = path.basename(urlObj.pathname);
    if (!filename || filename.length > 100) filename = 'imagen.jpg';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo descargar la imagen' });
  }
}); 