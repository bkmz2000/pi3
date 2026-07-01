// express-async-errors is imported in server/index.ts for production and is
// automatically patched when route files import express. No setup needed here.

if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
      }
      return new Uint8Array(bytes);
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(bytes) {
      if (bytes instanceof Uint8Array) {
        return String.fromCharCode.apply(null, Array.from(bytes));
      }
      return String(bytes);
    }
  };
}

global.DB_PATH = ':memory:';
