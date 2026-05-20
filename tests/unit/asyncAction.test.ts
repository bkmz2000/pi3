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
});
