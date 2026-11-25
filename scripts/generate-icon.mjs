import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const SIZE = 256;
const OUT_DIR = path.resolve("resources");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildIconRgba() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = 52;
  const pad = 12;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      const rx = Math.max(pad + radius - x, 0, x - (SIZE - pad - radius));
      const ry = Math.max(pad + radius - y, 0, y - (SIZE - pad - radius));
      const dist = Math.hypot(rx, ry);

      if (dist > radius + 1) {
        buf[idx + 3] = 0;
        continue;
      }

      const edgeAlpha = dist > radius - 1 ? Math.max(0, Math.min(1, radius + 1 - dist)) : 1;

      // Dark matte Claude charcoal background #212120 with subtle border
      let r = 33;
      let g = 33;
      let b = 32;
      if (dist > radius - 4) {
        r = 66;
        g = 66;
        b = 62;
      }

      // Terracotta starburst rays (#d97757 = 217, 119, 87)
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      let isStar = d < 18;

      if (!isStar && d >= 10 && d <= 78) {
        for (let k = 0; k < 10; k++) {
          const angle = (k * Math.PI) / 5;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const proj = dx * ux + dy * uy;
          const perp = Math.abs(-dx * uy + dy * ux);
          if (proj > 0 && proj <= 78 && perp <= 8.5) {
            isStar = true;
            break;
          }
        }
      }

      if (isStar) {
        r = 217;
        g = 119;
        b = 87;
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = Math.round(edgeAlpha * 255);
    }
  }
  return buf;
}

function wrapPngAsIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = 0; // 256px
  entry[1] = 0; // 256px
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12); // offset = 6 + 16

  return Buffer.concat([header, entry, pngBuffer]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const png = encodePng(SIZE, SIZE, buildIconRgba());
const ico = wrapPngAsIco(png);
fs.writeFileSync(path.join(OUT_DIR, "icon.png"), png);
fs.writeFileSync(path.join(OUT_DIR, "icon.ico"), ico);
console.log("Generated resources/icon.png and resources/icon.ico");
