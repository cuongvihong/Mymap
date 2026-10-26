import { describe, expect, it } from 'vitest'
import {
  calloutMetrics,
  fitView,
  peekView,
  playPeekModel,
  pinView,
  pinZoom,
  pointToPct,
  stepPin
} from '../src/shared/diagram/pinview'
import {
  IMAGE_LIMITS,
  imageExtension,
  imageUrl,
  thumbPath,
  thumbSize
} from '../src/shared/diagram/imagerules'

const image = { w: 1288, h: 1930 }

describe('pin view', () => {
  it('keeps the zoom between 0.7 and 1.15', () => {
    expect(pinZoom({ w: 300, h: 300 })).toBe(0.7)
    expect(pinZoom({ w: 2000, h: 2000 })).toBe(1.15)
    expect(pinZoom({ w: 700, h: 520 })).toBe(1)
    expect(pinZoom({ w: 770, h: 780 })).toBeCloseTo(1.1)
  })

  it('puts the pin at the middle of the frame', () => {
    const frame = { w: 800, h: 700 }
    const pin = { xPct: 52.6, yPct: 59.7 }
    const v = pinView(image, frame, pin)
    const screenX = v.tx + (pin.xPct / 100) * image.w * v.scale
    const screenY = v.ty + (pin.yPct / 100) * image.h * v.scale
    expect(screenX).toBeCloseTo(400)
    expect(screenY).toBeCloseTo(350)
    expect(v.scale).toBeCloseTo(pinZoom(frame))
  })

  it('uses an explicit zoom when one is given', () => {
    const v = pinView(image, { w: 800, h: 700 }, { xPct: 0, yPct: 0 }, 2)
    expect(v).toEqual({ scale: 2, tx: 400, ty: 350 })
  })

  it('fits the whole image centred', () => {
    const v = fitView(image, { w: 800, h: 700 })
    expect(v.scale).toBeCloseTo(700 / 1930)
    expect(v.tx).toBeCloseTo((800 - 1288 * v.scale) / 2)
    expect(v.ty).toBeCloseTo(0)
  })

  it('divides the callout by the zoom so its text stays 12 px on screen', () => {
    const m = calloutMetrics(0.7)
    expect(m.fontSize * 0.7).toBeCloseTo(12)
    expect(m.maxWidth * 0.7).toBeCloseTo(240)
    expect(m.offset * 0.7).toBeCloseTo(18)
  })

  it('centres the pin in the play card with a zoom between 0.42 and 0.6', () => {
    const v = peekView(image, { xPct: 50, yPct: 30.5 })
    expect(v.scale).toBeGreaterThanOrEqual(0.42)
    expect(v.scale).toBeLessThanOrEqual(0.6)
    expect(v.tx + 0.5 * image.w * v.scale).toBeCloseTo(140)
    expect(v.ty + 0.305 * image.h * v.scale).toBeCloseTo(85)
    expect(peekView({ w: 200, h: 300 }, { xPct: 1, yPct: 1 }).scale).toBe(0.6)
  })

  it('maps a click back to percent and keeps it inside the image', () => {
    const view = fitView(image, { w: 800, h: 700 })
    const sx = view.tx + 0.25 * image.w * view.scale
    const sy = view.ty + 0.4 * image.h * view.scale
    const p = pointToPct(image, view, sx, sy)
    expect(p.xPct).toBeCloseTo(25, 0)
    expect(p.yPct).toBeCloseTo(40, 0)
    expect(pointToPct(image, view, -500, 9999)).toEqual({ xPct: 0, yPct: 100 })
  })

  it('steps through pins and wraps', () => {
    expect(stepPin(-1, 5, 1)).toBe(0)
    expect(stepPin(-1, 5, -1)).toBe(4)
    expect(stepPin(4, 5, 1)).toBe(0)
    expect(stepPin(0, 5, -1)).toBe(4)
    expect(stepPin(2, 0, 1)).toBe(-1)
  })
})

describe('play card model', () => {
  const fs08 = { w: 850, h: 2048 }
  const pins = [
    {
      id: 1,
      note: 'SingPass lỗi hoặc Parent hủy: báo MSG-0802, quay lại đăng nhập',
      xPct: 81.3,
      yPct: 14.8
    },
    {
      id: 2,
      note: 'API dữ liệu phải trả lời trong 10 giây, quá hạn báo MSG-0809',
      xPct: 50,
      yPct: 30.5
    },
    {
      id: 3,
      note: 'Không tìm thấy Parent hoặc Parent không có con: MSG-0801',
      xPct: 50,
      yPct: 37.9
    },
    {
      id: 4,
      note: 'Lần đầu đăng nhập: tạo tài khoản, liên kết con theo NRIC',
      xPct: 50,
      yPct: 50.3
    },
    {
      id: 5,
      note: 'Con đủ 16 tuổi: chỉ xem, không thanh toán, không nộp FAS',
      xPct: 50,
      yPct: 74.2
    }
  ]

  it('shows the pin that matches the step note, centred, with the marker counter scaled', () => {
    const m = playPeekModel(
      fs08,
      pins,
      'Lần đầu đăng nhập thì tạo tài khoản và liên kết con theo NRIC'
    )
    expect(m.index).toBe(3)
    expect(m.view.tx + 0.5 * fs08.w * m.view.scale).toBeCloseTo(140)
    expect(m.view.ty + 0.503 * fs08.h * m.view.scale).toBeCloseTo(85)
    expect(m.markerScale * m.view.scale).toBeCloseTo(1)
  })

  it('takes an explicit pin over the step note and handles an image without pins', () => {
    expect(playPeekModel(fs08, pins, 'Lần đầu đăng nhập', 0).index).toBe(0)
    const none = playPeekModel(fs08, [], 'bất kỳ')
    expect(none.index).toBe(-1)
    expect(none.view.scale).toBeGreaterThanOrEqual(0.42)
  })
})

describe('image rules', () => {
  it('accepts PNG, JPG, WEBP and GIF only', () => {
    expect(imageExtension('a.PNG')).toBe('png')
    expect(imageExtension('b.jpeg')).toBe('jpeg')
    expect(imageExtension('c.webp')).toBe('webp')
    expect(imageExtension('d.gif')).toBe('gif')
    expect(imageExtension('e.bmp')).toBeNull()
    expect(imageExtension('noext')).toBeNull()
    expect(imageExtension('x.svg')).toBeNull()
  })

  it('names the thumbnail next to the image and builds an encoded url', () => {
    expect(thumbPath('anh/ab12.png')).toBe('anh/ab12.thumb.png')
    expect(imageUrl(3, 'anh/a b.png')).toBe('mapimg://3/anh/a%20b.png')
  })

  it('shrinks to a 240 px side and never enlarges', () => {
    expect(thumbSize(1288, 1930)).toEqual({ w: 160, h: 240 })
    expect(thumbSize(100, 50)).toEqual({ w: 100, h: 50 })
    expect(IMAGE_LIMITS.maxBytes).toBe(15728640)
    expect(IMAGE_LIMITS.maxPerBlock).toBe(8)
  })
})
