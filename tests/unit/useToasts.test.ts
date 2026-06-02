import { renderHook, act } from '@testing-library/react';
import { useToasts } from '../../src/state/useToasts';
import { useToastsStore } from '../../src/state/toastsStore';

describe('useToasts', () => {
  beforeEach(() => {
    useToastsStore.setState({ toasts: [] });
  });

  it('returns toasts, show, dismiss, and clear functions', () => {
    const { result } = renderHook(() => useToasts());

    expect(result.current).toHaveProperty('toasts');
    expect(result.current).toHaveProperty('show');
    expect(result.current).toHaveProperty('dismiss');
    expect(result.current).toHaveProperty('clear');
    expect(typeof result.current.show).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
    expect(typeof result.current.clear).toBe('function');
  });

  it('initially has empty toasts', () => {
    const { result } = renderHook(() => useToasts());

    expect(result.current.toasts).toEqual([]);
  });

  it('can show a toast', () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Test message', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: 'Test message',
      type: 'info',
    });
  });

  it('can dismiss a toast', () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Test message', 'info');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts).toEqual([]);
  });

  it('can clear all toasts', () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Message 1', 'info');
      result.current.show('Message 2', 'error');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.clear();
    });

    expect(result.current.toasts).toEqual([]);
  });

  it('auto-dismisses toasts after duration', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Auto-dismiss', 'success', 100);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.toasts).toHaveLength(0);
    jest.useRealTimers();
  });

  it('respects duration parameter', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Long toast', 'info', 5000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);
    jest.useRealTimers();
  });

  it('does not auto-dismiss with duration 0', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Persistent', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
    jest.useRealTimers();
  });

  it('does not auto-dismiss with negative duration', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.show('Persistent', 'error', -1);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
    jest.useRealTimers();
  });

  it('returns toast ID from show', () => {
    const { result } = renderHook(() => useToasts());

    let toastId: string;
    act(() => {
      toastId = result.current.show('Test', 'info');
    });

    expect(typeof toastId).toBe('string');
    expect(toastId).toContain('toast-');
    expect(result.current.toasts[0].id).toBe(toastId);
  });

  it('generates unique toast IDs', () => {
    const { result } = renderHook(() => useToasts());

    let id1: string, id2: string;
    act(() => {
      id1 = result.current.show('First', 'info');
      id2 = result.current.show('Second', 'error');
    });

    expect(id1).not.toBe(id2);
  });
});
