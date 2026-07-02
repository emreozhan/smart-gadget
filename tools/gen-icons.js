'use strict';

// Uygulama ve tepsi ikonlarini bagimliliksiz uretir:
//   assets/icon.ico  (256px, PNG gomulu ICO)
//   assets/tray.png / tray-off.png (32px)
// Calistirma: npm run icons

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- Minimal PNG kodlayici ---

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit derinligi
  ihdr[9] = 6;  // renk tipi: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtre: yok
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function wrapIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);                    // tip: icon
  header.writeUInt16LE(1, 4);                    // 1 goruntu
  header[6] = size >= 256 ? 0 : size;            // genislik (0 = 256)
  header[7] = size >= 256 ? 0 : size;
  header.writeUInt16LE(1, 10);                   // duzlemler
  header.writeUInt16LE(32, 12);                  // bpp
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);                  // veri ofseti
  return Buffer.concat([header, png]);
}

// --- Cizim: yumusak kenarli ampul + govde ---

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function drawLamp(size, on) {
  const img = Buffer.alloc(size * size * 4);
  const cx = size * 0.5;
  const cy = size * 0.40;
  const r = size * 0.27;
  const bulbColor = on ? [255, 204, 77] : [125, 133, 148];
  const glowColor = [255, 220, 120];
  const baseColor = on ? [200, 160, 70] : [95, 102, 115];
  const baseW = size * 0.14;
  const baseTop = cy + r * 0.82;
  const baseBot = baseTop + size * 0.20;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dist = Math.hypot(px - cx, py - cy);

      let rC = 0, gC = 0, bC = 0, a = 0;

      if (on) {
        const glow = clamp01(1 - dist / (r * 1.85));
        const ga = glow * glow * 0.55;
        if (ga > 0) { rC = glowColor[0]; gC = glowColor[1]; bC = glowColor[2]; a = ga; }
      }

      const bulbCov = clamp01(r - dist + 0.5);
      if (bulbCov > 0) {
        rC = rC * (1 - bulbCov) + bulbColor[0] * bulbCov;
        gC = gC * (1 - bulbCov) + bulbColor[1] * bulbCov;
        bC = bC * (1 - bulbCov) + bulbColor[2] * bulbCov;
        a = Math.max(a, bulbCov);
      }

      const inBaseX = clamp01(baseW - Math.abs(px - cx) + 0.5);
      const inBaseY = clamp01(Math.min(py - baseTop, baseBot - py) + 0.5);
      const baseCov = Math.min(inBaseX, inBaseY);
      if (baseCov > 0 && bulbCov < 1) {
        const w = baseCov * (1 - bulbCov);
        rC = rC * (1 - w) + baseColor[0] * w;
        gC = gC * (1 - w) + baseColor[1] * w;
        bC = bC * (1 - w) + baseColor[2] * w;
        a = Math.max(a, w);
      }

      const o = (y * size + x) * 4;
      img[o] = Math.round(rC);
      img[o + 1] = Math.round(gC);
      img[o + 2] = Math.round(bC);
      img[o + 3] = Math.round(clamp01(a) * 255);
    }
  }
  return img;
}

const assets = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assets, { recursive: true });

const appPng = encodePng(256, drawLamp(256, true));
fs.writeFileSync(path.join(assets, 'icon.ico'), wrapIco(appPng, 256));
fs.writeFileSync(path.join(assets, 'icon.png'), appPng);
fs.writeFileSync(path.join(assets, 'tray.png'), encodePng(32, drawLamp(32, true)));
fs.writeFileSync(path.join(assets, 'tray-off.png'), encodePng(32, drawLamp(32, false)));
console.log('icons written to', assets);
