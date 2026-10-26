import { IMAGE_LIMITS } from '../../../shared/diagram/imagerules'
import type { PinData } from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as images from '../repo/images'
import { finite, intArg, intList, plainObject, text } from './fields'

function percent(value: unknown, field: string): number {
  const n = finite(value, field)
  if (n < 0 || n > 100) throw new DiagramError('INVALID_ARGUMENT', `${field} must be 0 to 100`)
  return Math.round(n * 10) / 10
}

/** Pins on an image: a point in percent and a note of up to 120 characters (FR-AN-04). */
export function createPinService(ctx: DiagramContext) {
  const { db, logger } = ctx

  const requirePin = (id: unknown) => {
    const pin = images.getPin(db, intArg(id, 'id'))
    if (!pin) throw new DiagramError('PIN_NOT_FOUND', 'Pin not found')
    return pin
  }

  return {
    create(rawImageId: unknown, rawInput: unknown): PinData {
      const image = images.getImage(db, intArg(rawImageId, 'imageId'))
      if (!image) throw new DiagramError('IMAGE_NOT_FOUND', 'Image not found')
      const input = plainObject(rawInput, 'input')
      if (images.countPins(db, image.id) >= IMAGE_LIMITS.pinsPerImage)
        throw new DiagramError('IMAGE_LIMIT', 'An image holds at most 40 pins')
      const id = images.insertPin(db, {
        imageId: image.id,
        xPct: percent(input['xPct'], 'xPct'),
        yPct: percent(input['yPct'], 'yPct'),
        note: text(input['note'] ?? '', 'note', IMAGE_LIMITS.pinNote),
        sortOrder: images.nextPinOrder(db, image.id)
      })
      logger.info('pin created', { id })
      return images.pinToData(requirePin(id))
    },

    update(rawId: unknown, rawPatch: unknown): PinData {
      const pin = requirePin(rawId)
      const patch = plainObject(rawPatch, 'patch')
      images.updatePin(db, pin.id, {
        xPct: 'xPct' in patch ? percent(patch['xPct'], 'xPct') : pin.xPct,
        yPct: 'yPct' in patch ? percent(patch['yPct'], 'yPct') : pin.yPct,
        note: 'note' in patch ? text(patch['note'], 'note', IMAGE_LIMITS.pinNote) : pin.note
      })
      return images.pinToData(requirePin(pin.id))
    },

    remove(rawId: unknown): null {
      images.deletePin(db, requirePin(rawId).id)
      return null
    },

    reorder(rawImageId: unknown, rawIds: unknown): null {
      const image = images.getImage(db, intArg(rawImageId, 'imageId'))
      if (!image) throw new DiagramError('IMAGE_NOT_FOUND', 'Image not found')
      const ids = intList(rawIds, 'ids')
      const current = images.pinIdsOfImage(db, image.id)
      if (ids.length !== current.length || !ids.every((id) => current.includes(id)))
        throw new DiagramError('INVALID_ARGUMENT', 'ids must list every pin of the image once')
      images.setPinOrder(db, ids)
      return null
    }
  }
}

export type PinService = ReturnType<typeof createPinService>
