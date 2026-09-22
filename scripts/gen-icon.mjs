// 生成 Tauri/Capacitor 用的应用图标源文件（1024x1024 PNG，无第三方依赖）
// 图案：蓝色圆角底 + 白色日历。生成后可用 `npx tauri icon scripts/app-icon.png` 导出各尺寸。
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const W = 1024
const H = 1024

const BRAND = [79, 140, 255]
const BRAND_DARK = [61, 118, 240]
const WHITE = [255, 255, 255]

const buf = new Uint8Array(W * H * 4)

function setPx(x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  // 与透明背景做简单覆盖
  const aa = a / 255
  buf[i] = Math.round(r * aa + buf[i] * (1 - aa))
  buf[i + 1] = Math.round(g * aa + buf[i + 1] * (1 - aa))
  buf[i + 2] = Math.round(b * aa + buf[i + 2] * (1 - aa))
  buf[i + 3] = Math.max(buf[i + 3], a)
}

function fillRect(x, y, w, h, color, radius = 0) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (radius > 0) {
        const cx = px < x + radius ? x + radius : px > x + w - radius - 1 ? x + w - radius - 1 : px
        const cy = py < y + radius ? y + radius : py > y + h - radius - 1 ? y + h - radius - 1 : py
        const dx = px - cx
        const dy = py - cy
        if (dx * dx + dy * dy > radius * radius) continue
      }
      setPx(px, py, color)
    }
  }
}

function fillCircle(cx, cy, r, color) {
  for (let py = cy - r; py <= cy + r; py++) {
    for (let px = cx - r; px <= cx + r; px++) {
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= r * r) setPx(px, py, color)
    }
  }
}

// 背景
fillRect(0, 0, W, H, BRAND, 224)

// 日历挂环
fillRect(312, 196, 40, 110, WHITE, 20)
fillRect(672, 196, 40, 110, WHITE, 20)

// 日历卡片主体（白色圆角）
fillRect(232, 272, 560, 520, WHITE, 56)
// 顶部深色条：先整体圆角，再用方形条补平下沿
fillRect(232, 272, 560, 132, BRAND_DARK, 56)
fillRect(232, 328, 560, 76, BRAND_DARK)

// 日期点阵 3x3
for (const cx of [372, 512, 652]) {
  for (const cy of [500, 620, 740]) {
    fillCircle(cx, cy, 30, BRAND)
  }
}

// ---- 编码 PNG ----
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0 // filter: none
  Buffer.from(buf.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1)
}

function crc32(data) {
  let c = ~0
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (~c) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = path.join(__dirname, 'app-icon.png')
fs.writeFileSync(out, png)
console.log('icon written:', out, png.length, 'bytes')
