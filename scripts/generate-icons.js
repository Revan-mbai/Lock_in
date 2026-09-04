import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function generatePng(size, isMaskable = false) {
  // 8-byte PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // Scanlines: (1 + size * 4) bytes per row
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);

  const center = size / 2;
  const outerRadius = size * 0.44;
  const innerRadius = size * 0.42;
  const cornerRadius = size * 0.22;

  // Colors
  // Background: #1C1917 (charcoal black)
  const bgR = 0x1c, bgG = 0x19, bgB = 0x17, bgA = 255;
  // Foreground: #FAF8F5 (warm linen)
  const fgR = 0xfa, fgG = 0xf8, fgB = 0xf5, fgA = 255;
  // Accent: #D97706 (warm amber)
  const accR = 0xd9, accG = 0x77, accB = 0x06, accA = 255;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = bgR, g = bgG, b = bgB, a = bgA;

      if (!isMaskable) {
        // Rounded rectangle bounds for non-maskable icon
        const margin = size * 0.04;
        const rectW = size - 2 * margin;
        const rx = Math.max(0, Math.abs(dx) - (rectW / 2 - cornerRadius));
        const ry = Math.max(0, Math.abs(dy) - (rectW / 2 - cornerRadius));
        const cornerDist = Math.sqrt(rx * rx + ry * ry);
        if (cornerDist > cornerRadius) {
          // Transparent outside rounded corners
          a = 0;
          raw[pxOffset] = 0;
          raw[pxOffset + 1] = 0;
          raw[pxOffset + 2] = 0;
          raw[pxOffset + 3] = 0;
          continue;
        }
      }

      // Draw Icon Motif inside safe zone:
      // A minimalist padlock + timer ring
      const scale = isMaskable ? 0.72 : 0.88;
      const motifDx = dx / scale;
      const motifDy = dy / scale;
      const motifDist = Math.sqrt(motifDx * motifDx + motifDy * motifDy);

      // Outer timer circular tick/ring (subtle warm border)
      const ringR = size * 0.36;
      if (Math.abs(motifDist - ringR) < size * 0.015) {
        r = 0x44; g = 0x40; b = 0x3c; // #44403c ring
      }

      // Top Shackle of Padlock: arch above center
      // Body is between y = 0 and y = size*0.22, shackle is y = -size*0.22 to y = 0
      const shackleW = size * 0.16;
      const shackleH = size * 0.14;
      const shackleThick = size * 0.045;
      const shackleTop = -size * 0.08;

      if (
        motifDy < 0 &&
        motifDy > -shackleH * 2 &&
        Math.abs(motifDx) < shackleW + shackleThick / 2
      ) {
        const archDistX = Math.abs(motifDx) - (shackleW - shackleThick / 2);
        const archDy = motifDy + shackleH;
        const archDist = Math.sqrt(Math.max(0, archDistX) ** 2 + Math.max(0, -archDy) ** 2);
        
        // Semi-circle top
        if (motifDy <= -shackleH) {
          const topRadius = Math.sqrt(motifDx * motifDx + (motifDy + shackleH) * (motifDy + shackleH));
          if (topRadius <= shackleW && topRadius >= shackleW - shackleThick) {
            r = fgR; g = fgG; b = fgB;
          }
        } else if (
          Math.abs(Math.abs(motifDx) - (shackleW - shackleThick / 2)) < shackleThick / 2 &&
          motifDy > -shackleH &&
          motifDy < 0
        ) {
          // Legs of shackle
          r = fgR; g = fgG; b = fgB;
        }
      }

      // Lock Body (rounded box)
      const bodyW = size * 0.38;
      const bodyH = size * 0.32;
      const bodyTop = -size * 0.02;
      const bodyBottom = bodyTop + bodyH;
      const bodyR = size * 0.05;

      if (
        motifDy >= bodyTop &&
        motifDy <= bodyBottom &&
        Math.abs(motifDx) <= bodyW / 2
      ) {
        const bdx = Math.max(0, Math.abs(motifDx) - (bodyW / 2 - bodyR));
        const bdy = Math.max(0, Math.abs(motifDy - (bodyTop + bodyH / 2)) - (bodyH / 2 - bodyR));
        if (Math.sqrt(bdx * bdx + bdy * bdy) <= bodyR) {
          r = fgR; g = fgG; b = fgB;

          // Keyhole cutout (charcoal inside body)
          const keyholeY = bodyTop + bodyH * 0.42;
          const kDist = Math.sqrt(motifDx * motifDx + (motifDy - keyholeY) * (motifDy - keyholeY));
          if (kDist < size * 0.04) {
            r = bgR; g = bgG; b = bgB;
          } else if (
            motifDy >= keyholeY &&
            motifDy <= keyholeY + size * 0.08 &&
            Math.abs(motifDx) <= size * 0.018
          ) {
            r = bgR; g = bgG; b = bgB;
          }
        }
      }

      // Small amber focus dot at top right of lock body
      const dotX = size * 0.16;
      const dotY = bodyTop + size * 0.06;
      const dotDist = Math.sqrt((motifDx - dotX) ** 2 + (motifDy - dotY) ** 2);
      if (dotDist < size * 0.025) {
        r = accR; g = accG; b = accB;
      }

      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(raw, { level: 9 });
  const idat = createChunk('IDAT', deflated);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate sizes
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generatePng(32, false));

console.log('Successfully generated all PWA icons (192, 512, maskable 512, apple-touch-icon 180)');
