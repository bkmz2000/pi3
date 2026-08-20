/**
 * usePointerScrub: drag-to-scrub track behavior shared by DebugPanel and the
 * WelcomePage demo timeline. Converts pointer x within the ref'd element to a
 * 0..total-1 frame index; only reports while dragging; captures/releases the
 * pointer on down/up (release failures are swallowed).
 */
import { renderHook, act } from '@testing-library/react';
import { usePointerScrub } from '../../src/hooks/usePointerScrub';

function makeEl(rect: { left: number; width: number }) {
  return {
    getBoundingClientRect: () => ({ left: rect.left, width: rect.width, top: 0, height: 0, right: rect.left + rect.width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }),
    setPointerCapture: jest.fn(),
    releasePointerCapture: jest.fn(),
  };
}

type ScrubHandlers = ReturnType<typeof usePointerScrub<HTMLElement>>;
type PtrEvent = Parameters<ScrubHandlers['onPointerDown']>[0];

function makeEvent(clientX: number, pointerId: number, currentTarget: unknown) {
  return { clientX, pointerId, currentTarget } as unknown as PtrEvent;
}

describe('usePointerScrub', () => {
  it('clamps x to the track and maps it to a frame index', () => {
    const onChange = jest.fn();
    const el = makeEl({ left: 100, width: 200 });
    const { result } = renderHook(() => usePointerScrub<HTMLElement>(10, onChange));
    result.current.trackRef.current = el as unknown as HTMLElement;

    act(() => { result.current.onPointerDown(makeEvent(100, 1, el)); });
    expect(onChange).toHaveBeenLastCalledWith(0);

    act(() => { result.current.onPointerDown(makeEvent(300, 1, el)); });
    expect(onChange).toHaveBeenLastCalledWith(9);

    act(() => { result.current.onPointerDown(makeEvent(200, 1, el)); });
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('clamps clientX outside the track into the valid range', () => {
    const onChange = jest.fn();
    const el = makeEl({ left: 100, width: 200 });
    const { result } = renderHook(() => usePointerScrub<HTMLElement>(10, onChange));
    result.current.trackRef.current = el as unknown as HTMLElement;

    act(() => { result.current.onPointerDown(makeEvent(0, 1, el)); });
    expect(onChange).toHaveBeenLastCalledWith(0);

    act(() => { result.current.onPointerDown(makeEvent(999, 1, el)); });
    expect(onChange).toHaveBeenLastCalledWith(9);
  });

  it('returns 0 when there is no element or the total is <= 1', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => usePointerScrub<HTMLElement>(10, onChange));
    // No element mounted on trackRef yet; the event target itself is still a
    // real element with setPointerCapture in the browser.
    act(() => { result.current.onPointerDown(makeEvent(200, 1, makeEl({ left: 0, width: 100 }))); });
    expect(onChange).toHaveBeenLastCalledWith(0);

    const el = makeEl({ left: 100, width: 200 });
    const { result: resultSingle } = renderHook(() => usePointerScrub<HTMLElement>(1, onChange));
    resultSingle.current.trackRef.current = el as unknown as HTMLElement;
    act(() => { resultSingle.current.onPointerDown(makeEvent(200, 1, el)); });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('captures the pointer on down and releases on up', () => {
    const onChange = jest.fn();
    const el = makeEl({ left: 100, width: 200 });
    const { result } = renderHook(() => usePointerScrub<HTMLElement>(10, onChange));
    result.current.trackRef.current = el as unknown as HTMLElement;

    act(() => { result.current.onPointerDown(makeEvent(150, 42, el)); });
    expect(el.setPointerCapture).toHaveBeenCalledWith(42);
    expect(onChange).toHaveBeenCalledWith(2); // frac 0.25 -> round(0.25*9)=round(2.25)=2

    act(() => { result.current.onPointerUp(makeEvent(150, 42, el)); });
    expect(el.releasePointerCapture).toHaveBeenCalledWith(42);
  });

  it('swallows releasePointerCapture errors', () => {
    const onChange = jest.fn();
    const el = makeEl({ left: 100, width: 200 });
    el.releasePointerCapture.mockImplementation(() => { throw new Error('no capture'); });
    const { result } = renderHook(() => usePointerScrub<HTMLElement>(10, onChange));
    result.current.trackRef.current = el as unknown as HTMLElement;

    expect(() => {
      act(() => { result.current.onPointerUp(makeEvent(150, 42, el)); });
    }).not.toThrow();
  });

  it('only reports movement while dragging', () => {
    const onChange = jest.fn();
    const el = makeEl({ left: 100, width: 200 });
    const { result } = renderHook(() => usePointerScrub<HTMLElement>(10, onChange));
    result.current.trackRef.current = el as unknown as HTMLElement;

    act(() => { result.current.onPointerMove(makeEvent(200, 1, el)); });
    expect(onChange).not.toHaveBeenCalled();

    act(() => { result.current.onPointerDown(makeEvent(100, 1, el)); });
    onChange.mockClear();
    act(() => { result.current.onPointerMove(makeEvent(250, 1, el)); });
    expect(onChange).toHaveBeenCalledWith(7); // frac 0.75 -> round(6.75)=7

    act(() => { result.current.onPointerUp(makeEvent(250, 1, el)); });
    onChange.mockClear();
    act(() => { result.current.onPointerMove(makeEvent(280, 1, el)); });
    expect(onChange).not.toHaveBeenCalled();
  });
});