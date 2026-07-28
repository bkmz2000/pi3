import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import { foldGutter, codeFolding } from '@codemirror/language';

import { useEditor } from '../state/IdeState';

import spiralCode from './welcome/code/spiral.py.txt?raw';
import matplotlibCode from './welcome/code/matplotlib.py.txt?raw';
import cubeCode from './welcome/code/cube.py.txt?raw';
import binarySearchCode from './welcome/code/binary_search.py.txt?raw';
import flappyCode from './welcome/code/flappy.py.txt?raw';
import snakeCode from './welcome/code/snake.py.txt?raw';
import asteroidsCode from './welcome/code/asteroids.py.txt?raw';

// Colors mirror the Studio editor theme (src/state/useTheme.ts) so the landing
// reads as the same product: cream editor surface, dark canvas, teal accent.
const CSS = `
.welcome-root {
  --bg: #e9e3d3;
  --card: #fffaf0;
  --ink: #1f2933;
  --ink-mute: #5b6976;
  --teal: #0e9aa7;
  --border: rgba(20,30,40,0.12);
  --code-bg: #fffaf0;
  --code-fg: #1f2933;
  --canvas-bg: #072428;
  position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: var(--bg); color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
}
.welcome-root, .welcome-root * { box-sizing: border-box; }

.welcome-root .topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 40px; border-bottom: 1px solid var(--border);
}
.welcome-root .wordmark { font-weight: 800; font-size: 18px; letter-spacing: 0.01em; }
.welcome-root .lang-toggle {
  font-size: 13px; color: var(--ink-mute);
  font-family: 'JetBrains Mono', monospace;
  background: none; border: none; padding: 4px 8px; cursor: pointer;
}
.welcome-root .lang-toggle:hover { color: var(--ink); }

.welcome-root section { max-width: 1440px; margin: 0 auto; padding: 56px 48px; }
.welcome-root section + section { border-top: 1px solid var(--border); }

.welcome-root .hero { text-align: center; padding-top: 60px; }
.welcome-root .hero h1 { font-size: 40px; font-weight: 800; margin: 0 0 14px 0; line-height: 1.2; }
.welcome-root .hero .sub { font-size: 16px; color: var(--ink-mute); max-width: 560px; margin: 0 auto 40px; line-height: 1.5; }

.welcome-root .caption { font-size: 13.5px; color: var(--ink-mute); text-align: center; margin-bottom: 32px; }

.welcome-root .cta {
  background: var(--teal); color: #fffaf0; border: none; border-radius: 3px;
  padding: 13px 34px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
  box-shadow: 0 1px 2px rgba(10,61,68,0.12);
}
.welcome-root .cta:hover { background: #0c8792; }
.welcome-root .cta-center { text-align: center; margin-top: 28px; }

.welcome-root h2 { font-size: 20px; font-weight: 800; margin: 0 0 8px 0; }
.welcome-root .section-lead { font-size: 14.5px; color: var(--ink-mute); margin: 0 0 28px 0; line-height: 1.6; max-width: 620px; }

.welcome-root .cards { display: flex; flex-direction: column; gap: 16px; }
.welcome-root .card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 20px; }
.welcome-root .card h3 { font-size: 15px; margin: 0 0 8px 0; }
.welcome-root .card p { font-size: 13.5px; color: var(--ink-mute); margin: 0; line-height: 1.5; }

.welcome-root ul.bullets { margin: 0; padding: 0; list-style: none; }
.welcome-root ul.bullets li { font-size: 14px; line-height: 1.6; padding-left: 20px; position: relative; margin-bottom: 10px; }
.welcome-root ul.bullets li::before { content: "—"; position: absolute; left: 0; color: var(--teal); }

.welcome-root .tabs { display: flex; gap: 8px; margin-bottom: 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.welcome-root .tab {
  background: none; border: none; border-bottom: 2px solid transparent;
  padding: 10px 4px; margin-bottom: -1px; font-family: inherit; font-size: 14px;
  font-weight: 600; color: var(--ink-mute); cursor: pointer;
}
.welcome-root .tab.active { color: var(--ink); border-bottom-color: var(--teal); }
.welcome-root .tab + .tab { margin-left: 16px; }
.welcome-root .tab-panel {
  background: var(--card); border: 1px solid var(--border); border-top: none;
  border-radius: 0 0 4px 4px; padding: 20px;
}
.welcome-root .tab-grid { display: flex; gap: 20px; align-items: stretch; }
.welcome-root .tab-visual { order: 2; flex: 0 0 380px; overflow: hidden; background: var(--canvas-bg); border-radius: 3px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.welcome-root .tab-visual img { max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; border-radius: 2px; }
.welcome-root .tab-code { order: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; }
.welcome-root .tab-code h3 { font-size: 15px; margin: 0 0 8px 0; }
.welcome-root .tab-code p { font-size: 13.5px; color: var(--ink-mute); margin: 0; line-height: 1.5; }

.welcome-root .debug-panel { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
.welcome-root .debug-array { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; max-width: 100%; }
.welcome-root .debug-cell {
  width: 21px; height: 21px; display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 8.5px; font-weight: 700;
  border-radius: 2px; color: #0a1414;
}
.welcome-root .debug-cell.muted { background: #3a5a5a; color: #d7ece9; }
.welcome-root .debug-cell.red { background: #d97a5a; }
.welcome-root .debug-cell.green { background: #7ec98f; }
.welcome-root .debug-cell.stroke-blue { box-shadow: inset 0 0 0 2px #7ba5d4; }
.welcome-root .debug-legend {
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
  font-size: 11px; color: #9fc4c0; font-family: 'JetBrains Mono', monospace;
}
.welcome-root .debug-legend span { display: inline-flex; align-items: center; gap: 5px; }
.welcome-root .debug-timeline {
  position: relative; flex: 1; min-width: 160px; max-width: 260px; height: 18px; cursor: pointer;
  touch-action: none;
}
.welcome-root .debug-timeline .track {
  position: absolute; left: 0; right: 0; top: 7px; height: 4px;
  background: rgba(215,236,233,0.15); border-radius: 4px;
}
.welcome-root .debug-timeline .fill {
  position: absolute; left: 0; top: 7px; height: 4px;
  background: #7ec98f; border-radius: 4px;
}
.welcome-root .debug-timeline .tick {
  position: absolute; top: 7px; width: 4px; height: 4px; margin-left: -2px;
  border-radius: 4px;
}
.welcome-root .debug-timeline .thumb {
  position: absolute; top: 2px; width: 14px; height: 14px; margin-left: -7px;
  border-radius: 50%; background: #7ec98f; border: 2px solid #d7ece9;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.welcome-root .debug-timeline-row { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 320px; }
.welcome-root .debug-timeline-row .label {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #9fc4c0; min-width: 40px;
}
.welcome-root .debug-controls { display: flex; align-items: center; gap: 8px; justify-content: center; }
.welcome-root .debug-controls button {
  background: #11444b; color: #d7ece9; border: 1px solid rgba(215,236,233,0.2);
  border-radius: 2px; width: 32px; height: 28px; font-family: inherit; font-size: 12px;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.welcome-root .debug-controls button:hover { background: #145159; }
.welcome-root .debug-controls button[disabled] { opacity: 0.4; cursor: default; }

/* Faux IDE window: teal filebar + a cream filename tab, exactly like FileBar. */
.welcome-root .code-window {
  margin-top: 12px; border-radius: 4px; overflow: hidden;
  border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(10,61,68,0.10);
  display: flex; flex-direction: column;
}
.welcome-root .code-filebar {
  display: flex; align-items: flex-end; justify-content: space-between;
  height: 34px; padding: 0 8px; background: var(--teal);
}
.welcome-root .code-tab {
  display: inline-flex; align-items: center; height: 26px; padding: 0 14px;
  background: var(--code-bg); color: #0a3d44; border-radius: 3px 3px 0 0;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
}
.welcome-root .filebar-open {
  display: inline-flex; align-items: center; gap: 6px; align-self: center;
  margin: 0 2px 4px 0; background: #34a853; color: #fff; border: none;
  border-radius: 3px; padding: 5px 12px; font-size: 12px; font-weight: 700;
  font-family: inherit; cursor: pointer;
}
.welcome-root .filebar-open:hover { background: #2f9549; }
.welcome-root .filebar-open svg { width: 14px; height: 14px; }
.welcome-root .cm-shell { background: var(--code-bg); overflow: hidden; }
.welcome-root .cm-shell .cm-editor { background: transparent; }
.welcome-root .cm-shell .cm-editor.cm-focused { outline: none; }

.welcome-root .sw {
  display: inline-block; width: 9px; height: 9px; border-radius: 2px;
  vertical-align: middle;
}
.welcome-root .sw.red { background: #d97a5a; }
.welcome-root .sw.green { background: #7ec98f; }
.welcome-root .sw.stroke-blue { background: transparent; box-shadow: inset 0 0 0 1.5px #7ba5d4; }

.welcome-root .classroom-panel {
  display: flex; margin-top: 28px; border: 1px solid var(--border);
  border-radius: 4px; overflow: hidden; height: 400px;
}
.welcome-root .roster {
  display: flex; flex-direction: column; flex: 0 0 240px; width: 240px;
  overflow-y: auto; border-right: 1px solid var(--border); background: var(--card);
}
.welcome-root .student-card {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  cursor: pointer; border-bottom: 1px solid rgba(10,61,68,0.1);
  transition: background 0.15s;
}
.welcome-root .student-card:hover { background: rgba(14,154,167,0.08); }
.welcome-root .student-card.active { background: rgba(14,154,167,0.16); }
.welcome-root .student-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; color: #fffaf0; font-size: 14px;
}
.welcome-root .student-name { font-size: 13.5px; font-weight: 700; margin-bottom: 2px; }
.welcome-root .student-status {
  font-size: 11px; color: var(--ink-mute); font-family: 'JetBrains Mono', monospace;
  display: flex; align-items: center; gap: 5px;
}
.welcome-root .student-updated {
  font-size: 10px; color: var(--ink-mute); opacity: 0.7; margin-top: 2px;
}
.welcome-root .dot {
  width: 6px; height: 6px; border-radius: 50%; background: #7ec98f; flex-shrink: 0;
  animation: welcome-pulse 1.6s ease-in-out infinite;
}
@keyframes welcome-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

.welcome-root .student-detail { flex: 1; background: var(--canvas-bg); display: flex; flex-direction: column; overflow: hidden; }
.welcome-root .student-detail-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; flex: none;
  background: #11444b; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #d7ece9;
}
.welcome-root .student-detail-header .detail-name { font-weight: 700; }
.welcome-root .detail-file { color: #9fc4c0; flex: 1; }
.welcome-root .student-file-view {
  margin: 0; padding: 14px; color: #d7ece9; font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px; line-height: 1.6; flex: 1; overflow-y: auto;
}

.welcome-root .footer-cta { text-align: center; padding: 56px 40px 72px; }
.welcome-root .footer-cta h2 { margin-bottom: 20px; }

@media (max-width: 720px) {
  .welcome-root .hero h1 { font-size: 28px; }
  .welcome-root .tab-grid { flex-direction: column; }
  .welcome-root .tab-visual { flex: 1 1 auto; width: 100%; min-height: 260px; }
  .welcome-root .classroom-panel { flex-direction: column; height: auto; }
  .welcome-root .roster { flex: none; width: 100%; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--border); }
  .welcome-root .student-card { flex: 0 0 auto; border-bottom: none; border-right: 1px solid rgba(10,61,68,0.1); }
  .welcome-root .student-detail { height: 320px; }
}
`;

// Handles, not names — this is what the real teacher roster shows
// (userLabel() renders @handle whenever one exists, which is always).
type StudentSlug = 'fox' | 'koala' | 'heron' | 'gecko';
interface Student {
  slug: StudentSlug;
  name: string;
  initial: string;
  color: string;
  project: string;
  file: string;
  lines: string[];
}

const STUDENTS: Student[] = [
  {
    slug: 'fox', name: '@amberCleverFox', initial: 'A', color: '#0e9aa7',
    project: 'My Flappy Bird', file: 'flappy_bird.py',
    lines: [
      'from graphics import *',
      'import random',
      '',
      'size(320, 480)',
      '',
      'bird_y = 240',
      'bird_vy = 0',
      'GRAVITY = 0.5',
      'FLAP = -8',
      '',
      'def draw():',
      '    global bird_y, bird_vy',
      '    if Keyboard.space.pressed:',
      '        bird_vy = FLAP',
      '    bird_vy += GRAVITY',
      '    bird_y += bird_vy',
      '    fill(255, 220, 0)',
      '    circle(60, bird_y, 12)',
    ],
  },
  {
    slug: 'koala', name: '@jadeSleepyKoala', initial: 'J', color: '#f6a560',
    project: 'Snake Remix', file: 'snake.py',
    lines: [
      'from graphics import *',
      'import random',
      '',
      'size(400, 400)',
      'GRID = 20',
      'CELL = 20',
      '',
      'snake = [(10, 10), (9, 10)]',
      'direction = (1, 0)',
      '',
      'def draw():',
      '    global direction',
      '    hx, hy = snake[0]',
      '    new_head = (hx + direction[0], hy + direction[1])',
      '    snake.insert(0, new_head)',
      '    snake.pop()',
    ],
  },
  {
    slug: 'heron', name: '@coralPluckyHeron', initial: 'C', color: '#7ec98f',
    project: 'Asteroids v2', file: 'asteroids.py',
    lines: [
      'from graphics import *',
      'import math, random',
      '',
      'size(500, 500)',
      'ship_x, ship_y = 250, 250',
      'ship_angle = 0',
      'GRAVITY = 0.05',
      '',
      'def draw():',
      '    global ship_angle',
      '    if Keyboard.arrow_left.pressed:',
      '        ship_angle -= 4',
      '    if Keyboard.arrow_right.pressed:',
      '        ship_angle += 4',
      '    push()',
      '    rotate(math.radians(ship_angle))',
    ],
  },
  {
    slug: 'gecko', name: '@indigoNimbleGecko', initial: 'I', color: '#d97a5a',
    project: 'Search Practice', file: 'binary_search.py',
    lines: [
      'from pi3 import debug',
      '',
      'def binary_search(arr, target):',
      '    lo, hi = 0, len(arr) - 1',
      '    while lo <= hi:',
      '        mid = (lo + hi) // 2',
      '        debug.array(arr, red=debug.range(lo, hi), green=mid)',
      '        debug.show()',
      '        if arr[mid] == target:',
      '            return mid',
      '        elif arr[mid] < target:',
      '            lo = mid + 1',
      '        else:',
      '            hi = mid - 1',
      '    return -1',
    ],
  },
];

const DEBUG_ARR = [4, 17, 34, 50, 60, 61, 67, 95, 121, 122, 139, 140, 141, 142, 149, 152, 155, 156, 161, 184];
const DEBUG_FRAMES = [
  { lo: 0, hi: 19, mid: 9 },
  { lo: 10, hi: 19, mid: 14 },
  { lo: 10, hi: 13, mid: 11 },
  { lo: 12, hi: 13, mid: 12 },
  { lo: 13, hi: 13, mid: 13 },
];

// Trimmed display snippets — the *important part* of each program. The full,
// runnable source (the `full` field on each sample) is what "Open in editor"
// actually loads; these are just what's shown on the page.
const SPIRAL_SNIPPET = `from graphics import *
import cmath

path = [complex(x, y) for x, y in POINTS]  # 100 traced points

def dft(points, keep):
    ...  # decompose into epicycles

coeffs = dft(path, 15)

def draw():
    pos = complex(200, 200)
    for k, c in coeffs:
        prev = pos
        pos += c * cmath.exp(2j * cmath.pi * k * t / N)
        circle(prev.real, prev.imag, abs(c))
        line(prev.real, prev.imag, pos.real, pos.imag)

run(draw)
`;

const CUBE_SNIPPET = `from graphics import *
import numpy as np

vertices = np.array([...]) * 60      # 8 cube corners
edges = [(0, 1), (1, 2), ...]        # 12 edges

def rotate(v, ax, ay):
    rx = np.array([[1, 0, 0],
                   [0, np.cos(ax), -np.sin(ax)],
                   [0, np.sin(ax),  np.cos(ax)]])
    ry = np.array([[ np.cos(ay), 0, np.sin(ay)],
                   [0, 1, 0],
                   [-np.sin(ay), 0, np.cos(ay)]])
    return v @ rx.T @ ry.T

def draw():
    global angle
    rotated = rotate(vertices, angle, angle * 0.7)
    projected = rotated[:, :2] + 200
    for a, b in edges:
        line(*projected[a], *projected[b])
    angle += 0.02

run(draw)
`;

// Read-only CodeMirror block with Python syntax highlighting using the same
// githubLight theme + cream editor surface as the Studio IDE editor. Line
// numbers + fold gutter enabled; non-editing affordances disabled.
const CM_READONLY_EXT = [
  python(),
  codeFolding(),
  foldGutter(),
  EditorView.editable.of(false),
  EditorView.theme({
    // Match the Studio IDE editor: cream surface, #b6c2c8 line numbers.
    '&': { background: 'transparent', fontSize: '13px' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", lineHeight: '1.55' },
    '.cm-gutters': { background: 'transparent', border: 'none', color: '#b6c2c8' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 6px', minWidth: '2em' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer', color: '#9aa8ae' },
    '.cm-content': { padding: '14px 0' },
    '.cm-line': { padding: '0 12px' },
    '.cm-activeLine': { background: 'transparent' },
    '.cm-cursor': { display: 'none' },
  }),
];

function HighlightedCode({ source, file, onOpen }: { source: string; file: string; onOpen: () => void }) {
  const value = useMemo(() => source, [source]);
  return (
    <div className="code-window">
      <div className="code-filebar">
        <span className="code-tab">{file}</span>
        <button type="button" className="filebar-open" onClick={onOpen}>
          <IconOpen /> Open in editor
        </button>
      </div>
      <div className="cm-shell">
      <CodeMirror
        value={value}
        maxHeight="440px"
        extensions={CM_READONLY_EXT}
        theme={githubLight}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
          autocompletion: false,
          bracketMatching: false,
          closeBrackets: false,
          drawSelection: false,
          dropCursor: false,
          indentOnInput: false,
          allowMultipleSelections: false,
          rectangularSelection: false,
          crosshairCursor: false,
        }}
      />
      </div>
    </div>
  );
}

function IconStepBack() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  );
}
function IconStepFwd() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}
function IconOpen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}


function DebugTimeline({ current, total, onChange }: { current: number; total: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const posToFrame = (clientX: number): number => {
    const el = ref.current;
    if (!el || total <= 1) return 0;
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(t * (total - 1));
  };

  const pct = total <= 1 ? 0 : (current / (total - 1)) * 100;

  return (
    <div
      ref={ref}
      className="debug-timeline"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onChange(posToFrame(e.clientX));
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        onChange(posToFrame(e.clientX));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }}
    >
      <div className="track" />
      <div className="fill" style={{ width: `${pct}%` }} />
      {Array.from({ length: total }).map((_, i) => {
        const t = total <= 1 ? 0 : (i / (total - 1)) * 100;
        return (
          <div
            key={i}
            className="tick"
            style={{ left: `${t}%`, background: i <= current ? '#7ec98f' : 'rgba(215,236,233,0.3)' }}
          />
        );
      })}
      <div className="thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}

function DebugScrubber() {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % DEBUG_FRAMES.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [playing]);

  const step = (dir: number) => {
    setPlaying(false);
    setFrame((f) => Math.max(0, Math.min(DEBUG_FRAMES.length - 1, f + dir)));
  };

  const f = DEBUG_FRAMES[frame];
  const atEnd = frame >= DEBUG_FRAMES.length - 1;

  return (
    <div className="debug-panel">
      <div className="debug-array">
        {DEBUG_ARR.map((val, i) => {
          const inWindow = i >= f.lo && i <= f.hi;
          const isMid = i === f.mid;
          const isEndpoint = i === f.lo || i === f.hi;
          const fillCls = isMid ? 'green' : (inWindow ? 'red' : 'muted');
          const strokeCls = isEndpoint ? 'stroke-blue' : '';
          return <div key={i} className={`debug-cell ${fillCls} ${strokeCls}`}>{val}</div>;
        })}
      </div>
      <div className="debug-legend">
        <span><span className="sw red" /> search window</span>
        <span><span className="sw green" /> mid</span>
        <span><span className="sw stroke-blue" /> lo, hi</span>
      </div>
      <div className="debug-timeline-row">
        <DebugTimeline
          current={frame}
          total={DEBUG_FRAMES.length}
          onChange={(n) => { setPlaying(false); setFrame(n); }}
        />
        <span className="label">{frame + 1} / {DEBUG_FRAMES.length}</span>
      </div>
      <div className="debug-controls">
        <button onClick={() => step(-1)} disabled={frame === 0} title="Previous frame"><IconStepBack /></button>
        <button
          onClick={() => {
            if (atEnd) setFrame(0);
            setPlaying((p) => !p);
          }}
          title="Play / pause"
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button onClick={() => step(1)} disabled={atEnd} title="Next frame"><IconStepFwd /></button>
      </div>
    </div>
  );
}

// A single tabbed showcase: visual on the right, trimmed code + open button on
// the left. Shared by the hero and the "What students build" section.
interface Sample {
  key: string;
  label: string;
  heading: string;
  blurb: React.ReactNode;
  visual: React.ReactNode;
  snippet: string;
  full: string;
  file: string;
}

function SampleShowcase({ samples, openProject, initial }: { samples: Sample[]; openProject: (file: string, source: string) => void; initial?: string }) {
  const [tab, setTab] = useState<string>(initial ?? samples[0].key);
  const active = samples.find((s) => s.key === tab) ?? samples[0];

  return (
    <>
      <div className="tabs" role="tablist">
        {samples.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`tab ${tab === s.key ? 'active' : ''}`}
            onClick={() => setTab(s.key)}
            role="tab"
            aria-selected={tab === s.key}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel">
        <div className="tab-grid">
          <div className="tab-visual">
            {active.visual}
          </div>
          <div className="tab-code">
            <h3>{active.heading}</h3>
            <p>{active.blurb}</p>
            <HighlightedCode source={active.snippet} file={active.file} onOpen={() => openProject(active.file, active.full)} />
          </div>
        </div>
      </div>
    </>
  );
}

function WhatStudentsBuild({ openProject }: { openProject: (file: string, source: string) => void }) {
  const samples: Sample[] = [
    {
      key: 'debug', label: 'Debugging', file: 'binary_search.py',
      heading: 'Debugging you can watch',
      blurb: "Every call captures a frame — the search window in red, the midpoint in green — building a scrubbable timeline instead of scattered print statements.",
      visual: <DebugScrubber />,
      snippet: binarySearchCode, full: binarySearchCode,
    },
    {
      key: 'flappy', label: 'Flappy Bird', file: 'flappy.py',
      heading: 'Flappy Bird, made of primitives',
      blurb: <>No sprites at all here — just <code>circle()</code> and <code>rect()</code>, gravity, and a flap. This is what a kid can build in one sitting once loops and state click.</>,
      visual: <img src="/welcome/panel-flappy.png" alt="Flappy Bird baked render" />,
      snippet: flappyCode, full: flappyCode,
    },
    {
      key: 'snake', label: 'Snake', file: 'snake.py',
      heading: 'Snake, with real pixel art',
      blurb: <>Four actual sprites — head, body, tail, food — built pixel by pixel with <code>create_sprite</code> and <code>set_pixel</code>, then drawn with <code>image()</code>.</>,
      visual: <img src="/welcome/panel-snake.png" alt="Snake baked render" />,
      snippet: snakeCode, full: snakeCode,
    },
    {
      key: 'asteroids', label: 'Asteroids', file: 'asteroids.py',
      heading: 'Asteroids, with sprites and gravity',
      blurb: <>A ship sprite that actually rotates (<code>push</code>/<code>translate</code>/<code>rotate</code>), drifting asteroid sprites, and a real downward pull the player has to fight with thrust.</>,
      visual: <img src="/welcome/panel-asteroids.png" alt="Asteroids baked render" />,
      snippet: asteroidsCode, full: asteroidsCode,
    },
  ];

  return (
    <section>
      <h2>What students build</h2>
      <p className="section-lead">
        Structured thinking still comes first — loops, variables, functions. The examples below are where that's visible.
      </p>

      <SampleShowcase samples={samples} openProject={openProject} />

      <div className="cards" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Real Python</h3>
          <p><code>input</code>, <code>random</code>, <code>turtle</code> — the same language as a local install.</p>
        </div>
        <div className="card">
          <h3>A real ecosystem</h3>
          <p><code>numpy</code>, <code>matplotlib</code>, and the rest of the scientific stack, importable and running.</p>
        </div>
      </div>
    </section>
  );
}

function Classroom() {
  const [lineCounts, setLineCounts] = useState<number[]>(() => STUDENTS.map(() => 1));
  const [lastUpdated, setLastUpdated] = useState<number[]>(() => STUDENTS.map(() => Date.now()));
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [detailLines, setDetailLines] = useState<number>(3);
  const [now, setNow] = useState<number>(() => Date.now());
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  // per-card tickers (staggered)
  useEffect(() => {
    const ids = STUDENTS.map((_, idx) =>
      window.setInterval(() => {
        setLineCounts((prev) => {
          const next = [...prev];
          next[idx] = (next[idx] % STUDENTS[idx].lines.length) + 1;
          return next;
        });
        setLastUpdated((prev) => {
          const next = [...prev];
          next[idx] = Date.now();
          return next;
        });
      }, 2200 + idx * 300)
    );
    return () => ids.forEach((id) => window.clearInterval(id));
  }, []);

  // detail advance
  useEffect(() => {
    setDetailLines(Math.max(3, lineCounts[activeIdx]));
    const id = window.setInterval(() => {
      const i = activeIdxRef.current;
      const total = STUDENTS[i].lines.length;
      setDetailLines((d) => (d % total) + 1);
      setLastUpdated((prev) => {
        const next = [...prev];
        next[i] = Date.now();
        return next;
      });
    }, 2000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  // ago clock
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeStudent = STUDENTS[activeIdx];

  return (
    <section>
      <h2>Run the room without leaving your desk.</h2>
      <ul className="bullets">
        <li>Watch every student in the group update live, from your own screen — who's on which file, which line, how long since they last typed</li>
        <li>Open any student's code as they type it, without leaning over their shoulder or asking them to share anything</li>
        <li>A student stuck on something raises a hand from inside the editor — it lands in your queue quietly, with no announcement to the room</li>
      </ul>

      <div className="classroom-panel">
        <div className="roster">
          {STUDENTS.map((s, idx) => {
            const secs = Math.max(0, Math.round((now - lastUpdated[idx]) / 1000));
            const ago = secs <= 1 ? 'updated just now' : `updated ${secs}s ago`;
            return (
              <div
                key={s.slug}
                className={`student-card ${activeIdx === idx ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={activeIdx === idx}
                onClick={() => setActiveIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIdx(idx);
                  }
                }}
              >
                <div className="student-avatar" style={{ background: s.color }}>{s.initial}</div>
                <div className="student-info">
                  <div className="student-name">{s.name}</div>
                  <div className="student-status">
                    <span className="dot" /> {s.file} — line {lineCounts[idx]}
                  </div>
                  <div className="student-updated">{ago}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="student-detail">
          <div className="student-detail-header">
            <span className="detail-name">{activeStudent.name}</span>
            <span className="detail-file">{activeStudent.project} · {activeStudent.file}</span>
          </div>
          <pre className="student-file-view">
            <code>{activeStudent.lines.slice(0, detailLines).join('\n')}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function TopBar() {
  const { i18n, t } = useTranslation();
  const toggleLang = useCallback(() => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  }, [i18n]);
  return (
    <div className="topbar">
      <div className="wordmark">pi3</div>
      <button className="lang-toggle" onClick={toggleLang}>
        {i18n.language === 'ru' ? t('welcome.language.en') : t('welcome.language.ru')}
      </button>
    </div>
  );
}

function Hero({ onStart, openProject }: { onStart: () => void; openProject: (file: string, source: string) => void }) {
  const samples: Sample[] = [
    {
      key: 'spiral', label: 'Fourier spiral', file: 'spiral.py',
      heading: 'Real Python, right next to what it draws',
      blurb: 'A discrete Fourier transform turns the pi3 signature into rotating circles — and the same graphics library students use renders every frame.',
      visual: <img src="/welcome/hero-spiral.svg" alt="pi3 signature spiral render" />,
      snippet: SPIRAL_SNIPPET, full: spiralCode,
    },
    {
      key: 'matplotlib', label: 'matplotlib', file: 'plot.py',
      heading: 'matplotlib, already working',
      blurb: 'Not a mockup — an actual matplotlib render, running in the browser with nothing to install.',
      visual: <img src="/welcome/hero-matplotlib.png" alt="matplotlib render" />,
      snippet: matplotlibCode, full: matplotlibCode,
    },
    {
      key: 'cube', label: '3D cube', file: 'cube.py',
      heading: 'numpy does the math, 2D primitives draw it',
      blurb: <>numpy rotates the cube in 3D; the same <code>line()</code> students use projects it onto the screen.</>,
      visual: <img src="/welcome/hero-cube.svg" alt="numpy 3D cube render" />,
      snippet: CUBE_SNIPPET, full: cubeCode,
    },
  ];

  return (
    <section className="hero">
      <h1>Real Python. Right next to what it draws.</h1>
      <div className="sub">
        This is real Python — the same language, not a simplified version of it.
      </div>

      <div style={{ textAlign: 'left' }}>
        <SampleShowcase samples={samples} openProject={openProject} />
      </div>

      <div className="cta-center"><button className="cta" onClick={onStart}>Start free</button></div>
    </section>
  );
}

export function WelcomePage() {
  const navigate = useNavigate();
  const onStart = useCallback(() => navigate('/ide'), [navigate]);

  // Load a sample straight into the editor as a fresh, unsaved playground and
  // jump to the IDE. currentProjectId stays null so first edit forks it like
  // any built-in example.
  const openProject = useCallback((file: string, source: string) => {
    useEditor.getState().changeCurrentProject(
      { files: { [file]: source }, assets: {}, tilemaps: {} },
    );
    navigate('/ide');
  }, [navigate]);

  return (
    <div className="welcome-root">
      <style>{CSS}</style>
      <TopBar />
      <Hero onStart={onStart} openProject={openProject} />
      <WhatStudentsBuild openProject={openProject} />
      <Classroom />

      <section>
        <h2>Not a trial.</h2>
        <ul className="bullets">
          <li>Unlimited student projects, always free</li>
          <li>Up to 3 groups of 10 students, no card required</li>
          <li>Upgrade only if you outgrow that — never required to start</li>
        </ul>
      </section>

      <section>
        <h2>Built for a classroom, not an open platform.</h2>
        <ul className="bullets">
          <li>Students appear as a generated handle — <code>@amberCleverFox</code>, not a name</li>
          <li>There is no user directory and no search — you cannot look a student up, so neither can anyone else</li>
          <li>In-session messaging is eight fixed emoji. Not a filter that can be worked around — there is no free-text field to type a phone number into</li>
          <li>Sessions are joined by a signed link you hand to someone you know. No short codes, nothing shareable to strangers</li>
          <li>Shared work carries the code, not the author</li>
        </ul>
      </section>

      <section>
        <h2>Install it. Freeze it. Nothing to break.</h2>
        <p className="section-lead" style={{ marginBottom: 0 }}>
          pi3 installs like an app — no browser tab required. Once installed, Python and the whole graphics library keep working with the network down, and you choose when it updates: flip freeze on before a lesson and the version your class is using stays put. A lesson plan built around pi3 in September still works exactly the same way in May.
        </p>
      </section>

      <section className="footer-cta">
        <h2>Start free</h2>
        <button className="cta" onClick={onStart}>Start free</button>
      </section>
    </div>
  );
}
