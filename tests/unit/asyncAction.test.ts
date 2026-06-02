import { asyncAction } from '../../src/state/asyncAction';
import { useToastsStore } from '../../src/state/toastsStore';

describe('Async Action Error Helper', () => {
  beforeEach(() => {
    useToastsStore.setState({ toasts: [] });
  });

  it('shows error toast on failed operation', async () => {
    const error = new Error('Network failed');
    const operation = jest.fn().mockRejectedValue(error);

    try {
      await asyncAction(operation, {
        errorMessage: () => 'Custom error message',
      });
    } catch {
      // expected
    }

    const toasts = useToastsStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('Custom error message');
    expect(toasts[0].type).toBe('error');
  });

  it('calls onError handler on failure', async () => {
    const error = new Error('Operation failed');
    const operation = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    try {
      await asyncAction(operation, { onError, showError: false });
    } catch {
      // expected
    }

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('does not show error toast when showError is false', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failed'));

    try {
      await asyncAction(operation, { showError: false });
    } catch {
      // expected
    }

    const toasts = useToastsStore.getState().toasts;
    expect(toasts.length).toBe(0);
  });

  it('returns result on success', async () => {
    const operation = jest.fn().mockResolvedValue('success result');

    const result = await asyncAction(operation);

    expect(result).toBe('success result');
    expect(useToastsStore.getState().toasts.length).toBe(0);
  });

  it('allows dynamic error message based on error', async () => {
    const error = new Error('Specific error');
    const operation = jest.fn().mockRejectedValue(error);

    try {
      await asyncAction(operation, {
        errorMessage: (err) => `Failed: ${err.message}`,
      });
    } catch {
      // expected
    }

    const toasts = useToastsStore.getState().toasts;
    expect(toasts[0].message).toBe('Failed: Specific error');
  });

  it('uses string errorMessage directly', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Error'));

    try {
      await asyncAction(operation, {
        errorMessage: 'Static error message',
      } as Record<string, unknown>);
    } catch {
      // expected
    }

    const toasts = useToastsStore.getState().toasts;
    expect(toasts[0].message).toBe('Static error message');
  });

  it('handles non-Error objects thrown', async () => {
    const operation = jest.fn().mockRejectedValue('String error');

    try {
      await asyncAction(operation, {
        errorMessage: (err) => err.message,
      });
    } catch {
      // expected
    }

    const toasts = useToastsStore.getState().toasts;
    expect(toasts[0].message).toBe('String error');
  });

  it('calls onError and rethrows error', async () => {
    const error = new Error('Test error');
    const operation = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    try {
      await asyncAction(operation, { onError, showError: false });
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBe(error);
      expect(onError).toHaveBeenCalledWith(error);
    }
  });

  it('awaits onError handler', async () => {
    const error = new Error('Error');
    const operation = jest.fn().mockRejectedValue(error);
    let onErrorCalled = false;

    const onError = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      onErrorCalled = true;
    });

    try {
      await asyncAction(operation, { onError, showError: false });
    } catch {
      // expected
    }

    expect(onErrorCalled).toBe(true);
    expect(onError).toHaveBeenCalled();
  });

  it('uses error.message when no errorMessage provided', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Default error'));

    try {
      await asyncAction(operation);
    } catch {
      // expected
    }

    const toasts = useToastsStore.getState().toasts;
    expect(toasts[0].message).toBe('Default error');
  });

  it('throws error even after successful error handling', async () => {
    const error = new Error('Test');
    const operation = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    try {
      await asyncAction(operation, { onError, showError: false });
      fail('Should throw');
    } catch (e) {
      expect(e).toBe(error);
    }
  });
});
