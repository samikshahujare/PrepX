import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function createPNG(width, height, pixelShader) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width (4), height (4), depth (1), colorType (1 = 6 RGBA), comp (1), filter (1), interlace (1)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = createChunk("IHDR", ihdr);

  // Raw uncompressed scanlines: each row starts with filter type 0x00
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelShader(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk("IDAT", compressedData);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Shader for PrepX Icon: Dark modern slate + indigo/teal glowing core with PX monogram
function prepXShader(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = w / 2;

  // Background gradient: from deep navy #0a0d14 at top to indigo-slate #181f33 at bottom
  const ny = y / h;
  let bgR = 10 + ny * 14;
  let bgG = 13 + ny * 18;
  let bgB = 20 + ny * 35;

  // If not maskable, give it a soft rounded squircle boundary with a subtle ring
  if (!isMaskable) {
    const cornerRadius = w * 0.22;
    // Box SDF
    const qx = Math.abs(x - cx) - (w / 2 - cornerRadius);
    const qy = Math.abs(y - cy) - (h / 2 - cornerRadius);
    const cornerDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerRadius;

    if (cornerDist > 0) {
      // Outside squircle
      return [0, 0, 0, 0];
    }
    if (cornerDist > -2) {
      // Subtle glowing border
      return [99, 102, 241, 220]; // Indigo-500
    }
  }

  // Radial glow in center (indigo/cyan)
  const glow = Math.max(0, 1 - dist / (w * 0.45));
  let r = Math.min(255, bgR + glow * 55);
  let g = Math.min(255, bgG + glow * 50);
  let b = Math.min(255, bgB + glow * 160);

  // Draw stylized PrepX "P" and "X" monogram in center
  // Scale relative to w, h
  const sx = (x - cx) / (w * 0.32);
  const sy = (y - cy) / (h * 0.32);

  // 'P' on left (sx between -0.85 and -0.05, sy between -0.7 and 0.7)
  let isP = false;
  // P stem: vertical bar
  if (sx >= -0.8 && sx <= -0.55 && sy >= -0.7 && sy <= 0.7) {
    isP = true;
  }
  // P loop: top bar, bottom bar, and right curve
  if (sy >= -0.7 && sy <= -0.45 && sx >= -0.8 && sx <= 0.0) isP = true;
  if (sy >= -0.15 && sy <= 0.1 && sx >= -0.8 && sx <= 0.0) isP = true;
  if (sx >= -0.25 && sx <= 0.0 && sy >= -0.7 && sy <= 0.1) isP = true;

  // 'X' on right (sx between 0.15 and 0.85, sy between -0.7 and 0.7)
  let isX = false;
  const x_cx = 0.52;
  const x_dx = sx - x_cx;
  // Diagonal 1: y = x (slope 1)
  if (Math.abs(sy - x_dx * 1.8) < 0.22 && sx >= 0.18 && sx <= 0.85) isX = true;
  // Diagonal 2: y = -x (slope -1)
  if (Math.abs(sy + x_dx * 1.8) < 0.22 && sx >= 0.18 && sx <= 0.85) isX = true;

  if (isP) {
    // Gradient indigo to cyan
    const t = (sy + 0.7) / 1.4;
    return [
      Math.round(99 + t * 40),
      Math.round(102 + t * 90),
      Math.round(241 - t * 20),
      255
    ];
  }

  if (isX) {
    // Cyan to emerald gradient
    const t = (sy + 0.7) / 1.4;
    return [
      Math.round(6 + t * 40),
      Math.round(182 + t * 40),
      Math.round(212 - t * 40),
      255
    ];
  }

  return [Math.round(r), Math.round(g), Math.round(b), 255];
}

const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate 192x192
const png192 = createPNG(192, 192, (x, y, w, h) => prepXShader(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, "icon-192x192.png"), png192);
console.log("Created icon-192x192.png (size: " + png192.length + " bytes)");

// Generate 512x512
const png512 = createPNG(512, 512, (x, y, w, h) => prepXShader(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, "icon-512x512.png"), png512);
console.log("Created icon-512x512.png (size: " + png512.length + " bytes)");

// Generate 512x512 Maskable
const png512Maskable = createPNG(512, 512, (x, y, w, h) => prepXShader(x, y, w, h, true));
fs.writeFileSync(path.join(iconsDir, "icon-512x512-maskable.png"), png512Maskable);
console.log("Created icon-512x512-maskable.png (size: " + png512Maskable.length + " bytes)");

// Generate apple-touch-icon 180x180
const appleIcon = createPNG(180, 180, (x, y, w, h) => prepXShader(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.png"), appleIcon);
console.log("Created apple-touch-icon.png (size: " + appleIcon.length + " bytes)");

// Also write an SVG version of the icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0d14"/>
      <stop offset="100%" stop-color="#181f33"/>
    </linearGradient>
    <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="xGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="#6366f1" stroke-width="4" stroke-opacity="0.4"/>
  <circle cx="256" cy="256" r="180" fill="#6366f1" fill-opacity="0.12" filter="url(#glow)"/>
  <!-- P Monogram -->
  <path d="M 136 128 L 196 128 C 240 128 268 152 268 196 C 268 240 240 264 196 264 L 176 264 L 176 384 L 136 384 Z M 176 168 L 176 224 L 194 224 C 218 224 228 214 228 196 C 228 178 218 168 194 168 Z" fill="url(#pGrad)"/>
  <!-- X Monogram -->
  <path d="M 296 128 L 336 128 L 388 236 L 440 128 L 480 128 L 412 256 L 480 384 L 440 384 L 388 276 L 336 384 L 296 384 L 364 256 Z" fill="url(#xGrad)"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, "icon.svg"), svgContent);
console.log("Created icon.svg");
