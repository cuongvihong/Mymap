/** Rules for block images (FR-AN-01). Shared by the service, the renderer and the tests. */

export const IMAGE_LIMITS = {
  /** 15 MB per file. */
  maxBytes: 15 * 1024 * 1024,
  /** Images on one block. */
  maxPerBlock: 8,
  /** Longest side of the thumbnail, in pixels. */
  thumbSide: 240,
  /** Characters of a pin note. */
  pinNote: 120,
  pinsPerImage: 40
} as const

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number]

/** Lower case extension without the dot when it is an allowed image format, else null. */
export function imageExtension(fileName: string): ImageExtension | null {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return null
  const ext = fileName.slice(dot + 1).toLowerCase()
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as ImageExtension) : null
}

/**
 * Thumbnail path of an image path: `anh/x.png` becomes `anh/x.thumb.png`. Electron's nativeImage
 * cannot encode WEBP, so the thumbnail is a PNG (keeps transparency). When none was made the protocol serves the original.
 */
export function thumbPath(relPath: string): string {
  const dot = relPath.lastIndexOf('.')
  return `${dot < 0 ? relPath : relPath.slice(0, dot)}.thumb.png`
}

/** `mapimg://<projectId>/<relPath>`, each segment encoded. */
export function imageUrl(projectId: number, relPath: string): string {
  return `mapimg://${projectId}/${relPath.split('/').map(encodeURIComponent).join('/')}`
}

/** Size that fits a thumbnail, never larger than the 240 px side. */
export function thumbSize(width: number, height: number, side: number = IMAGE_LIMITS.thumbSide) {
  const k = Math.min(1, side / Math.max(width, height, 1))
  return { w: Math.max(1, Math.round(width * k)), h: Math.max(1, Math.round(height * k)) }
}
