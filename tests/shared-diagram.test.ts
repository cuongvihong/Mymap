import { describe, expect, it } from 'vitest'
import { formatDateTime } from '../src/shared/diagram/format'
import { normalize, slugify } from '../src/shared/diagram/normalize'
import {
  parseSettings,
  validateSettingsPatch,
  validateViewport
} from '../src/shared/diagram/settings'
import { DEFAULT_PROJECT_SETTINGS } from '../src/shared/diagram/types'

describe('normalize', () => {
  it('removes accents, folds case and spaces', () => {
    expect(normalize('  Đầu   TIÊN Dự Án ')).toBe('dau tien du an')
    expect(normalize('MOE EA')).toBe(normalize('moe ea'))
    expect(normalize('Trả bằng EA')).toBe('tra bang ea')
  })
})

describe('slugify', () => {
  it('makes a folder friendly name', () => {
    expect(slugify('MOE Education Account')).toBe('moe-education-account')
    expect(slugify('Dự án: Cổng thanh toán (v2)')).toBe('du-an-cong-thanh-toan-v2')
  })
  it('caps the length and never ends with a hyphen', () => {
    const slug = slugify('a'.repeat(39) + ' b' + 'c'.repeat(30))
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
  })
  it('falls back when nothing is left', () => {
    expect(slugify('???')).toBe('du-an')
  })
})

describe('settings', () => {
  it('defaults on null, damaged JSON or wrong types', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_PROJECT_SETTINGS)
    expect(parseSettings('{bad')).toEqual(DEFAULT_PROJECT_SETTINGS)
    expect(parseSettings('{"theme":"pink","playImages":"yes","channelMode":3}')).toEqual(
      DEFAULT_PROJECT_SETTINGS
    )
    expect(parseSettings('{"theme":"light"}')).toEqual({
      ...DEFAULT_PROJECT_SETTINGS,
      theme: 'light'
    })
  })
  it('validates patches', () => {
    expect(validateSettingsPatch({ theme: 'light', playImages: false })).toBeNull()
    expect(validateSettingsPatch({ theme: 1 })).not.toBeNull()
    expect(validateSettingsPatch({ other: 1 })).not.toBeNull()
    expect(validateSettingsPatch([])).not.toBeNull()
    expect(validateSettingsPatch(null)).not.toBeNull()
  })
  it('validates viewports', () => {
    expect(validateViewport({ x: 0, y: 0, zoom: 1 })).toBe(true)
    expect(validateViewport({ x: 0, y: 0 })).toBe(false)
    expect(validateViewport({ x: 0, y: 0, zoom: -1 })).toBe(false)
    expect(validateViewport({ x: Infinity, y: 0, zoom: 1 })).toBe(false)
  })
})

describe('formatDateTime (BR-10)', () => {
  it('formats dd/mm/yyyy HH:mm in 24 hour time', () => {
    expect(formatDateTime(new Date(2026, 9, 4, 8, 5).toISOString())).toBe('04/10/2026 08:05')
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe('31/12/2026 23:59')
  })
  it('returns an empty string for invalid input', () => {
    expect(formatDateTime('not a date')).toBe('')
  })
})
