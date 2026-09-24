type ServiceWorkerUpdateTarget = Pick<
  ServiceWorkerContainer,
  'controller' | 'addEventListener' | 'register'
>;

/**
 * Register the production worker and refresh once when a new release takes
 * control. Initial installs do not refresh: only pages already controlled by
 * an older worker need to be replaced.
 */
export async function installServiceWorkerUpdateFlow(
  serviceWorker: ServiceWorkerUpdateTarget,
  reload: () => void,
  warn: (message: string, error: unknown) => void,
): Promise<void> {
  const wasControlled = serviceWorker.controller !== null;
  let refreshing = false;

  serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || refreshing) return;
    refreshing = true;
    reload();
  });

  try {
    const registration = await serviceWorker.register('/sw.js', {
      // Never let the browser's HTTP cache delay discovery of a deployment.
      updateViaCache: 'none',
    });
    await registration.update();
  } catch (error) {
    // Non-fatal: the app remains usable online without PWA support.
    warn('Service worker registration/update failed:', error);
  }
}
