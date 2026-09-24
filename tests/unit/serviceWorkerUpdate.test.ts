import { installServiceWorkerUpdateFlow } from '../../src/serviceWorkerUpdate';

function makeTarget(controlled: boolean) {
  let controllerChange: (() => void) | undefined;
  const update = jest.fn(async () => undefined);
  const register = jest.fn(async () => ({ update }) as unknown as ServiceWorkerRegistration);
  const target = {
    controller: controlled ? ({} as ServiceWorker) : null,
    addEventListener: jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'controllerchange') {
        controllerChange = typeof listener === 'function'
          ? () => listener(new Event('controllerchange'))
          : () => listener.handleEvent(new Event('controllerchange'));
      }
    }),
    register,
  } as unknown as Pick<ServiceWorkerContainer, 'controller' | 'addEventListener' | 'register'>;

  return { target, register, update, fireControllerChange: () => controllerChange?.() };
}

describe('service worker release updates', () => {
  it('bypasses the HTTP cache and checks for a new worker on page load', async () => {
    const h = makeTarget(true);
    await installServiceWorkerUpdateFlow(h.target, jest.fn(), jest.fn());

    expect(h.register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it('reloads exactly once when a new worker replaces an existing controller', async () => {
    const h = makeTarget(true);
    const reload = jest.fn();
    await installServiceWorkerUpdateFlow(h.target, reload, jest.fn());

    h.fireControllerChange();
    h.fireControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload on the first-ever service worker install', async () => {
    const h = makeTarget(false);
    const reload = jest.fn();
    await installServiceWorkerUpdateFlow(h.target, reload, jest.fn());

    h.fireControllerChange();
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps registration failures non-fatal', async () => {
    const h = makeTarget(true);
    const error = new Error('offline');
    h.register.mockRejectedValueOnce(error);
    const warn = jest.fn();

    await expect(installServiceWorkerUpdateFlow(h.target, jest.fn(), warn)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Service worker registration/update failed:', error);
  });
});
