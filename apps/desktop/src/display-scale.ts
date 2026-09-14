const TARGET_ROOT_FONT_SIZE_IN_DEVICE_PIXELS = 20

export function calculateRootFontSize(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return TARGET_ROOT_FONT_SIZE_IN_DEVICE_PIXELS
  }

  return TARGET_ROOT_FONT_SIZE_IN_DEVICE_PIXELS / devicePixelRatio
}

export function applyDisplayScale(): void {
  const rootFontSize = calculateRootFontSize(window.devicePixelRatio)

  document.documentElement.style.fontSize = `${rootFontSize}px`
}
