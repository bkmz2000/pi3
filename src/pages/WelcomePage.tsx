import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import spiralCode from './welcome/code/spiral.py.txt?raw';
import matplotlibCode from './welcome/code/matplotlib.py.txt?raw';
import cubeCode from './welcome/code/cube.py.txt?raw';
import binarySearchCode from './welcome/code/binary_search.py.txt?raw';
import flappyCode from './welcome/code/flappy.py.txt?raw';
import snakeCode from './welcome/code/snake.py.txt?raw';
import asteroidsCode from './welcome/code/asteroids.py.txt?raw';

const CSS = `
.welcome-root {
  --bg: #e9e3d3;
  --card: #fffaf0;
  --ink: #0a3d44;
  --ink-mute: #4a6b6f;
  --teal: #0e9aa7;
  --code-bg: #0a3d44;
  --code-fg: #d7ece9;
  position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: var(--bg); color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
}
.welcome-root, .welcome-root * { box-sizing: border-box; }

.welcome-root .topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 40px; border-bottom: 1px solid rgba(10,61,68,0.12);
}
.welcome-root .wordmark { font-weight: 800; font-size: 18px; letter-spacing: 0.01em; }
.welcome-root .lang-toggle {
  font-size: 13px; color: var(--ink-mute);
  font-family: 'JetBrains Mono', monospace;
  background: none; border: none; padding: 4px 8px; cursor: pointer;
}
.welcome-root .lang-toggle:hover { color: var(--ink); }

.welcome-root section { max-width: 1040px; margin: 0 auto; padding: 56px 40px; }
.welcome-root section + section { border-top: 1px solid rgba(10,61,68,0.1); }

.welcome-root .hero { text-align: center; padding-top: 60px; }
.welcome-root .hero h1 { font-size: 34px; font-weight: 800; margin: 0 0 14px 0; line-height: 1.25; }
.welcome-root .hero .sub { font-size: 15px; color: var(--ink-mute); max-width: 540px; margin: 0 auto 40px; line-height: 1.5; }

.welcome-root .cols { display: flex; gap: 20px; align-items: stretch; text-align: left; margin-bottom: 24px; }
.welcome-root .col { flex: 1; background: var(--card); border: 1px solid rgba(10,61,68,0.15); border-radius: 2px; overflow: hidden; }
.welcome-root .col-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); padding: 10px 16px; border-bottom: 1px solid rgba(10,61,68,0.1); }
.welcome-root .code-col pre { margin: 0; padding: 16px; background: var(--code-bg); color: var(--code-fg); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; line-height: 1.55; overflow-x: auto; overflow-y: auto; max-height: 460px; }
.welcome-root .canvas-col { display: flex; align-items: center; justify-content: center; padding: 16px; background: #0a1414; }
.welcome-root .canvas-col img { max-width: 100%; height: auto; display: block; }

.welcome-root .caption { font-size: 13.5px; color: var(--ink-mute); text-align: center; margin-bottom: 32px; }

.welcome-root .cta { background: var(--teal); color: var(--card); border: none; border-radius: 2px; padding: 12px 32px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
.welcome-root .cta:hover { background: #0c8792; }
.welcome-root .cta-center { text-align: center; margin-top: 8px; }

.welcome-root h2 { font-size: 20px; font-weight: 800; margin: 0 0 8px 0; }
.welcome-root .section-lead { font-size: 14.5px; color: var(--ink-mute); margin: 0 0 28px 0; line-height: 1.6; max-width: 620px; }

.welcome-root .cards { display: flex; flex-direction: column; gap: 16px; }
.welcome-root .card { background: var(--card); border: 1px solid rgba(10,61,68,0.15); border-radius: 2px; padding: 20px; }
.welcome-root .card h3 { font-size: 15px; margin: 0 0 8px 0; }
.welcome-root .card p { font-size: 13.5px; color: var(--ink-mute); margin: 0; line-height: 1.5; }

.welcome-root ul.bullets { margin: 0; padding: 0; list-style: none; }
.welcome-root ul.bullets li { font-size: 14px; line-height: 1.6; padding-left: 20px; position: relative; margin-bottom: 10px; }
.welcome-root ul.bullets li::before { content: "—"; position: absolute; left: 0; color: var(--teal); }

.welcome-root .tabs { display: flex; gap: 8px; margin-bottom: 0; border-bottom: 1px solid rgba(10,61,68,0.15); }
.welcome-root .tab {
  background: none; border: none; border-bottom: 2px solid transparent;
  padding: 10px 4px; margin-bottom: -1px; font-family: inherit; font-size: 14px;
  font-weight: 600; color: var(--ink-mute); cursor: pointer;
}
.welcome-root .tab.active { color: var(--ink); border-bottom-color: var(--teal); }
.welcome-root .tab + .tab { margin-left: 16px; }
.welcome-root .tab-panel {
  background: var(--card); border: 1px solid rgba(10,61,68,0.15); border-top: none;
  border-radius: 0 0 2px 2px; padding: 20px;
}
.welcome-root .tab-grid { display: flex; gap: 20px; align-items: flex-start; }
.welcome-root .tab-visual { order: 2; flex: 0 0 260px; background: #0a1414; border-radius: 2px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.welcome-root .tab-visual img { max-width: 100%; height: auto; display: block; border-radius: 2px; }
.welcome-root .tab-code { order: 1; flex: 1; }
.welcome-root .tab-code h3 { font-size: 15px; margin: 0 0 8px 0; }
.welcome-root .tab-code p { font-size: 13.5px; color: var(--ink-mute); margin: 0; line-height: 1.5; }
.welcome-root .tab-code pre { margin: 12px 0 0 0; padding: 12px; background: var(--code-bg); color: var(--code-fg); font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5; border-radius: 2px; overflow-x: auto; max-height: 340px; overflow-y: auto; }

.welcome-root .debug-array { display: flex; gap: 3px; flex-wrap: wrap; max-width: 230px; }
.welcome-root .debug-cell {
  width: 21px; height: 21px; display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 8.5px; font-weight: 700;
  border-radius: 2px; color: #0a1414;
}
.welcome-root .debug-cell.muted { background: #3a5a5a; color: #d7ece9; }
.welcome-root .debug-cell.red { background: #d97a5a; }
.welcome-root .debug-cell.green { background: #7ec98f; }
.welcome-root .debug-legend { margin-top: 12px; font-size: 11px; color: #9fc4c0; font-family: 'JetBrains Mono', monospace; }
.welcome-root .debug-controls { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.welcome-root .debug-controls button {
  background: #11444b; color: #d7ece9; border: 1px solid rgba(215,236,233,0.2);
  border-radius: 2px; width: 32px; height: 28px; font-family: inherit; font-size: 12px; cursor: pointer;
}
.welcome-root .debug-controls button:hover { background: #145159; }
.welcome-root .debug-frame-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #9fc4c0; margin-left: 4px; }

.welcome-root .sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin: 0 2px; vertical-align: middle; }
.welcome-root .sw.red { background: #d97a5a; }
.welcome-root .sw.green { background: #7ec98f; }

.welcome-root .classroom-panel {
  display: flex; margin-top: 28px; border: 1px solid rgba(10,61,68,0.15);
  border-radius: 2px; overflow: hidden; height: 400px;
}
.welcome-root .roster {
  display: flex; flex-direction: column; flex: 0 0 240px; width: 240px;
  overflow-y: auto; border-right: 1px solid rgba(10,61,68,0.15); background: var(--card);
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

.welcome-root .student-detail { flex: 1; background: #0a1414; display: flex; flex-direction: column; overflow: hidden; }
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
  .welcome-root .cols { flex-direction: column; }
  .welcome-root .hero h1 { font-size: 26px; }
  .welcome-root .tab-grid { flex-direction: column; }
  .welcome-root .tab-visual { flex: 1 1 auto; width: 100%; }
  .welcome-root .classroom-panel { flex-direction: column; height: auto; }
  .welcome-root .roster { flex: none; width: 100%; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid rgba(10,61,68,0.15); }
  .welcome-root .student-card { flex: 0 0 auto; border-bottom: none; border-right: 1px solid rgba(10,61,68,0.1); }
  .welcome-root .student-detail { height: 320px; }
}
`;

type StudentSlug = 'zara' | 'miguel' | 'priya' | 'ben';
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
    slug: 'zara', name: 'Zara', initial: 'Z', color: '#0e9aa7',
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
    slug: 'miguel', name: 'Miguel', initial: 'M', color: '#f6a560',
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
    slug: 'priya', name: 'Priya', initial: 'P', color: '#7ec98f',
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
    slug: 'ben', name: 'Ben', initial: 'B', color: '#d97a5a',
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
  return (
    <>
      <div className="debug-array">
        {DEBUG_ARR.map((val, i) => {
          const cls = i === f.mid ? 'green' : (i >= f.lo && i <= f.hi ? 'red' : 'muted');
          return <div key={i} className={`debug-cell ${cls}`}>{val}</div>;
        })}
      </div>
      <div className="debug-legend">
        <span className="sw red" /> search window &nbsp; <span className="sw green" /> mid
      </div>
      <div className="debug-controls">
        <button onClick={() => step(-1)} title="Previous frame">◀</button>
        <button onClick={() => setPlaying((p) => !p)} title="Play / pause">{playing ? '⏸' : '▶'}</button>
        <button onClick={() => step(1)} title="Next frame">▶|</button>
        <span className="debug-frame-label">Frame {frame + 1} / {DEBUG_FRAMES.length}</span>
      </div>
    </>
  );
}

type TabKey = 'debug' | 'flappy' | 'snake' | 'asteroids';

function WhatStudentsBuild() {
  const [tab, setTab] = useState<TabKey>('debug');
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'debug', label: 'Debugging' },
    { key: 'flappy', label: 'Flappy Bird' },
    { key: 'snake', label: 'Snake' },
    { key: 'asteroids', label: 'Asteroids' },
  ];

  return (
    <section>
      <h2>What students build</h2>
      <p className="section-lead">
        Structured thinking still comes first — loops, variables, functions. The examples below are where that's visible.
      </p>

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`welcome-panel-${t.key}`}
            id={`welcome-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'debug' && (
        <div className="tab-panel" role="tabpanel" id="welcome-panel-debug" aria-labelledby="welcome-tab-debug">
          <div className="tab-grid">
            <div className="tab-visual"><DebugScrubber /></div>
            <div className="tab-code">
              <h3>Debugging you can watch</h3>
              <p>Every call captures a frame — the search window in red, the midpoint in green — building a scrubbable timeline instead of scattered print statements.</p>
              <pre><code>{binarySearchCode}</code></pre>
            </div>
          </div>
        </div>
      )}
      {tab === 'flappy' && (
        <div className="tab-panel" role="tabpanel" id="welcome-panel-flappy" aria-labelledby="welcome-tab-flappy">
          <div className="tab-grid">
            <div className="tab-visual"><img src="/welcome/panel-flappy.png" alt="Flappy Bird baked render" /></div>
            <div className="tab-code">
              <h3>Flappy Bird, made of primitives</h3>
              <p>No sprites at all here — just <code>circle()</code> and <code>rect()</code>, gravity, and a flap. This is what a kid can build in one sitting once loops and state click.</p>
              <pre><code>{flappyCode}</code></pre>
            </div>
          </div>
        </div>
      )}
      {tab === 'snake' && (
        <div className="tab-panel" role="tabpanel" id="welcome-panel-snake" aria-labelledby="welcome-tab-snake">
          <div className="tab-grid">
            <div className="tab-visual"><img src="/welcome/panel-snake.png" alt="Snake baked render" /></div>
            <div className="tab-code">
              <h3>Snake, with real pixel art</h3>
              <p>Four actual sprites — head, body, tail, food — built pixel by pixel with <code>create_sprite</code> and <code>set_pixel</code>, then drawn with <code>image()</code>.</p>
              <pre><code>{snakeCode}</code></pre>
            </div>
          </div>
        </div>
      )}
      {tab === 'asteroids' && (
        <div className="tab-panel" role="tabpanel" id="welcome-panel-asteroids" aria-labelledby="welcome-tab-asteroids">
          <div className="tab-grid">
            <div className="tab-visual"><img src="/welcome/panel-asteroids.png" alt="Asteroids baked render" /></div>
            <div className="tab-code">
              <h3>Asteroids, with sprites and gravity</h3>
              <p>A ship sprite that actually rotates (<code>push</code>/<code>translate</code>/<code>rotate</code>), drifting asteroid sprites, and a real downward pull the player has to fight with thrust.</p>
              <pre><code>{asteroidsCode}</code></pre>
            </div>
          </div>
        </div>
      )}

      <div className="cards" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Real Python</h3>
          <p><code>input</code>, <code>random</code>, <code>turtle</code> — the same language as a local install.</p>
        </div>
        <div className="card">
          <h3>A real ecosystem</h3>
          <p><code>numpy</code>, <code>pygame</code>, and more, importable and running.</p>
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
      <h2>Run a class of 26 without leaving your desk.</h2>
      <ul className="bullets">
        <li>Watch every student's progress update live, from your own screen — no walking the room, no thirty open tabs</li>
        <li>See who's stuck without singling them out — the dashboard tells you quietly, you don't have to ask in front of everyone</li>
        <li>Pull verdicts across the whole class at a glance instead of opening each project one at a time</li>
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

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="hero">
      <h1>Real Python. Right next to what it draws.</h1>
      <div className="sub">
        This is real Python — the same language, not a simplified version of it.
      </div>

      <div className="cols">
        <div className="col code-col">
          <div className="col-label">FIG. II — source</div>
          <pre><code>{spiralCode}</code></pre>
        </div>
        <div className="col canvas-col">
          <img src="/welcome/hero-spiral.svg" alt="pi3 signature spiral render" />
        </div>
      </div>
      <div className="caption">Every point in that array is a real coordinate along the pi3 signature — rendered here by the same graphics library students use.</div>

      <div className="cols">
        <div className="col code-col">
          <div className="col-label">FIG. III — matplotlib, already working</div>
          <pre><code>{matplotlibCode}</code></pre>
        </div>
        <div className="col canvas-col">
          <img src="/welcome/hero-matplotlib.png" alt="matplotlib render" />
        </div>
      </div>
      <div className="caption">This is already working reliably — not a mockup, an actual matplotlib render.</div>

      <div className="cols" style={{ marginTop: 8 }}>
        <div className="col code-col">
          <div className="col-label">FIG. IV — numpy + 2D primitives, already working</div>
          <pre><code>{cubeCode}</code></pre>
        </div>
        <div className="col canvas-col">
          <img src="/welcome/hero-cube.svg" alt="numpy 3D cube render" />
        </div>
      </div>
      <div className="caption">This is already working reliably — numpy does the rotation math, the same 2D line() draws it.</div>

      <div className="cta-center"><button className="cta" onClick={onStart}>Start free</button></div>
    </section>
  );
}

export function WelcomePage() {
  const navigate = useNavigate();
  const onStart = useCallback(() => navigate('/'), [navigate]);

  return (
    <div className="welcome-root">
      <style>{CSS}</style>
      <TopBar />
      <Hero onStart={onStart} />
      <WhatStudentsBuild />
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
          <li>No personal information collected — student logins are generated, not signed up</li>
          <li>In-class messaging can't carry contact info, by design</li>
          <li>If a parent asks "is this safe" — tell them: no student ever gives us their name, email, or any way to be found online</li>
          <li>Something wrong? Fast takedown, no bureaucracy</li>
        </ul>
      </section>

      <section>
        <h2>Install it. Freeze it. Nothing to break.</h2>
        <p className="section-lead" style={{ marginBottom: 0 }}>
          pi3 installs like an app — no browser tab required. Once installed, it runs fully offline, and you choose when it updates. A lesson plan built around pi3 in September still works exactly the same way in May.
        </p>
      </section>

      <section className="footer-cta">
        <h2>Start free</h2>
        <button className="cta" onClick={onStart}>Start free</button>
      </section>
    </div>
  );
}
