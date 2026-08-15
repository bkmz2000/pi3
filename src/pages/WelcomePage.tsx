import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import { foldGutter, codeFolding } from '@codemirror/language';

import { useEditor } from '../state/IdeState';
import { SafeLink } from '../components/SafeLink';
import { usePointerScrub } from '../hooks/usePointerScrub';
import { WELCOME_CSS, TopBar, IconOpen } from './welcome/shared';

import spiralCode from './welcome/code/spiral.py.txt?raw';
import matplotlibCode from './welcome/code/matplotlib.py.txt?raw';
import cubeCode from './welcome/code/cube.py.txt?raw';
import binarySearchCode from './welcome/code/binary_search.py.txt?raw';
import flappyCode from './welcome/code/flappy.py.txt?raw';
import snakeCode from './welcome/code/snake.py.txt?raw';
import asteroidsCode from './welcome/code/asteroids.py.txt?raw';

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
      '        debug.array(arr, red=debug.between(lo, hi), green=mid)',
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
  const { t } = useTranslation();
  const value = useMemo(() => source, [source]);
  return (
    <div className="code-window">
      <div className="code-filebar">
        <span className="code-tab">{file}</span>
        <button type="button" className="filebar-open" onClick={onOpen}>
          <IconOpen /> {t('welcome.openInEditor')}
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
function DebugTimeline({ current, total, onChange }: { current: number; total: number; onChange: (n: number) => void }) {
  const { trackRef, onPointerDown, onPointerMove, onPointerUp } = usePointerScrub<HTMLDivElement>(total, onChange);

  const pct = total <= 1 ? 0 : (current / (total - 1)) * 100;

  return (
    <div
      ref={trackRef}
      className="debug-timeline"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
  const { t } = useTranslation();
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
        <span><span className="sw red" /> {t('welcome.debugDemo.searchWindow')}</span>
        <span><span className="sw green" /> {t('welcome.debugDemo.mid')}</span>
        <span><span className="sw stroke-blue" /> {t('welcome.debugDemo.loHi')}</span>
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
        <button onClick={() => step(-1)} disabled={frame === 0} title={t('frameControls.previousFrame')}><IconStepBack /></button>
        <button
          onClick={() => {
            if (atEnd) setFrame(0);
            setPlaying((p) => !p);
          }}
          title={t('frameControls.playPause')}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button onClick={() => step(1)} disabled={atEnd} title={t('frameControls.nextFrame')}><IconStepFwd /></button>
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
  const { t } = useTranslation();
  const samples: Sample[] = [
    {
      key: 'debug', label: t('welcome.build.samples.debug.label'), file: 'binary_search.py',
      heading: t('welcome.build.samples.debug.heading'),
      blurb: t('welcome.build.samples.debug.blurb'),
      visual: <DebugScrubber />,
      snippet: binarySearchCode, full: binarySearchCode,
    },
    {
      key: 'flappy', label: t('welcome.build.samples.flappy.label'), file: 'flappy.py',
      heading: t('welcome.build.samples.flappy.heading'),
      blurb: <>{t('welcome.build.samples.flappy.blurbPre')}<code>circle()</code>{t('welcome.build.samples.flappy.blurbAnd')}<code>rect()</code>{t('welcome.build.samples.flappy.blurbPost')}</>,
      visual: <img src="/welcome/panel-flappy.png" alt="Flappy Bird baked render" />,
      snippet: flappyCode, full: flappyCode,
    },
    {
      key: 'snake', label: t('welcome.build.samples.snake.label'), file: 'snake.py',
      heading: t('welcome.build.samples.snake.heading'),
      blurb: <>{t('welcome.build.samples.snake.blurbPre')}<code>create_sprite</code>{t('welcome.build.samples.snake.blurbAnd')}<code>set_pixel</code>{t('welcome.build.samples.snake.blurbMid')}<code>image()</code>{t('welcome.build.samples.snake.blurbPost')}</>,
      visual: <img src="/welcome/panel-snake.png" alt="Snake baked render" />,
      snippet: snakeCode, full: snakeCode,
    },
    {
      key: 'asteroids', label: t('welcome.build.samples.asteroids.label'), file: 'asteroids.py',
      heading: t('welcome.build.samples.asteroids.heading'),
      blurb: <>{t('welcome.build.samples.asteroids.blurbPre')}<code>push</code>/<code>translate</code>/<code>rotate</code>{t('welcome.build.samples.asteroids.blurbPost')}</>,
      visual: <img src="/welcome/panel-asteroids.png" alt="Asteroids baked render" />,
      snippet: asteroidsCode, full: asteroidsCode,
    },
  ];

  return (
    <section>
      <h2>{t('welcome.build.heading')}</h2>
      <p className="section-lead">
        {t('welcome.build.lead')}
      </p>

      <SampleShowcase samples={samples} openProject={openProject} />

      <div className="cards" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>{t('welcome.build.cardPythonTitle')}</h3>
          <p><code>input</code>, <code>random</code>, <code>turtle</code>{t('welcome.build.cardPythonText')}</p>
        </div>
        <div className="card">
          <h3>{t('welcome.build.cardEcosystemTitle')}</h3>
          <p><code>numpy</code>{t('welcome.build.cardEcosystemText')}</p>
        </div>
      </div>
    </section>
  );
}

function Classroom() {
  const { t } = useTranslation();
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
      <h2>{t('welcome.classroom.heading')}</h2>
      <ul className="bullets">
        <li>{t('welcome.classroom.bullet1')}</li>
        <li>{t('welcome.classroom.bullet2')}</li>
        <li>{t('welcome.classroom.bullet3')}</li>
      </ul>

      <div className="classroom-panel">
        <div className="roster">
          {STUDENTS.map((s, idx) => {
            const secs = Math.max(0, Math.round((now - lastUpdated[idx]) / 1000));
            const ago = secs <= 1 ? t('welcome.classroom.updatedJustNow') : t('welcome.classroom.updatedSecondsAgo', { count: secs });
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
                    <span className="dot" /> {s.file} — {t('welcome.classroom.lineLabel', { n: lineCounts[idx] })}
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

function Hero({ onStart, openProject }: { onStart: () => void; openProject: (file: string, source: string) => void }) {
  const { t } = useTranslation();
  const samples: Sample[] = [
    {
      key: 'spiral', label: t('welcome.hero.samples.spiral.label'), file: 'spiral.py',
      heading: t('welcome.hero.samples.spiral.heading'),
      blurb: t('welcome.hero.samples.spiral.blurb'),
      visual: <img src="/welcome/hero-spiral.svg" alt="pi3 signature spiral render" />,
      snippet: SPIRAL_SNIPPET, full: spiralCode,
    },
    {
      key: 'matplotlib', label: t('welcome.hero.samples.matplotlib.label'), file: 'plot.py',
      heading: t('welcome.hero.samples.matplotlib.heading'),
      blurb: t('welcome.hero.samples.matplotlib.blurb'),
      visual: <img src="/welcome/hero-matplotlib.png" alt="matplotlib render" />,
      snippet: matplotlibCode, full: matplotlibCode,
    },
    {
      key: 'cube', label: t('welcome.hero.samples.cube.label'), file: 'cube.py',
      heading: t('welcome.hero.samples.cube.heading'),
      blurb: <>{t('welcome.hero.samples.cube.blurbPre')}<code>line()</code>{t('welcome.hero.samples.cube.blurbPost')}</>,
      visual: <img src="/welcome/hero-cube.svg" alt="numpy 3D cube render" />,
      snippet: CUBE_SNIPPET, full: cubeCode,
    },
  ];

  return (
    <section className="hero">
      <h1>{t('welcome.hero.title')}</h1>
      <div className="sub">
        {t('welcome.hero.subtitle')}
      </div>

      <div style={{ textAlign: 'left' }}>
        <SampleShowcase samples={samples} openProject={openProject} />
      </div>

      <div className="cta-center">
        <button className="cta" onClick={onStart}>{t('welcome.ctaStart')}</button>
        <div className="caption" style={{ marginTop: 10, marginBottom: 0 }}>{t('welcome.noAccount')}</div>
      </div>
    </section>
  );
}

export function WelcomePage() {
  const { t } = useTranslation();
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
      <style>{WELCOME_CSS}</style>
      <TopBar />
      <Classroom />
      <Hero onStart={onStart} openProject={openProject} />
      <WhatStudentsBuild openProject={openProject} />

      <section>
        <h2>{t('welcome.notTrial.heading')}</h2>
        <ul className="bullets">
          <li>{t('welcome.notTrial.bullet1')}</li>
          <li>{t('welcome.notTrial.bullet2')}</li>
          <li>{t('welcome.notTrial.bullet3')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('welcome.safety.heading')}</h2>
        <ul className="bullets">
          <li>{t('welcome.safety.bullet1')}</li>
          <li>{t('welcome.safety.bullet2')}</li>
          <li>{t('welcome.safety.bullet3')}</li>
          <li>{t('welcome.safety.bullet4')}</li>
          <li>{t('welcome.safety.bullet5')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('welcome.install.heading')}</h2>
        <p className="section-lead" style={{ marginBottom: 0 }}>
          {t('welcome.install.body')}
        </p>
      </section>

      <section>
        <h2>{t('welcome.footer.privacyHeading')}</h2>
        <p className="section-lead">{t('welcome.footer.privacyIntro')}</p>
        <ul className="bullets">
          <li>{t('welcome.footer.privacyBullet1')}</li>
          <li>{t('welcome.footer.privacyBullet2')}</li>
          <li>{t('welcome.footer.privacyBullet3')}</li>
          <li>{t('welcome.footer.privacyBullet4')}</li>
          <li>{t('welcome.footer.privacyBullet5')}</li>
        </ul>
        <p style={{ fontSize: 13.5, color: 'var(--ink-mute)' }}>
          {t('welcome.footer.contactLabel')}{' '}
          <SafeLink href={`mailto:${t('welcome.footer.contactEmail')}`}>{t('welcome.footer.contactEmail')}</SafeLink>
        </p>
      </section>

      <section className="footer-cta">
        <h2>{t('welcome.ctaStart')}</h2>
        <button className="cta" onClick={onStart}>{t('welcome.ctaStart')}</button>
        <div className="caption" style={{ marginTop: 12, marginBottom: 0 }}>{t('welcome.noAccount')}</div>
        <div>
          <button type="button" className="browse-link" onClick={() => navigate('/examples')}>
            {t('welcome.footer.browseExamples')}
          </button>
        </div>
      </section>
    </div>
  );
}
