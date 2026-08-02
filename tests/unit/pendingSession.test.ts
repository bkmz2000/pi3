import { capturePendingSessionToken, takePendingSessionToken, joinLink } from '../../src/state/pendingSession';

// jsdom starts every test at http://localhost/; put the page back where the
// link would have landed and let capture() do its work from there.
function landOn(url: string) {
  history.replaceState(null, '', url);
}

describe('pendingSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    landOn('/ide');
  });

  it('lifts the token out of the fragment and parks it', () => {
    landOn('/ide#session=abc.def');
    capturePendingSessionToken();
    expect(takePendingSessionToken()).toBe('abc.def');
  });

  it('strips the token from the URL so it is not left in history', () => {
    landOn('/ide?x=1#session=abc.def');
    capturePendingSessionToken();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/ide?x=1');
  });

  it('survives a route change between capture and claim (landing page → IDE)', () => {
    landOn('/#session=tok-123');
    capturePendingSessionToken();
    landOn('/ide'); // the fragment is gone, the parked token is not
    expect(takePendingSessionToken()).toBe('tok-123');
  });

  it('url-decodes the token', () => {
    landOn('/ide#session=a%2Bb%2Fc');
    capturePendingSessionToken();
    expect(takePendingSessionToken()).toBe('a+b/c');
  });

  it('claims the token only once', () => {
    landOn('/ide#session=one-shot');
    capturePendingSessionToken();
    expect(takePendingSessionToken()).toBe('one-shot');
    expect(takePendingSessionToken()).toBeNull();
  });

  it('does nothing without a session fragment', () => {
    landOn('/ide#settings');
    capturePendingSessionToken();
    expect(takePendingSessionToken()).toBeNull();
    expect(window.location.hash).toBe('#settings');
  });

  it('joinLink() targets /ide — the root is the landing page under the public profile', () => {
    expect(joinLink('a+b/c')).toBe('http://localhost/ide#session=a%2Bb%2Fc');
  });

  it('a link built by joinLink() round-trips through capture/claim', () => {
    const link = joinLink('round.trip');
    landOn(link.slice(link.indexOf('/ide')));
    capturePendingSessionToken();
    expect(takePendingSessionToken()).toBe('round.trip');
  });

  it('ignores a malformed token instead of throwing', () => {
    landOn('/ide#session=%E0%A4%A');
    expect(() => capturePendingSessionToken()).not.toThrow();
    expect(takePendingSessionToken()).toBeNull();
  });

  it('degrades quietly when storage is unavailable', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    landOn('/ide#session=blocked');
    expect(() => capturePendingSessionToken()).not.toThrow();
    setItem.mockRestore();
    expect(takePendingSessionToken()).toBeNull();
  });
});
