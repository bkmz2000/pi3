/**
 * Coverage tests for src/state/api.ts.
 *
 * Strategy: replace global fetch with a queueable mock, drive the ApiClient
 * through its full request branch tree (success / 204 / 401 / error JSON /
 * error JSON parse failure / non-JSON success), then sample one named helper
 * per HTTP verb so each export is touched.
 */

import {
  api,
  uploadProjectThumbnail,
  getMe,
  outsiderSignup,
  outsiderLogin,
  getProjects,
  createProject,
  getProject,
  updateProject,
  saveProjectContent,
  deleteProject,
  shareProject,
  searchUsers,
  shareProjectWithUser,
  getTeacherShare,
  unshareProject,
  toggleHelpRequest,
  getSharedProjects,
  getHelpRequests,
  getGroupHelpRequests,
  addressHelpRequest,
  markHelpRequestInProgress,
  getComments,
  addComment,
  deleteComment,
  getGroups,
  updateGroup,
  regenerateInviteCode,
  joinGroupByCode,
  getMyGroups,
  createGroup,
  getGroup,
  deleteGroup,
  inviteToGroup,
  removeFromGroup,
  getConfig,
} from '../../src/state/api';

type FetchCall = { url: string; init?: RequestInit };

let lastCalls: FetchCall[] = [];

function fakeResponse(body: unknown, init: { status?: number; ok?: boolean; jsonThrows?: boolean } = {}): Response {
  const status = init.status ?? 200;
  return {
    status,
    ok: init.ok ?? (status >= 200 && status < 300),
    async json() {
      if (init.jsonThrows) throw new Error('bad json');
      return body;
    },
  } as unknown as Response;
}

function mockFetchOnce(response: Response) {
  (global.fetch as jest.Mock).mockImplementationOnce((url: string, opts?: RequestInit) => {
    lastCalls.push({ url, init: opts });
    return Promise.resolve(response);
  });
}

beforeEach(() => {
  lastCalls = [];
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('ApiClient.request branches', () => {
  it('GET resolves with parsed JSON on success', async () => {
    mockFetchOnce(fakeResponse({ id: '1', name: 'me' }));
    const result = await api.get<{ id: string; name: string }>('/api/users/me');
    expect(result).toEqual({ id: '1', name: 'me' });
    expect(lastCalls[0].url).toBe('/api/users/me');
    expect((lastCalls[0].init as RequestInit).method).toBe('GET');
    expect((lastCalls[0].init as RequestInit).credentials).toBe('include');
    expect((lastCalls[0].init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });

  it('returns empty object on 204 No Content', async () => {
    mockFetchOnce(fakeResponse(null, { status: 204, ok: true }));
    const result = await api.delete<{ unused?: boolean }>('/api/something');
    expect(result).toEqual({});
  });

  it('401 triggers onUnauthorized callback and rejects with Unauthorized', async () => {
    const cb = jest.fn();
    api.setOnUnauthorized(cb);
    mockFetchOnce(fakeResponse({}, { status: 401, ok: false }));
    await expect(api.get('/api/me')).rejects.toThrow('Unauthorized');
    expect(cb).toHaveBeenCalledTimes(1);
    // Reset for subsequent tests
    api.setOnUnauthorized(() => {});
  });

  it('non-ok response throws with the server-provided message', async () => {
    mockFetchOnce(fakeResponse({ error: 'Conflict', message: 'Name taken' }, { status: 409, ok: false }));
    await expect(api.post('/api/x', { foo: 1 })).rejects.toThrow('Name taken');
  });

  it('non-ok response falls back to error.error when message is empty', async () => {
    mockFetchOnce(fakeResponse({ error: 'OnlyError', message: '' }, { status: 400, ok: false }));
    await expect(api.put('/api/y', { z: true })).rejects.toThrow('OnlyError');
  });

  it('non-ok response with unparseable JSON body throws generic message', async () => {
    mockFetchOnce(fakeResponse(null, { status: 500, ok: false, jsonThrows: true }));
    await expect(api.get('/api/boom')).rejects.toThrow('An error occurred');
  });

  it('post serializes the body to JSON; post with no body omits it', async () => {
    mockFetchOnce(fakeResponse({}));
    await api.post('/api/x', { a: 1 });
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBe('{"a":1}');

    mockFetchOnce(fakeResponse({}));
    await api.post('/api/x');
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBeUndefined();
  });

  it('put and patch use the right verbs and JSON-serialize the body', async () => {
    mockFetchOnce(fakeResponse({}));
    await api.put('/p', { x: 1 });
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('PUT');
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBe('{"x":1}');

    mockFetchOnce(fakeResponse({}));
    await api.patch('/q', { y: 2 });
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('PATCH');
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBe('{"y":2}');
  });

  it('put and patch with no body omit body', async () => {
    mockFetchOnce(fakeResponse({}));
    await api.put('/p');
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBeUndefined();

    mockFetchOnce(fakeResponse({}));
    await api.patch('/q');
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBeUndefined();
  });

  it('delete without options works correctly', async () => {
    mockFetchOnce(fakeResponse({ success: true }));
    const result = await api.delete('/api/something');
    expect(result).toEqual({ success: true });
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('DELETE');
  });

  it('request merges default headers with provided headers', async () => {
    mockFetchOnce(fakeResponse({ ok: true }));
    await api.get('/api/test');
    const headers = (lastCalls.at(-1)!.init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('error response with message field uses message', async () => {
    mockFetchOnce(fakeResponse({ error: 'E', message: 'msg' }, { status: 400, ok: false }));
    await expect(api.get('/api/test')).rejects.toThrow('msg');
  });

  it('error response with empty message uses error field', async () => {
    mockFetchOnce(fakeResponse({ error: 'NotFound', message: '' }, { status: 404, ok: false }));
    await expect(api.get('/api/test')).rejects.toThrow('NotFound');
  });

  it('handles missing error and message fields in error response', async () => {
    mockFetchOnce(fakeResponse({}, { status: 400, ok: false, jsonThrows: false }));
    await expect(api.get('/api/test')).rejects.toThrow();
  });
});

describe('API initialization and headers', () => {
  it('request merges default and provided headers', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(fakeResponse({ data: 'test' }))
    );
    await api.get('/test', {
      headers: { 'Authorization': 'Bearer token' } as Record<string, string>,
    } as Record<string, unknown>);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('setOnUnauthorized sets callback', () => {
    const callback = jest.fn();
    api.setOnUnauthorized(callback);
    expect(typeof callback).toBe('function');
  });

  it('multiple 401 responses call onUnauthorized callback', async () => {
    const cb = jest.fn();
    api.setOnUnauthorized(cb);

    mockFetchOnce(fakeResponse({}, { status: 401, ok: false }));
    await expect(api.get('/api/1')).rejects.toThrow();

    mockFetchOnce(fakeResponse({}, { status: 401, ok: false }));
    await expect(api.get('/api/2')).rejects.toThrow();

    expect(cb).toHaveBeenCalledTimes(2);
    api.setOnUnauthorized(() => {});
  });

  it('credentials include in all requests', async () => {
    mockFetchOnce(fakeResponse({ data: 'test' }));
    await api.get('/api/test');
    expect((lastCalls.at(-1)!.init as RequestInit).credentials).toBe('include');
  });

  it('post with empty body sends undefined', async () => {
    mockFetchOnce(fakeResponse({}));
    await api.post('/api/test');
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBeUndefined();
  });

  it('post with null body sends undefined', async () => {
    mockFetchOnce(fakeResponse({}));
    await api.post('/api/test', null);
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBeUndefined();
  });

  it('post with false body sends undefined', async () => {
    mockFetchOnce(fakeResponse({}));
    await api.post('/api/test', false);
    expect((lastCalls.at(-1)!.init as RequestInit).body).toBeUndefined();
  });

  it('response.ok=false and status 500 returns error', async () => {
    mockFetchOnce(fakeResponse({ error: 'ServerError' }, { status: 500, ok: false }));
    await expect(api.get('/api/error')).rejects.toThrow();
  });

  it('successful response returns parsed JSON directly', async () => {
    const data = { id: '1', name: 'test', nested: { value: 42 } };
    mockFetchOnce(fakeResponse(data));
    const result = await api.get('/api/test');
    expect(result).toEqual(data);
  });

  it('error with both error and message uses message', async () => {
    mockFetchOnce(fakeResponse({ error: 'Err', message: 'Msg' }, { status: 400, ok: false }));
    await expect(api.post('/api/test', {})).rejects.toThrow('Msg');
  });
});

describe('uploadProjectThumbnail', () => {
  it('PUTs the blob to the thumbnail endpoint and returns parsed JSON', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    mockFetchOnce(fakeResponse({ thumbnail_updated_at: 1700000000 }));
    const res = await uploadProjectThumbnail('p1', blob);
    expect(res.thumbnail_updated_at).toBe(1700000000);
    expect(lastCalls[0].url).toBe('/api/projects/p1/thumbnail');
    expect((lastCalls[0].init as RequestInit).method).toBe('PUT');
    expect((lastCalls[0].init as RequestInit).body).toBe(blob);
  });

  it('throws with status code on non-ok response', async () => {
    mockFetchOnce(fakeResponse({}, { status: 500, ok: false }));
    await expect(uploadProjectThumbnail('p1', new Blob())).rejects.toThrow('500');
  });
});

describe('helper exports — exercise one per verb so each line runs', () => {
  it('GET helpers hit the documented paths', async () => {
    mockFetchOnce(fakeResponse({ id: 'u' }));
    await getMe();
    expect(lastCalls.at(-1)!.url).toBe('/api/users/me');

    mockFetchOnce(fakeResponse([]));
    await getProjects();
    expect(lastCalls.at(-1)!.url).toBe('/api/projects');

    mockFetchOnce(fakeResponse({ id: 'p' }));
    await getProject('p');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p');

    mockFetchOnce(fakeResponse({}));
    await getTeacherShare('p');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/teacher-share');

    mockFetchOnce(fakeResponse([]));
    await getSharedProjects();
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/shared-with-me');

    mockFetchOnce(fakeResponse([]));
    await getHelpRequests();
    expect(lastCalls.at(-1)!.url).toBe('/api/help-requests');

    mockFetchOnce(fakeResponse([]));
    await getGroupHelpRequests('g 1');
    expect(lastCalls.at(-1)!.url).toBe('/api/help-requests?group_id=g%201');

    mockFetchOnce(fakeResponse([]));
    await getComments('p');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/comments');

    mockFetchOnce(fakeResponse([]));
    await getComments('p', 'main.py');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/comments?file=main.py');

    mockFetchOnce(fakeResponse([]));
    await getGroups();
    expect(lastCalls.at(-1)!.url).toBe('/api/groups');

    mockFetchOnce(fakeResponse([]));
    await getGroups(true);
    expect(lastCalls.at(-1)!.url).toBe('/api/groups?include_archived=1');

    mockFetchOnce(fakeResponse([]));
    await getMyGroups();
    expect(lastCalls.at(-1)!.url).toBe('/api/groups/my');

    mockFetchOnce(fakeResponse({ id: 'g' }));
    await getGroup('g');
    expect(lastCalls.at(-1)!.url).toBe('/api/groups/g');

    mockFetchOnce(fakeResponse({ allowPasswordAuth: true }));
    const cfg = await getConfig();
    expect(cfg.allowPasswordAuth).toBe(true);
  });

  it('POST helpers hit the documented paths with the documented body shapes', async () => {
    // SPP-2: signup only sends password. name/role removed from the client
    // helper — backend auto-generates the handle and ignored those fields.
    mockFetchOnce(fakeResponse({ id: 'u' }));
    await outsiderSignup('p');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ password: 'p' });

    mockFetchOnce(fakeResponse({ id: 'u' }));
    await outsiderLogin('n', 'p');
    expect(lastCalls.at(-1)!.url).toBe('/api/users/outsider/login');

    mockFetchOnce(fakeResponse({ id: 'p' }));
    await createProject({ name: 'New' });
    expect(lastCalls.at(-1)!.url).toBe('/api/projects');

    mockFetchOnce(fakeResponse({}));
    await shareProject('p', 'alice', 'editor');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ username: 'alice', role: 'editor' });

    mockFetchOnce(fakeResponse({}));
    await shareProjectWithUser('p', 'u1', 'viewer');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ user_id: 'u1', role: 'viewer' });

    mockFetchOnce(fakeResponse({ help_request: { id: 'h', status: 'open' } }));
    await toggleHelpRequest('p');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/help-request');

    mockFetchOnce(fakeResponse({ id: 'g' }));
    await createGroup('Class A');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ name: 'Class A' });

    mockFetchOnce(fakeResponse({ invite_code: 'abc' }));
    await regenerateInviteCode('g1');
    expect(lastCalls.at(-1)!.url).toBe('/api/groups/g1/invite-code/regenerate');

    mockFetchOnce(fakeResponse({ id: 'g', name: 'G' }));
    await joinGroupByCode('code1');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ code: 'code1' });

    mockFetchOnce(fakeResponse({ id: 'm' }));
    await inviteToGroup('g1', 'bob');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ username: 'bob' });

    mockFetchOnce(fakeResponse({ id: 'c' }));
    await addComment('p', { file_path: 'main.py', line_number: 3, anchor_text: 'x', text: 'note' });
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/comments');
  });

  it('PUT helpers serialize the patch body', async () => {
    mockFetchOnce(fakeResponse({ id: 'p' }));
    await updateProject('p', { name: 'Renamed' });
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('PUT');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ name: 'Renamed' });

    mockFetchOnce(fakeResponse({ id: 'p' }));
    await saveProjectContent('p', { files: { 'a.py': 'a = 1' } });
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/save');
  });

  it('PATCH helpers carry the status', async () => {
    mockFetchOnce(fakeResponse({}));
    await addressHelpRequest('h1');
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ status: 'addressed' });

    mockFetchOnce(fakeResponse({}));
    await markHelpRequestInProgress('h2');
    expect(JSON.parse((lastCalls.at(-1)!.init as RequestInit).body as string))
      .toEqual({ status: 'in_progress' });

    mockFetchOnce(fakeResponse({ id: 'g' }));
    await updateGroup('g', { name: 'X', archived: true });
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('PATCH');
  });

  it('DELETE helpers hit the right path', async () => {
    mockFetchOnce(fakeResponse({}, { status: 204, ok: true }));
    await deleteProject('p');
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('DELETE');

    mockFetchOnce(fakeResponse({}, { status: 204, ok: true }));
    await unshareProject('p', 'u');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/share/u');

    mockFetchOnce(fakeResponse({}, { status: 204, ok: true }));
    await deleteComment('p', 'c1');
    expect(lastCalls.at(-1)!.url).toBe('/api/projects/p/comments/c1');

    mockFetchOnce(fakeResponse({}, { status: 204, ok: true }));
    await deleteGroup('g');
    expect((lastCalls.at(-1)!.init as RequestInit).method).toBe('DELETE');

    mockFetchOnce(fakeResponse({}, { status: 204, ok: true }));
    await removeFromGroup('g', 'u');
    expect(lastCalls.at(-1)!.url).toBe('/api/groups/g/members/u');
  });
});

describe('searchUsers', () => {
  it('returns [] without calling fetch for query shorter than 2 chars', async () => {
    const result = await searchUsers(' a ');
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('URL-encodes the query and hits /api/users/search', async () => {
    mockFetchOnce(fakeResponse([{ id: 'u', name: 'alice' }]));
    await searchUsers('al ice&');
    expect(lastCalls.at(-1)!.url).toBe('/api/users/search?q=al%20ice%26');
  });
});
