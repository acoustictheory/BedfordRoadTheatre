import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('assets/images/icons', { recursive: true });

const iconSource = 'assets/images/bedford-road-theatre-logo.png';
const icon = sharp(iconSource);
await icon.clone().resize(192, 192).png({ compressionLevel: 9 }).toFile('assets/images/icons/icon-192.png');
await icon.clone().resize(512, 512).png({ compressionLevel: 9 }).toFile('assets/images/icons/icon-512.png');
await icon.clone().resize(192, 192).png({ compressionLevel:9 }).toFile('assets/images/icons/maskable-192.png');
await icon.clone().resize(512, 512).png({ compressionLevel:9 }).toFile('assets/images/icons/maskable-512.png');
await icon.clone().resize(180, 180).png({ compressionLevel: 9 }).toFile('assets/images/icons/apple-touch-icon.png');

const densities = {
  mdpi: { launcher: 48, maskable: 82, shortcut: 48, splash: 300 },
  hdpi: { launcher: 72, maskable: 123, shortcut: 72, splash: 450 },
  xhdpi: { launcher: 96, maskable: 164, shortcut: 96, splash: 600 },
  xxhdpi: { launcher: 144, maskable: 246, shortcut: 144, splash: 900 },
  xxxhdpi: { launcher: 192, maskable: 328, shortcut: 192, splash: 1200 }
};

for (const [density, sizes] of Object.entries(densities)) {
  const mipmap = `android-twa/app/src/main/res/mipmap-${density}`;
  const drawable = `android-twa/app/src/main/res/drawable-${density}`;
  await icon.clone().resize(sizes.launcher, sizes.launcher).png({ compressionLevel: 9 }).toFile(`${mipmap}/ic_launcher.png`);
  await icon.clone().resize(sizes.maskable, sizes.maskable).png({ compressionLevel: 9 }).toFile(`${mipmap}/ic_maskable.png`);
  await icon.clone().resize(sizes.splash, sizes.splash).png({ compressionLevel: 9 }).toFile(`${drawable}/splash.png`);
  for (let shortcut = 0; shortcut < 3; shortcut += 1) {
    await icon.clone().resize(sizes.shortcut, sizes.shortcut).png({ compressionLevel: 9 }).toFile(`${drawable}/shortcut_${shortcut}.png`);
  }
}

await sharp('assets/images/descendants-banner.png')
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 84, effort: 6 })
  .toFile('assets/images/descendants-banner.webp');

console.log('Generated Android/PWA icons and optimized production banner.');
