/**
 * Coverage for RunnerProvider code paths outside `_onMessage` (already covered
 * by runnerLiveCanvas.test.ts / runnerErrorChannel.test.ts): the worker
 * singleton's onmessage/onerror wiring, the compete-guard suppression branch,
 * the request/response helpers (runOnce/runGenerator/runReference/runChecker),
 * and the transport-control side of the `useRunner()` hook (pause/resume/
 * step/scrub — the parts that don't need Image/canvas/fetch mocking).
 *
 * The worker itself is the shared `mockWorkerInstance` from
 * tests/unit/__mocks__/workerFactory.ts (wired via moduleNameMapper).
 * `addEventListener` is a spy, not a real EventTarget — to simulate a worker
 * reply we grab the handler it was called with and invoke it directly.
 */
import { renderHook, act } from '@testing-library/react';

jest.mock('../../src/state/IdeState', () => ({
  useIde: { getState: () => ({ showHitboxes: false, showActorInfo: false }) },
  useEditor: {
    getState: () => ({
      currentProjectId: 'proj-1',
      currentFile: 'main.py',
      project: { files: { 'main.py': 'print(1)' } },
      changeFile: jest.fn(),
    }),
  },
  isExampleSessionId: () => false,
}));

import { useRunnerStore, useRunner, getWorker, runOnce, runGenerator, runReference, runChecker } from '../../src/runner/RunnerProvider';
import { mockWorkerInstance } from './__mocks__/workerFactory';

function lastHandler(): (e: { data: unknown }) => void {
  const calls = (mockWorkerInstance.addEventListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][1] as (e: { data: unknown }) => void;
}

beforeEach(() => {
  // jsdom does not implement URL.revokeObjectURL; clear()/stop() call it
  // when frameHistory is non-empty.
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = jest.fn();
  useRunnerStore.getState().clear();
  useRunnerStore.setState({ ready: false });
  jest.clearAllMocks();
});

describe('getWorker — singleton wiring', () => {
  it('assigns onmessage/onerror and posts the init command', () => {
    const w = getWorker();
    expect(w).toBe(mockWorkerInstance);
    expect(typeof mockWorkerInstance.onmessage).toBe('function');
    expect(typeof mockWorkerInstance.onerror).toBe('function');
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'init' }),
    );
  });

  it('a second call returns the cached worker without re-posting init', () => {
    getWorker();
    (mockWorkerInstance.postMessage as jest.Mock).mockClear();
    getWorker();
    expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled();
  });

  it('onmessage dispatches non-batched types straight to the store', () => {
    getWorker();
    mockWorkerInstance.onmessage!({ data: { type: 'ready' } } as MessageEvent);
    expect(useRunnerStore.getState().ready).toBe(true);
  });

  it('onmessage queues stdout/stderr instead of dispatching immediately', () => {
    getWorker();
    mockWorkerInstance.onmessage!({ data: { type: 'stdout', text: 'queued' } } as MessageEvent);
    // Not flushed yet — clear() flushes synchronously, so this proves the
    // batching path (not the direct dispatch path) handled it.
    expect(useRunnerStore.getState().output).toHaveLength(0);
    useRunnerStore.getState().clear();
    // clear() flushes the pending queue before resetting output — the flushed
    // line lands, then the reset wipes it. Assert output ends empty either way,
    // but that flushNow's cancel+batch path ran without throwing.
    expect(useRunnerStore.getState().output).toEqual([]);
  });

  it('onerror routes the worker crash through the error channel', () => {
    getWorker();
    mockWorkerInstance.onerror!({ message: 'boom' } as ErrorEvent);
    const out = useRunnerStore.getState().output;
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('error_card');
  });
});

describe('compete guard — shared onmessage suppression during runOnce', () => {
  it('suppresses stdout/start/result on the shared handler while a compete run is active', async () => {
    getWorker();
    const promise = runOnce('print(1)', '', 5000);

    // While the compete run is in flight, traffic through the *shared*
    // onmessage handler must not touch the IDE store (D5 guard).
    mockWorkerInstance.onmessage!({ data: { type: 'start', canvasActive: false } } as MessageEvent);
    mockWorkerInstance.onmessage!({ data: { type: 'stdout', text: 'leaked' } } as MessageEvent);
    expect(useRunnerStore.getState().running).toBe(false);
    expect(useRunnerStore.getState().output).toHaveLength(0);

    // Resolve runOnce via its own dedicated addEventListener handler.
    const handler = lastHandler();
    handler({ data: { type: 'stdout', text: 'hi\n' } });
    handler({ data: { type: 'result' } });
    const result = await promise;
    expect(result).toEqual({ stdout: 'hi\n', runtimeError: false, tle: false });

    // Guard lifted — shared handler processes messages normally again.
    mockWorkerInstance.onmessage!({ data: { type: 'ready' } } as MessageEvent);
    expect(useRunnerStore.getState().ready).toBe(true);
  });

  it('records runtimeError when a runtime_error precedes the result', async () => {
    getWorker();
    const promise = runOnce('1/0', '', 5000);
    const handler = lastHandler();
    handler({ data: { type: 'runtime_error' } });
    handler({ data: { type: 'result' } });
    const result = await promise;
    expect(result.runtimeError).toBe(true);
  });
});

describe('runGenerator / runReference / runChecker', () => {
  it('runGenerator resolves stdout on a matching generator_result', async () => {
    getWorker();
    const promise = runGenerator('print(tests)', 'slug-1');
    const handler = lastHandler();
    const cmd = (mockWorkerInstance.postMessage as jest.Mock).mock.calls.at(-1)![0] as { reqId: number };
    handler({ data: { type: 'generator_result', reqId: cmd.reqId, stdout: '[1,2,3]' } });
    await expect(promise).resolves.toEqual({ stdout: '[1,2,3]' });
  });

  it('runGenerator resolves an error string on generator_error', async () => {
    getWorker();
    const promise = runGenerator('bad code', 'slug-2');
    const cmd = (mockWorkerInstance.postMessage as jest.Mock).mock.calls.at(-1)![0] as { reqId: number };
    lastHandler()({ data: { type: 'generator_error', reqId: cmd.reqId, error: 'NameError' } });
    await expect(promise).resolves.toEqual({ stdout: '', error: 'NameError' });
  });

  it('runReference resolves the expected output', async () => {
    getWorker();
    const promise = runReference('def solve(): pass', '{}', 2000);
    const cmd = (mockWorkerInstance.postMessage as jest.Mock).mock.calls.at(-1)![0] as { reqId: number };
    lastHandler()({ data: { type: 'reference_result', reqId: cmd.reqId, expected: '42' } });
    await expect(promise).resolves.toEqual({ expected: '42' });
  });

  it('runReference resolves an error string on reference_error', async () => {
    getWorker();
    const promise = runReference('bad', '{}', 2000);
    const cmd = (mockWorkerInstance.postMessage as jest.Mock).mock.calls.at(-1)![0] as { reqId: number };
    lastHandler()({ data: { type: 'reference_error', reqId: cmd.reqId, error: 'boom' } });
    await expect(promise).resolves.toEqual({ expected: '', error: 'boom' });
  });

  it('runChecker resolves passed:true on checker_result', async () => {
    getWorker();
    const promise = runChecker('def check(): pass', null, 'out', 'expected');
    const cmd = (mockWorkerInstance.postMessage as jest.Mock).mock.calls.at(-1)![0] as { reqId: number };
    lastHandler()({ data: { type: 'checker_result', reqId: cmd.reqId, passed: true } });
    await expect(promise).resolves.toEqual({ passed: true });
  });

  it('runChecker resolves passed:false + error on checker_error', async () => {
    getWorker();
    const promise = runChecker('bad', null, 'out', 'expected');
    const cmd = (mockWorkerInstance.postMessage as jest.Mock).mock.calls.at(-1)![0] as { reqId: number };
    lastHandler()({ data: { type: 'checker_error', reqId: cmd.reqId, error: 'crashed' } });
    await expect(promise).resolves.toEqual({ passed: false, error: 'crashed' });
  });
});

describe('useRunner() — transport controls', () => {
  it('pause() sets paused and posts the pause command; no-ops if already paused', () => {
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.pause(); });
    expect(useRunnerStore.getState().paused).toBe(true);
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ cmd: 'pause' });

    (mockWorkerInstance.postMessage as jest.Mock).mockClear();
    act(() => { result.current.pause(); });
    expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled();
  });

  it('resume() clears paused, resets scrub, and posts resume; no-ops if not paused', () => {
    useRunnerStore.setState({ paused: true, scrubIndex: 2 });
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.resume(); });
    expect(useRunnerStore.getState().paused).toBe(false);
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ cmd: 'resume' });

    (mockWorkerInstance.postMessage as jest.Mock).mockClear();
    act(() => { result.current.resume(); });
    expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled();
  });

  it('step() posts the step command', () => {
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.step(); });
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ cmd: 'step' });
  });

  it('setGameSpeed() updates store speed and posts set_speed', () => {
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.setGameSpeed(4); });
    expect(useRunnerStore.getState().speed).toBe(4);
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ cmd: 'set_speed', divisor: 4 });
  });

  it('stepBack() is a no-op with empty frameHistory', () => {
    useRunnerStore.setState({ frameHistory: [], scrubIndex: null });
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.stepBack(); });
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
  });

  it('stepBack() moves scrubIndex one frame earlier from the end', () => {
    useRunnerStore.setState({
      frameHistory: [
        { frame: 0, url: 'a', watches: [] },
        { frame: 1, url: 'b', watches: [] },
        { frame: 2, url: 'c', watches: [] },
      ],
      scrubIndex: null,
    });
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.stepBack(); });
    expect(useRunnerStore.getState().scrubIndex).toBe(1);
  });

  it('stepFwd() is a no-op when scrubIndex is already null (live)', () => {
    useRunnerStore.setState({ scrubIndex: null });
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.stepFwd(); });
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
  });

  it('stepFwd() returns to live (null) when stepping past the last frame', () => {
    useRunnerStore.setState({
      frameHistory: [
        { frame: 0, url: 'a', watches: [] },
        { frame: 1, url: 'b', watches: [] },
      ],
      scrubIndex: 1,
    });
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.stepFwd(); });
    expect(useRunnerStore.getState().scrubIndex).toBeNull();
  });

  it('stepFwd() advances scrubIndex by one when not at the end', () => {
    useRunnerStore.setState({
      frameHistory: [
        { frame: 0, url: 'a', watches: [] },
        { frame: 1, url: 'b', watches: [] },
        { frame: 2, url: 'c', watches: [] },
      ],
      scrubIndex: 0,
    });
    const { result } = renderHook(() => useRunner());
    act(() => { result.current.stepFwd(); });
    expect(useRunnerStore.getState().scrubIndex).toBe(1);
  });
});

describe('respondToInput', () => {
  it('echoes the prompt+value into the transcript, clears inputPrompt, posts the response', () => {
    useRunnerStore.setState({ inputPrompt: 'Name? ' });
    useRunnerStore.getState().respondToInput('Ada');

    const s = useRunnerStore.getState();
    expect(s.inputPrompt).toBeNull();
    expect(s.output).toEqual([{ kind: 'input', prompt: 'Name? ', value: 'Ada' }]);
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ cmd: 'input_response', value: 'Ada' });
  });
});
