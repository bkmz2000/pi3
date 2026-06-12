import { describe, test, expect } from '@jest/globals';
import { makeUndoStack } from '../../src/makeUndoStack';

function px(val: number) { return new Uint8ClampedArray([val, 0, 0, 255]); }
const sprites = {};

describe('makeUndoStack', () => {
  test('canUndo is false initially', () => {
    expect(makeUndoStack().canUndo()).toBe(false);
  });

  test('canRedo is false initially', () => {
    expect(makeUndoStack().canRedo()).toBe(false);
  });

  test('push enables canUndo', () => {
    const s = makeUndoStack();
    s.push(px(1), sprites);
    expect(s.canUndo()).toBe(true);
  });

  test('push clears redo stack', () => {
    const s = makeUndoStack();
    s.push(px(1), sprites);
    s.popUndo(px(99), sprites); // move to redo
    expect(s.canRedo()).toBe(true);
    s.push(px(2), sprites); // new push clears redo
    expect(s.canRedo()).toBe(false);
  });

  test('popUndo returns the pushed snapshot', () => {
    const s = makeUndoStack();
    const original = px(42);
    s.push(original, sprites);
    const snap = s.popUndo(px(99), sprites);
    expect(snap).not.toBeNull();
    expect(snap!.pixels[0]).toBe(42);
  });

  test('popUndo returns null when empty', () => {
    expect(makeUndoStack().popUndo(px(1), sprites)).toBeNull();
  });

  test('popUndo saves current state to redo', () => {
    const s = makeUndoStack();
    s.push(px(1), sprites);
    s.popUndo(px(99), sprites);
    expect(s.canRedo()).toBe(true);
  });

  test('popRedo returns null when empty', () => {
    expect(makeUndoStack().popRedo(px(1), sprites)).toBeNull();
  });

  test('popRedo restores from redo and saves to undo', () => {
    const s = makeUndoStack();
    s.push(px(10), sprites);
    s.popUndo(px(20), sprites);  // redo now has px(20)
    const snap = s.popRedo(px(30), sprites); // undo now has px(30)
    expect(snap!.pixels[0]).toBe(20);
    expect(s.canUndo()).toBe(true);
  });

  test('snapshots are deep copies (pixel mutation does not affect stored entry)', () => {
    const s = makeUndoStack();
    const buf = px(5);
    s.push(buf, sprites);
    buf[0] = 99; // mutate after push
    const snap = s.popUndo(px(0), sprites);
    expect(snap!.pixels[0]).toBe(5); // stored value unchanged
  });

  test('limit trims oldest entries', () => {
    const s = makeUndoStack(3);
    s.push(px(1), sprites);
    s.push(px(2), sprites);
    s.push(px(3), sprites);
    s.push(px(4), sprites); // 4th push evicts first
    // Stack now has px(2), px(3), px(4) — three pops
    const a = s.popUndo(px(0), sprites);
    const b = s.popUndo(px(0), sprites);
    const c = s.popUndo(px(0), sprites);
    const d = s.popUndo(px(0), sprites);
    expect([a!.pixels[0], b!.pixels[0], c!.pixels[0]]).toEqual([4, 3, 2]);
    expect(d).toBeNull(); // oldest (1) was evicted
  });

  test('cancelLast removes last undo entry without touching redo', () => {
    const s = makeUndoStack();
    s.push(px(1), sprites);
    s.push(px(2), sprites);
    s.cancelLast();
    expect(s.canRedo()).toBe(false); // cancelLast must not push to redo
    const snap = s.popUndo(px(0), sprites);
    expect(snap!.pixels[0]).toBe(1); // px(2) was cancelled, px(1) is now on top
  });

  test('cancelLast on empty stack is safe', () => {
    expect(() => makeUndoStack().cancelLast()).not.toThrow();
  });
});
