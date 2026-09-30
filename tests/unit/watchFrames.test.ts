import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const PYTHONPATH = resolve(__dirname, '../../src/assets/python');

it('emits one stale transition, preserves last frame, and resumes only on watch()', () => {
  const script = `
import json, sys, types
import graphics
from graphics import _state
packets = []
js = types.ModuleType('js')
js.Date = types.SimpleNamespace(now=lambda: 1000)
js._ide_post_watch_values = lambda payload: packets.append(json.loads(payload))
sys.modules['js'] = js

graphics.watch('tail', [1])
graphics._flush_watches(12)
assert packets[-1]['values'] == [{'label': 'tail', 'value': '[1]', 'fresh': True, 'lastFrame': 12}]

graphics._flush_watches(13)  # stale immediately, even inside the 100ms throttle
assert packets[-1]['values'] == [{'label': 'tail', 'value': '[1]', 'fresh': False, 'lastFrame': 12}]
assert len(packets) == 2
for frame in range(14, 100):
    graphics._flush_watches(frame)
assert len(packets) == 2  # no activity until watch() is called again

graphics.watch('tail', [2])
graphics._flush_watches(100)
assert packets[-1]['values'] == [{'label': 'tail', 'value': '[2]', 'fresh': True, 'lastFrame': 100}]
assert len(packets) == 3

graphics.watch('apple', 7)
graphics._flush_watches(101)
assert packets[-1]['values'] == [
    {'label': 'tail', 'value': '[2]', 'fresh': False, 'lastFrame': 100},
    {'label': 'apple', 'value': '7', 'fresh': True, 'lastFrame': 101},
]
assert len(packets) == 4
print('OK')
`;
  expect(execFileSync('python3', ['-c', script], {
    cwd: resolve(__dirname, '../..'),
    env: { ...process.env, PYTHONPATH },
    encoding: 'utf8',
  }).trim()).toBe('OK');
});
