import {
  DEFAULT_PROJECT_SETTINGS,
  type ChannelMode,
  type ProjectSettings,
  type Theme
} from './types'

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light'
const isMode = (v: unknown): v is ChannelMode => v === 'one' || v === 'many'

/** Read settings_json. Unknown or invalid fields fall back to the defaults, never throw. */
export function parseSettings(json: string | null | undefined): ProjectSettings {
  let raw: unknown
  try {
    raw = json ? JSON.parse(json) : {}
  } catch {
    raw = {}
  }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    channelMode: isMode(o['channelMode']) ? o['channelMode'] : DEFAULT_PROJECT_SETTINGS.channelMode,
    playImages:
      typeof o['playImages'] === 'boolean' ? o['playImages'] : DEFAULT_PROJECT_SETTINGS.playImages,
    theme: isTheme(o['theme']) ? o['theme'] : DEFAULT_PROJECT_SETTINGS.theme
  }
}

/** Validate a patch from the renderer. Returns an error text, or null when the patch is fine. */
export function validateSettingsPatch(patch: unknown): string | null {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return 'patch must be an object'
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'channelMode' && !isMode(value)) return 'channelMode must be one or many'
    else if (key === 'playImages' && typeof value !== 'boolean') return 'playImages must be boolean'
    else if (key === 'theme' && !isTheme(value)) return 'theme must be dark or light'
    else if (!['channelMode', 'playImages', 'theme'].includes(key)) return `unknown key ${key}`
  }
  return null
}

export function validateViewport(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    ['x', 'y', 'zoom'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k] as number)) &&
    (o['zoom'] as number) > 0
  )
}
