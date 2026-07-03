#!/usr/bin/env node
/**
 * Seeds 3 sample problems that exercise the pi3.debug API.
 * Run once: node scripts/seed-debug-problems.mjs
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'pi3.db');
const db = new Database(dbPath);

// Ensure compete tables exist (idempotent)
for (const stmt of [
  `CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    starter_code TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS problem_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    tier INTEGER NOT NULL,
    is_visible INTEGER NOT NULL DEFAULT 0,
    ordinal INTEGER NOT NULL,
    input TEXT NOT NULL,
    expected TEXT NOT NULL,
    UNIQUE(problem_id, ordinal)
  )`,
]) {
  db.exec(stmt);
}

const PROBLEMS = [
  {
    slug: 'debug-binary-search',
    title: 'Binary Search',
    order_index: 100,
    statement: `## Binary Search

Given a **sorted** array of integers and a target value, find the 0-based index of the target using binary search. Print \`-1\` if the target is not present.

### Input

\`\`\`
N target
a1 a2 ... aN
\`\`\`

- \`1 ≤ N ≤ 10 000\`
- \`-10^9 ≤ aᵢ, target ≤ 10^9\`
- The array is sorted in ascending order.

### Output

A single integer: the 0-based index, or \`-1\`.

### Example

**Input**
\`\`\`
5 7
1 3 5 7 9
\`\`\`
**Output**
\`\`\`
3
\`\`\``,
    starter_code: `from pi3 import debug

n, target = map(int, input().split())
arr = list(map(int, input().split()))

left, right = 0, n - 1
result = -1

while left <= right:
    mid = (left + right) // 2
    # Highlight the active search window (green) and current mid (red)
    debug.array(arr, green=debug.range(left, right), red=mid)
    debug.show()
    if arr[mid] == target:
        result = mid
        break
    elif arr[mid] < target:
        left = mid + 1
    else:
        right = mid - 1

print(result)
`,
    tests: [
      { tier: 1, is_visible: true,  input: '5 7\n1 3 5 7 9',         expected: '3'  },
      { tier: 1, is_visible: true,  input: '4 2\n1 2 3 4',            expected: '1'  },
      { tier: 1, is_visible: false, input: '3 5\n1 3 7',              expected: '-1' },
      { tier: 2, is_visible: false, input: '1 1\n1',                  expected: '0'  },
      { tier: 2, is_visible: false, input: '6 10\n2 4 6 8 10 12',     expected: '4'  },
      { tier: 2, is_visible: false, input: '7 1\n1 2 3 4 5 6 7',      expected: '0'  },
      { tier: 3, is_visible: false, input: '7 7\n1 2 3 4 5 6 7',      expected: '6'  },
      { tier: 3, is_visible: false, input: '5 99\n10 20 30 40 50',    expected: '-1' },
    ],
  },

  {
    slug: 'debug-count-islands',
    title: 'Count Islands',
    order_index: 101,
    statement: `## Count Islands

Given a grid of \`#\` (land) and \`.\` (water), count the number of **islands**. An island is a maximal group of \`#\` cells connected horizontally or vertically.

### Input

\`\`\`
R C
row1
row2
...
\`\`\`

- \`1 ≤ R, C ≤ 50\`

### Output

A single integer: the number of islands.

### Example

**Input**
\`\`\`
3 4
##.#
..##
#...
\`\`\`
**Output**
\`\`\`
3
\`\`\``,
    starter_code: `from pi3 import debug
from collections import deque

rows, cols = map(int, input().split())
grid = [list(input()) for _ in range(rows)]
visited = [[False] * cols for _ in range(rows)]
count = 0

def bfs(r, c):
    q = deque([(r, c)])
    visited[r][c] = True
    while q:
        row, col = q.popleft()
        # Highlight the current cell (red) on each BFS step
        debug.grid(grid, red=debug.cell(row, col))
        debug.show()
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = row + dr, col + dc
            if 0 <= nr < rows and 0 <= nc < cols and not visited[nr][nc] and grid[nr][nc] == '#':
                visited[nr][nc] = True
                q.append((nr, nc))

for r in range(rows):
    for c in range(cols):
        if grid[r][c] == '#' and not visited[r][c]:
            count += 1
            bfs(r, c)

print(count)
`,
    tests: [
      // tier 1 – visible
      { tier: 1, is_visible: true,  input: '3 4\n##.#\n..##\n#...',    expected: '3' },
      { tier: 1, is_visible: true,  input: '2 3\n...\n...',             expected: '0' },
      { tier: 1, is_visible: false, input: '1 1\n#',                    expected: '1' },
      // tier 2
      { tier: 2, is_visible: false, input: '3 3\n###\n###\n###',        expected: '1' },
      { tier: 2, is_visible: false, input: '4 4\n#.#.\n.#.#\n#.#.\n.#.#', expected: '8' },
      // tier 3
      { tier: 3, is_visible: false, input: '5 5\n#...#\n#...#\n#####\n#...#\n#...#', expected: '1' },
      { tier: 3, is_visible: false, input: '3 5\n#.#.#\n.....\n#.#.#', expected: '5' },
    ],
  },

  {
    slug: 'debug-valid-parens',
    title: 'Valid Parentheses',
    order_index: 102,
    statement: `## Valid Parentheses

Given a string consisting of \`(\`, \`)\`, \`[\`, \`]\`, \`{\`, \`}\`, determine whether the brackets are balanced.

Print \`YES\` if they are balanced, \`NO\` otherwise.

### Input

A single non-empty string of bracket characters (length ≤ 10 000).

### Output

\`YES\` or \`NO\`.

### Example

**Input**
\`\`\`
({[]})
\`\`\`
**Output**
\`\`\`
YES
\`\`\``,
    starter_code: `from pi3 import debug

s = input().strip()
stack = []
pairs = {')': '(', ']': '[', '}': '{'}

for ch in s:
    if ch in '([{':
        stack.append(ch)
    elif ch in ')]}':
        if not stack or stack[-1] != pairs[ch]:
            debug.stack(stack, red=len(stack) - 1 if stack else 0)
            debug.show()
            print("NO")
            raise SystemExit
        stack.pop()
    # Snapshot the stack after every character
    debug.stack(stack)
    debug.show()

print("YES" if not stack else "NO")
`,
    tests: [
      // tier 1 – visible
      { tier: 1, is_visible: true,  input: '({[]})',      expected: 'YES' },
      { tier: 1, is_visible: true,  input: '([)]',        expected: 'NO'  },
      { tier: 1, is_visible: false, input: '{}[]()',      expected: 'YES' },
      // tier 2
      { tier: 2, is_visible: false, input: ')',           expected: 'NO'  },
      { tier: 2, is_visible: false, input: '(((',         expected: 'NO'  },
      { tier: 2, is_visible: false, input: '{[()()]}[]', expected: 'YES' },
      // tier 3
      { tier: 3, is_visible: false, input: '([]){()}[{}]', expected: 'YES' },
      { tier: 3, is_visible: false, input: '((())',         expected: 'NO'  },
    ],
  },
];

// ── Insert ────────────────────────────────────────────────────────────────────

const insertProblem = db.prepare(`
  INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by)
  VALUES (?, ?, ?, ?, ?, 'seed')
`);
const insertTest = db.prepare(`
  INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seed = db.transaction(() => {
  for (const p of PROBLEMS) {
    const existing = db.prepare('SELECT id FROM problems WHERE slug = ?').get(p.slug);
    if (existing) {
      console.log(`  skip  ${p.slug} (already exists)`);
      continue;
    }
    const { lastInsertRowid: problemId } = insertProblem.run(
      p.slug, p.title, p.statement, p.starter_code, p.order_index
    );
    // Sort tier asc, assign ordinals
    const sorted = [...p.tests].sort((a, b) => a.tier - b.tier);
    sorted.forEach((t, i) => {
      insertTest.run(problemId, t.tier, t.is_visible ? 1 : 0, i + 1, t.input, t.expected);
    });
    console.log(`  added  ${p.slug} (${p.tests.length} tests)`);
  }
});

seed();
console.log('Done.');
