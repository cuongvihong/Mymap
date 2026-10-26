/**
 * Width and height of PNG, JPEG, GIF and WEBP files read from the header bytes alone, so the main
 * process needs no decoder for it (and tests need no Electron). Returns null for anything else.
 */
export interface Dimensions {
  width: number
  height: number
}

const u16be = (b: Uint8Array, o: number) => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0)
const u16le = (b: Uint8Array, o: number) => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8)
const u24le = (b: Uint8Array, o: number) => u16le(b, o) | ((b[o + 2] ?? 0) << 16)
const u32be = (b: Uint8Array, o: number) =>
  ((b[o] ?? 0) * 0x1000000 + ((b[o + 1] ?? 0) << 16) + ((b[o + 2] ?? 0) << 8) + (b[o + 3] ?? 0)) >>>
  0
const ascii = (b: Uint8Array, o: number, n: number) =>
  String.fromCharCode(...Array.from(b.subarray(o, o + n)))

const ok = (width: number, height: number): Dimensions | null =>
  width > 0 && height > 0 && width < 65536 * 4 && height < 65536 * 4 ? { width, height } : null

function png(b: Uint8Array): Dimensions | null {
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null
  return ok(u32be(b, 16), u32be(b, 20))
}

function gif(b: Uint8Array): Dimensions | null {
  if (b.length < 10) return null
  return ok(u16le(b, 6), u16le(b, 8))
}

function jpeg(b: Uint8Array): Dimensions | null {
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++
      continue
    }
    const marker = b[i + 1] ?? 0
    if (marker === 0xff) {
      i++
      continue
    }
    // Standalone markers have no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const length = u16be(b, i + 2)
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) return ok(u16be(b, i + 7), u16be(b, i + 5))
    if (length < 2) return null
    i += 2 + length
  }
  return null
}

function webp(b: Uint8Array): Dimensions | null {
  if (b.length < 30) return null
  const kind = ascii(b, 12, 4)
  if (kind === 'VP8 ') return ok(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff)
  if (kind === 'VP8L') {
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)
    return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
  }
  if (kind === 'VP8X') return ok(u24le(b, 24) + 1, u24le(b, 27) + 1)
  return null
}

export function imageDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return png(bytes)
  if (ascii(bytes, 0, 3) === 'GIF') return gif(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes)
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return webp(bytes)
  return null
}
