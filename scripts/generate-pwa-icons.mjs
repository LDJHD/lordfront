// Génère les icônes PWA (encodage PNG manuel, aucune dépendance).
// Usage : node scripts/generate-pwa-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)))

// --- Encodage PNG (RGBA 8 bits) ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtre "None"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// --- Dessin (repère 512, sur-échantillonné pour l'anticrénelage) ---
const CROWN_BODY = [[156, 318], [156, 196], [218, 262], [256, 178], [294, 262], [356, 196], [356, 318]]
const CROWN_DOTS = [[156, 180, 16], [256, 158, 18], [356, 180, 16]]
const GOLD = [243, 169, 79] // #f3a94f
const BAND = [231, 150, 86] // #e79656
const BG_TOP = [43, 30, 66] // #2b1e42
const BG_BOTTOM = [22, 16, 33] // #161021
const GLOW = [255, 91, 142] // #ff5b8e

function inPolygon(px, py, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function colorAt(x, y) {
  const t = Math.min(1, Math.max(0, y / 512))
  let r = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t
  let g = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t
  let b = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t

  // Halo rose en bas
  const glowDist = Math.hypot(x - 256, y - 480) / 320
  const glow = Math.max(0, 1 - glowDist) * 0.25
  r += (GLOW[0] - r) * glow
  g += (GLOW[1] - g) * glow
  b += (GLOW[2] - b) * glow

  // Couronne
  const inBand = x >= 148 && x <= 364 && y >= 330 && y <= 368
  if (inPolygon(x, y, CROWN_BODY) || inBand) return [GOLD[0], GOLD[1], GOLD[2]]
  for (const [cx, cy, cr] of CROWN_DOTS) {
    if (Math.hypot(x - cx, y - cy) <= cr) return [GOLD[0], GOLD[1], GOLD[2]]
  }
  return [r, g, b]
}

function renderIcon(size, supersample = 2) {
  const scale = 512 / size
  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const x = (px + (sx + 0.5) / supersample) * scale
          const y = (py + (sy + 0.5) / supersample) * scale
          const c = colorAt(x, y)
          r += c[0]; g += c[1]; b += c[2]
        }
      }
      const samples = supersample * supersample
      const offset = (py * size + px) * 4
      rgba[offset] = Math.round(r / samples)
      rgba[offset + 1] = Math.round(g / samples)
      rgba[offset + 2] = Math.round(b / samples)
      rgba[offset + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

const outputs = [
  { path: join(frontendRoot, 'public', 'icons', 'icon-192.png'), size: 192 },
  { path: join(frontendRoot, 'public', 'icons', 'icon-512.png'), size: 512 },
  { path: join(frontendRoot, 'public', 'apple-touch-icon.png'), size: 180 },
  { path: join(frontendRoot, 'app', 'icon.png'), size: 512 },
]

for (const output of outputs) {
  mkdirSync(dirname(output.path), { recursive: true })
  writeFileSync(output.path, renderIcon(output.size))
  console.log(`[icons] ${output.path} (${output.size}x${output.size})`)
}
