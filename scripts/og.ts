import sharp from 'sharp';

const info = await sharp('public/og.svg', { density: 150 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');

console.log(`public/og.png · ${info.width}x${info.height} · ${(info.size / 1024).toFixed(1)} KB`);
