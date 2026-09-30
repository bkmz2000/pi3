import { describe, expect, test } from '@jest/globals';
import { canvasBackingSize } from '../../src/runner/canvasResolution';

describe('canvasBackingSize', () => {
  test('preserves logical dimensions at DPR 1', () => {
    expect(canvasBackingSize(600, 600, 1)).toEqual({
      width: 600, height: 600, scaleX: 1, scaleY: 1,
    });
  });

  test('rasterizes logical drawing at the physical display resolution', () => {
    expect(canvasBackingSize(600, 600, 1.25)).toEqual({
      width: 750, height: 750, scaleX: 1.25, scaleY: 1.25,
    });
  });

  test('uses the rounded backing dimensions for non-integral sizes', () => {
    const result = canvasBackingSize(301, 201, 1.25);
    expect(result).toEqual({
      width: 376, height: 251, scaleX: 376 / 301, scaleY: 251 / 201,
    });
  });

  test('limits backing memory on high-density displays and handles bad ratios', () => {
    expect(canvasBackingSize(600, 400, 3).width).toBe(1200);
    expect(canvasBackingSize(600, 400, NaN).scaleX).toBe(1);
    expect(canvasBackingSize(600, 400, 0).scaleY).toBe(1);
  });
});
