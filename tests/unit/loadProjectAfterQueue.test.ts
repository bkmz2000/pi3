jest.mock('../../src/state/api', () => ({ getProject: jest.fn() }));

import { loadProjectAfterQueue } from '../../src/state/loadProjectAfterQueue';
import { getProject } from '../../src/state/api';

it('never issues a stale GET before an in-flight offline replay completes', async () => {
  let finishReplay: (() => void) | undefined;
  const replay = new Promise<void>((resolve) => { finishReplay = resolve; });
  const fetch = getProject as jest.MockedFunction<typeof getProject>;
  fetch.mockResolvedValueOnce({ id: 'p1', version: 8 } as Awaited<ReturnType<typeof getProject>>);

  const loading = loadProjectAfterQueue('p1', () => replay);
  expect(fetch).not.toHaveBeenCalled();
  finishReplay?.();
  expect(await loading).toMatchObject({ id: 'p1', version: 8 });
  expect(fetch).toHaveBeenCalledWith('p1');
});
