// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const WS_RE = /\s+/g;

export class InputTooLongError extends Error {
  constructor(
    public field: string,
    public maxLen: number,
  ) {
    super(`${field} too long (max ${maxLen})`);
    this.name = 'InputTooLongError';
  }
}

/** Strip control chars (except \t \n \r), collapse whitespace to single space, trim, enforce max length. */
export function sanitizeText(input: unknown, opts: { maxLen: number; field: string }): string {
  if (typeof input !== 'string') return '';
  const s = input.replace(CONTROL_RE, '').replace(WS_RE, ' ').trim();
  if (s.length > opts.maxLen) {
    throw new InputTooLongError(opts.field, opts.maxLen);
  }
  return s;
}
