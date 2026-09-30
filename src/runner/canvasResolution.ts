// Python's canvas dimensions stay in CSS/logical pixels. The backing store
// needs display pixels so browser scaling does not pixelate text and curves.
export function canvasBackingSize(width: number, height: number, devicePixelRatio: number) {
  // Bound the extra canvas memory/work on high-density displays.
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.min(devicePixelRatio, 2)
    : 1;
  const backingWidth = Math.max(1, Math.round(width * ratio));
  const backingHeight = Math.max(1, Math.round(height * ratio));
  return {
    width: backingWidth,
    height: backingHeight,
    scaleX: width > 0 ? backingWidth / width : 1,
    scaleY: height > 0 ? backingHeight / height : 1,
  };
}
