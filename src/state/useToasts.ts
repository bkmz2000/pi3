import { useToastsStore } from './toastsStore';

export function useToasts() {
  const show = useToastsStore((s) => s.show);
  const dismiss = useToastsStore((s) => s.dismiss);
  const clear = useToastsStore((s) => s.clear);
  const toasts = useToastsStore((s) => s.toasts);

  return { toasts, show, dismiss, clear };
}
