const apiMock = {
  setToken: vi.fn(),
  getToken: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

export { apiMock };
export default apiMock;
