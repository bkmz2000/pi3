import { useToastsStore } from './toastsStore';

export type AsyncActionOptions = {
  onError?: (error: Error) => Promise<void> | void;
  errorMessage?: (error: Error) => string;
  showError?: boolean;
};

export async function asyncAction<T>(
  operation: () => Promise<T>,
  options: AsyncActionOptions = {}
): Promise<T> {
  const { onError, errorMessage, showError = true } = options;

  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (showError) {
      const message =
        typeof errorMessage === 'function' ? errorMessage(err) : errorMessage || err.message;
      useToastsStore.getState().show(message, 'error');
    }

    if (onError) {
      await onError(err);
    }

    throw err;
  }
}
