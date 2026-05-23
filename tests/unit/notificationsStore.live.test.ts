jest.mock('../../src/state/api', () => ({
  getHelpRequests: jest.fn(),
  addressHelpRequest: jest.fn(),
}));

import { useNotificationsStore } from '../../src/state/notificationsStore';
import * as api from '../../src/state/api';

const mockedGet = api.getHelpRequests as jest.MockedFunction<typeof api.getHelpRequests>;
const mockedAddress = api.addressHelpRequest as jest.MockedFunction<typeof api.addressHelpRequest>;

const makeReq = (id: string) => ({
  id,
  project_id: 'p1',
  status: 'pending',
  created_at: Date.now(),
  project_name: 'Game',
  student_id: 's1',
  student_name: 'Alice',
  student_handle: 'alice42',
});

describe('notificationsStore (live)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedAddress.mockReset();
    useNotificationsStore.getState()._stopPolling();
    document.title = 'pi3';
  });

  it('refresh populates helpRequests and updates title', async () => {
    mockedGet.mockResolvedValue([makeReq('r1'), makeReq('r2')]);
    await useNotificationsStore.getState().refresh();
    const state = useNotificationsStore.getState();
    expect(state.helpRequests).toHaveLength(2);
    expect(state.lastPolledAt).not.toBeNull();
    expect(state.error).toBeNull();
    expect(document.title).toMatch(/^\(2\)/);
  });

  it('refresh records error on api failure', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));
    await useNotificationsStore.getState().refresh();
    expect(useNotificationsStore.getState().error).toBe('boom');
  });

  it('address removes the request locally and resyncs title', async () => {
    mockedGet.mockResolvedValue([makeReq('r1'), makeReq('r2')]);
    mockedAddress.mockResolvedValue(undefined as unknown as void);
    await useNotificationsStore.getState().refresh();
    expect(document.title).toMatch(/^\(2\)/);

    await useNotificationsStore.getState().address('r1');
    const state = useNotificationsStore.getState();
    expect(state.helpRequests.map((r) => r.id)).toEqual(['r2']);
    expect(document.title).toMatch(/^\(1\)/);
    expect(mockedAddress).toHaveBeenCalledWith('r1');
  });

  it('clears title prefix when no pending requests remain', async () => {
    mockedGet.mockResolvedValue([]);
    await useNotificationsStore.getState().refresh();
    expect(document.title).not.toMatch(/^\(/);
  });

  it('_stopPolling clears title prefix', async () => {
    mockedGet.mockResolvedValue([makeReq('r1')]);
    await useNotificationsStore.getState().refresh();
    expect(document.title).toMatch(/^\(1\)/);
    useNotificationsStore.getState()._stopPolling();
    expect(document.title).not.toMatch(/^\(/);
  });
});
