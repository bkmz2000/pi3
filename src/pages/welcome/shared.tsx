import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// Colors mirror the Studio editor theme (src/state/useTheme.ts) so any public
// marketing page (landing, examples gallery) reads as the same product: cream
// editor surface, dark canvas, teal accent. Shared between WelcomePage and
// ExamplesGalleryPage — both mount a `.welcome-root` div and inject this CSS.
export const WELCOME_CSS = `
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
  box-shadow: 0 1px 2px rgba(10,61,68,0.12); text-decoration: none; display: inline-block;
}
.welcome-root .cta:hover { background: #0c8792; }
.welcome-root .cta-center { text-align: center; margin-top: 28px; }

.welcome-root .browse-link { display: inline-block; margin-top: 14px; font-size: 13.5px; color: var(--ink-mute); text-decoration: underline; background: none; border: none; font-family: inherit; cursor: pointer; }
.welcome-root .browse-link:hover { color: var(--ink); }

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

export function TopBar() {
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

export function IconOpen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}
