const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(__dirname, 'cha-cha-front', 'assets', 'icons');

const greenColor = { r: 7, g: 193, b: 96 };

async function createIcon(iconType, outputPath) {
  const size = 81;
  let svg;
  
  if (iconType === 'home') {
    svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <path d="M40.5 15 L65 35 L65 66 L16 66 L16 35 Z" fill="rgb(${greenColor.r},${greenColor.g},${greenColor.b})"/>
    </svg>`;
  } else if (iconType === 'query') {
    svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40.5" cy="35.5" r="20" fill="none" stroke="rgb(${greenColor.r},${greenColor.g},${greenColor.b})" stroke-width="3"/>
      <line x1="54.5" y1="45.5" x2="65.5" y2="56.5" stroke="rgb(${greenColor.r},${greenColor.g},${greenColor.b})" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  } else if (iconType === 'user') {
    svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40.5" cy="28" r="15" fill="rgb(${greenColor.r},${greenColor.g},${greenColor.b})"/>
      <path d="M10.5 75 A30 30 0 0 1 70.5 75" fill="rgb(${greenColor.r},${greenColor.g},${greenColor.b})"/>
    </svg>`;
  }
  
  try {
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    console.log(`Created: ${outputPath}`);
  } catch (err) {
    console.error(`Error creating ${outputPath}:`, err);
  }
}

async function main() {
  console.log('Creating icons...');
  await createIcon('home', path.join(iconsDir, 'home-active.png'));
  await createIcon('query', path.join(iconsDir, 'query-active.png'));
  await createIcon('user', path.join(iconsDir, 'user-active.png'));
  console.log('All icons created successfully!');
}

main().catch(console.error);
