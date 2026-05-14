// Top-level App: composes Rail + side Panel + FileBar + Editor + Console + floating Canvas.
// Exposes the Tweaks panel for theme / language / running / panel / canvas dock.

const { useState: rUseState, useEffect: rUseEffect, useRef: rUseRef } = React;

function Pi3App() {
  const tweakDefaults = /*EDITMODE-BEGIN*/{
    "theme": "studio",
    "lang": "en",
    "panel": "projects",
    "running": true,
    "canvasDock": "br",
    "fontPair": "inter",
    "mode": "code",
    "showSettings": false
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(tweakDefaults);
  const baseTheme = PI3_THEMES[t.theme] || PI3_THEMES.studio;
  const font = PI3_FONTS[t.fontPair] || PI3_FONTS.inter;
  const theme = {
    ...baseTheme,
    fontUI: font.ui,
    fontMono: font.mono,
    weightUI: font.weightUI,
    weightHeader: font.weightHeader,
  };
  const lang = t.lang;
  const strs = PI3_STRINGS[lang];

  const [activePanel, setActivePanel] = rUseState(t.panel);
  rUseEffect(() => { setActivePanel(t.panel); }, [t.panel]);

  const [files] = rUseState(["main.py", "snake.py", "tiles.py", "world.py"]);
  const [currentFile, setCurrentFile] = rUseState("main.py");
  const dirty = ["main.py", "tiles.py"];

  // Animation frame counter for canvas
  const [frame, setFrame] = rUseState(0);
  rUseEffect(() => {
    if (!t.running) return;
    let raf;
    const tick = () => { setFrame(f => f + 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [t.running]);

  const showPanel = activePanel !== null && activePanel !== "none";

  const wrapperBg = theme.appBg;

  return (
    <div
      data-screen-label="pi3 IDE"
      style={{
        position: "fixed", inset: 0,
        background: wrapperBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, boxSizing: "border-box",
        fontFamily: theme.fontUI,
        color: theme.appTxt,
      }}>
      <div style={{
        width: "100%", height: "100%",
        maxWidth: 1480, maxHeight: 940,
        background: theme.surface,
        borderRadius: theme.radiusWindow,
        boxShadow: theme.shadowWindow,
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}>
        <Rail
          theme={theme}
          lang={lang}
          activePanel={activePanel}
          setPanel={(p) => { setActivePanel(p); setTweak("panel", p || "none"); }}
          running={t.running}
          onRunToggle={() => setTweak("running", !t.running)}
        />

        {showPanel && (
          <div style={{
            position: "absolute",
            top: 0, bottom: 0, left: 60,
            width: 320,
            background: theme.surfacePanel,
            display: "flex", flexDirection: "column",
            borderRight: `1px solid ${theme.panelBorder}`,
            boxShadow: "8px 0 28px rgba(0,0,0,0.28), 2px 0 6px rgba(0,0,0,0.10)",
            zIndex: 10,
          }}>
            {activePanel === "projects" && (
              <ProjectsPanel theme={theme} lang={lang} onClose={() => { setActivePanel(null); setTweak("panel", "none"); }} />
            )}
            {activePanel === "assets" && (
              <AssetsPanel theme={theme} lang={lang} onClose={() => { setActivePanel(null); setTweak("panel", "none"); }} />
            )}
            {activePanel === "settings" && (
              <SettingsPanel theme={theme} lang={lang} onClose={() => { setActivePanel(null); setTweak("panel", "none"); }} setLang={(l) => setTweak("lang", l)} />
            )}
          </div>
        )}

        {/* Main editor column */}
        <div style={{
          flex: 1, minWidth: 0,
          display: "flex", flexDirection: "column",
          background: theme.editorBg,
          position: "relative",
        }}>
          <FileBar
            theme={theme}
            lang={lang}
            files={files}
            currentFile={currentFile}
            onFile={setCurrentFile}
            dirty={dirty}
          />
          {t.mode === "sprite" ? (
            <SpriteEditor theme={theme} lang={lang} />
          ) : (
            <>
              <CodeEditor theme={theme} lang={lang} />
              <ConsoleStrip theme={theme} lang={lang} running={t.running} />
              <CanvasWindow
                theme={theme}
                lang={lang}
                running={t.running}
                frame={frame}
                dock={t.canvasDock}
                onClose={() => setTweak("running", false)}
              />
            </>
          )}
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Palette"
            value={t.theme}
            onChange={v => setTweak("theme", v)}
            options={[
              { value: "studio", label: "Studio" },
              { value: "midnight", label: "Midnight" },
              { value: "daylight", label: "Daylight" },
            ]}
          />
          <TweakRadio
            label="Language"
            value={t.lang}
            onChange={v => setTweak("lang", v)}
            options={[
              { value: "en", label: "EN" },
              { value: "ru", label: "RU" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Typography">
          <TweakSelect
            label="Font pair"
            value={t.fontPair}
            onChange={v => setTweak("fontPair", v)}
            options={[
              { value: "inter",  label: "Inter Tight + JetBrains" },
              { value: "ibm",    label: "IBM Plex (sans + mono)" },
              { value: "geist",  label: "Geist + Geist Mono" },
              { value: "space",  label: "Space Grotesk + Mono" },
              { value: "jbsans", label: "JetBrains Mono only" },
              { value: "system", label: "System UI + ui-mono" },
            ]}
          />
        </TweakSection>
        <TweakSection label="State">
          <TweakRadio
            label="Editor mode"
            value={t.mode}
            onChange={v => setTweak("mode", v)}
            options={[
              { value: "code", label: "Code" },
              { value: "sprite", label: "Sprite" },
            ]}
          />
          <TweakSelect
            label="Side panel"
            value={t.panel}
            onChange={v => { setTweak("panel", v); setActivePanel(v === "none" ? null : v); }}
            options={[
              { value: "projects", label: "Projects" },
              { value: "assets", label: "Assets" },
              { value: "settings", label: "Settings" },
              { value: "none", label: "Hidden" },
            ]}
          />
          <TweakToggle
            label="Program running"
            value={t.running}
            onChange={v => setTweak("running", v)}
          />
          <TweakRadio
            label="Canvas dock"
            value={t.canvasDock}
            onChange={v => setTweak("canvasDock", v)}
            options={[
              { value: "br", label: "↘" },
              { value: "tr", label: "↗" },
              { value: "bl", label: "↙" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

window.Pi3App = Pi3App;
