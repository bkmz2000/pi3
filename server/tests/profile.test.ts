import { describe, it, expect, afterEach } from '@jest/globals';
import { getProfile } from '../profile.js';

afterEach(() => {
  delete process.env.DEPLOYMENT_PROFILE;
});

describe('profile — deployment profile seam', () => {
  it('defaults to public when env is unset', () => {
    delete process.env.DEPLOYMENT_PROFILE;
    const p = getProfile();
    expect(p.profile).toBe('public');
    expect(p.userSearch.mode).toBe('disabled_gone');
    expect(p.snapshotPublicIncludesAuthor).toBe(false);
    expect(p.commentsMode).toBe('emoji_only');
  });

  it('DEPLOYMENT_PROFILE=institutional opts in explicitly', () => {
    process.env.DEPLOYMENT_PROFILE = 'institutional';
    const p = getProfile();
    expect(p.profile).toBe('institutional');
    expect(p.userSearch.mode).toBe('teacher_directory');
  });

  it('DEPLOYMENT_PROFILE=public flips seam values', () => {
    process.env.DEPLOYMENT_PROFILE = 'public';
    const p = getProfile();
    expect(p.profile).toBe('public');
    expect(p.userSearch.mode).toBe('disabled_gone');
    expect(p.snapshotPublicIncludesAuthor).toBe(false);
    expect(p.commentsMode).toBe('emoji_only');
  });

  it('unknown value falls back to institutional', () => {
    process.env.DEPLOYMENT_PROFILE = 'lunar';
    const p = getProfile();
    expect(p.profile).toBe('institutional');
  });

  it('is case-insensitive and trims whitespace', () => {
    process.env.DEPLOYMENT_PROFILE = '  PUBLIC  ';
    const p = getProfile();
    expect(p.profile).toBe('public');
  });
});
