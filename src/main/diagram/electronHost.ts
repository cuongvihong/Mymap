import type { ImageHost } from './services/image'

/**
 * The Electron side of image handling: nativeImage makes thumbnails, clipboard gives pasted images.
 * Loaded on first use so the rest of the module stays testable under plain Node.
 */
export const electronImageHost: ImageHost = {
  async thumbnail(bytes, side) {
    const { nativeImage } = await import('electron')
    const image = nativeImage.createFromBuffer(bytes)
    if (image.isEmpty()) return null
    const { width, height } = image.getSize()
    const k = Math.min(1, side / Math.max(width, height, 1))
    const small =
      k < 1
        ? image.resize({
            width: Math.max(1, Math.round(width * k)),
            height: Math.max(1, Math.round(height * k)),
            quality: 'good'
          })
        : image
    return small.toPNG()
  },

  async readClipboard() {
    const { clipboard } = await import('electron')
    // Electron 44 reads the clipboard through ClipboardItems; screenshots arrive as image/png.
    const items = await clipboard.read()
    for (const item of items) {
      if (!item.types.includes('image/png')) continue
      const blob = await item.getType('image/png')
      if (blob instanceof Blob) return Buffer.from(await blob.arrayBuffer())
    }
    return null
  }
}
