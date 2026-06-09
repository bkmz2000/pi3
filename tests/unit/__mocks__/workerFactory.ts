export const mockWorkerInstance = {
  postMessage: jest.fn(),
  terminate: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onmessage: null as ((e: MessageEvent) => void) | null,
  onerror: null as ((e: ErrorEvent) => void) | null,
};

export const createRunnerWorker = jest.fn(() => mockWorkerInstance as unknown as Worker);
