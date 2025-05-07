const fs = require('fs').promises;
const path = require('path');
const https = require('https');

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(outputPath);
        reject(err);
      });
    }).on('error', reject);
  });
}

async function downloadModel() {
  try {
    console.log('Iniciando descarga del modelo...');
    
    // Crear directorio si no existe
    const modelDir = path.join(__dirname, '../models/mobilenet');
    await fs.mkdir(modelDir, { recursive: true });
    
    // URLs de los archivos del modelo
    const files = {
      'model.json': 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json',
      'group1-shard1of1.bin': 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/group1-shard1of1.bin',
      'labels.json': 'https://storage.googleapis.com/tfjs-models/assets/mobilenet/imagenet_classes.json'
    };

    // Descargar cada archivo
    for (const [filename, url] of Object.entries(files)) {
      const outputPath = path.join(modelDir, filename);
      console.log(`Descargando ${filename}...`);
      await downloadFile(url, outputPath);
      console.log(`${filename} descargado exitosamente`);
    }

    console.log('Modelo y etiquetas descargados exitosamente en:', modelDir);
    
  } catch (error) {
    console.error('Error al descargar el modelo:', error.message);
    process.exit(1);
  }
}

downloadModel(); 