import { describe, expect, it } from 'vitest'
import { calculateRootFontSize } from './display-scale'

describe('calculateRootFontSize', () => {
  it('keeps the target size on a standard-density display', () => {
    expect(calculateRootFontSize(1)).toBe(20)
  })

  it('balances a 150 percent Windows display scale', () => {
    expect(calculateRootFontSize(1.5)).toBeCloseTo(13.333, 3)
  })

  it('falls back safely for an invalid display scale', () => {
    expect(calculateRootFontSize(0)).toBe(20)
  })
})
