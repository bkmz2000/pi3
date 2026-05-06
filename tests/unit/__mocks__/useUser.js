const useUserMock = function() {
  return {
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    authState: 'logged_out',
  };
};

module.exports = { useUserMock };
module.exports.default = useUserMock;
