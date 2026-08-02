// A plain (non-graphics) script is executed by indenting it into
// `async def __run():` so that input() can suspend. Python forbids
// `from x import *` inside a function body, so a program that opens with
// `from math import *` — perfectly legal at module level — died with
// "SyntaxError: import * only allowed at module level" before its first line
// ran. The star-imports are lifted back out to module level, where they bind
// into globals that the wrapper body reads anyway.

// Column 0 only: a star-import that is already indented sits inside some
// function in the user's own code, where Python rejects it either way.
const STAR_IMPORT = /^from\s+[A-Za-z_][\w.]*\s+import\s+\*\s*$/;

export interface HoistedSource {
  /** Star-import statements, to be emitted at module level. */
  prelude: string;
  /** The rest of the program, with each hoisted line blanked out. */
  body: string;
}

/**
 * Split top-level `from x import *` statements out of `source`.
 *
 * Hoisted lines are replaced by empty ones rather than dropped, so line
 * numbers in the remaining body still match what the student sees.
 */
export function hoistStarImports(source: string): HoistedSource {
  const prelude: string[] = [];
  const body = source.split("\n").map((line) => {
    if (!STAR_IMPORT.test(line)) return line;
    prelude.push(line);
    return "";
  });
  return { prelude: prelude.join("\n"), body: body.join("\n") };
}
