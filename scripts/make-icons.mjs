// Vẽ biểu tượng app (PNG) không cần thư viện ảnh: nền xanh, tờ lịch trắng, các ô màu.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => { let c = ~0; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

function icon(size) {
  const px = Buffer.alloc(size * size * 3)
  const S = (v) => v * size / 100
  const inRound = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }
  const cells = { '0,0': '#ff9500', '2,0': '#34c759', '1,1': '#ff3b30', '3,1': '#ff9500', '0,2': '#5856d6', '2,2': '#34c759', '1,3': '#af52de', '3,2': '#ff3b30' }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let c = hex('#007aff')
    if (inRound(x, y, S(16), S(20), S(84), S(84), S(8))) {
      c = [255, 255, 255]
      if (y < S(34)) c = hex('#ff3b30')
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x0 = S(21 + i * 15.5), y0 = S(39 + j * 11)
        if (inRound(x, y, x0, y0, x0 + S(12.5), y0 + S(8.5), S(2))) c = hex(cells[`${i},${j}`] ?? '#e5e5ea')
      }
    }
    if (inRound(x, y, S(30), S(12), S(36), S(28), S(3)) || inRound(x, y, S(64), S(12), S(70), S(28), S(3))) c = [255, 255, 255]
    px.set(c, (y * size + x) * 3)
  }
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), icon(size))
}
// Biểu tượng app iPhone thật (1024×1024, không trong suốt — Apple yêu cầu)
writeFileSync(new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url), icon(1024))
console.log('ok')
