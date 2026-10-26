import { existsSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { IMAGE_EXTENSIONS, imageExtension } from '../../shared/diagram/imagerules'
import type { DiagramContext } from './context'
import * as projects from './repo/projects'

export const IMAGE_SCHEME = 'mapimg'

export interface ParsedImageUrl {
  projectId: number
  /** Path inside the project folder, forward slashes, already decoded. */
  rel: string
}

/**
 * The project id out of the host. Chromium treats a numeric host as an IPv4 address and hands it
 * over as `0.0.0.1` for `1`, so both spellings are read.
 */
export function hostToProjectId(host: string): number | null {
  if (/^\d{1,9}$/.test(host)) return Number(host)
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some((n) => n > 255)) return null
  return ((parts[0]! * 256 + parts[1]!) * 256 + parts[2]!) * 256 + parts[3]!
}

/**
 * `mapimg://<projectId>/<relPath>` into its parts, or null when the shape is wrong or any segment
 * is empty, `.`, `..`, or holds a backslash, a colon or a NUL. The raw string is checked, not a
 * normalised URL, so `..` can never be folded away before this test sees it.
 */
export function parseImageUrl(url: string): ParsedImageUrl | null {
  const prefix = `${IMAGE_SCHEME}://`
  if (!url.startsWith(prefix)) return null
  const clean = url.slice(prefix.length).split(/[?#]/)[0] ?? ''
  const parts = clean.split('/')
  const host = parts.shift() ?? ''
  const projectId = hostToProjectId(host)
  if (projectId === null) return null
  if (parts.length === 0) return null
  const decoded: string[] = []
  for (const part of parts) {
    let segment: string
    try {
      segment = decodeURIComponent(part)
    } catch {
      return null
    }
    if (
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      /[\\:\0]/.test(segment) ||
      segment.includes('/')
    )
      return null
    decoded.push(segment)
  }
  return { projectId, rel: decoded.join('/') }
}

/**
 * Absolute file for a request, or null. Only files inside `<project>/anh/` with an image extension
 * are served, so no URL can reach the database, config.json or another project.
 */
export function resolveImageRequest(ctx: DiagramContext, url: string): string | null {
  const parsed = parseImageUrl(url)
  if (!parsed) return null
  const project = projects.getProject(ctx.db, parsed.projectId)
  if (!project) return null
  const [first, ...rest] = parsed.rel.split('/')
  if (first !== 'anh' || rest.length !== 1) return null
  if (!imageExtension(parsed.rel)) return null
  const root = resolve(ctx.khoRoot, project.folder, 'anh')
  const full = resolve(root, rest[0] ?? '')
  const back = relative(root, full)
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return null
  if (isFile(full)) return full
  // A missing thumbnail falls back to the original image.
  const m = /^(.*)\.thumb\.png$/.exec(rest[0] ?? '')
  if (m) {
    for (const ext of IMAGE_EXTENSIONS) {
      const original = join(root, `${m[1]}.${ext}`)
      if (isFile(original)) return original
    }
  }
  return null
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}

let current: DiagramContext | null = null

/** The registered context follows the open Kho (the shell registers the scheme once). */
export function setImageContext(ctx: DiagramContext | null): void {
  current = ctx
}

export function currentImageFile(url: string): string | null {
  return current ? resolveImageRequest(current, url) : null
}
