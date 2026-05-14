// Side panels (Projects / Assets / Settings) and the empty-canvas-running state.

function PanelHeader({ title, theme, onClose }) {
  return (
    <div style={{
      padding: "16px 20px 12px",
      borderBottom: `1px solid ${theme.panelBorder}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: theme.panelHeader,
    }}>
      <div style={{
        fontFamily: theme.fontUI,
        fontWeight: theme.weightHeader,
        fontSize: 17,
        color: theme.panelTxt,
      }}>{title}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          all: "unset", cursor: "pointer",
          width: 30, height: 30, borderRadius: 10,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: theme.panelTxtMute,
        }}
      >
        <PI3Icon name="close" size={18} color="currentColor" />
      </button>
    </div>
  );
}

function ExampleRow({ name, tag, icon, theme, current }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        all: "unset", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: theme.radiusButton,
        background: current ? theme.chip : (hover ? theme.chip : "transparent"),
        marginBottom: 2,
        width: "100%", boxSizing: "border-box",
        transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: current ? theme.accent + "22" : theme.chip,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: current ? theme.accent : theme.panelTxtMute, flex: "none",
      }}>
        <PI3Icon name={icon} size={20} color="currentColor" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100,
          color: theme.panelTxt, fontSize: 14, lineHeight: 1.2,
        }}>{name}</div>
        <div style={{
          fontFamily: theme.fontUI, fontSize: 11.5,
          color: theme.panelTxtMute, marginTop: 2,
          textTransform: "uppercase", letterSpacing: 0.5, fontWeight: theme.weightUI,
        }}>{tag}</div>
      </div>
      {current && (
        <span style={{
          padding: "3px 8px", borderRadius: 999,
          background: theme.successPill, color: theme.successPillTxt,
          fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, fontSize: 10.5,
          textTransform: "uppercase", letterSpacing: 0.6,
        }}>open</span>
      )}
    </button>
  );
}

function YourProjectRow({ name, note, dirty, theme }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: theme.radiusButton,
        background: hover ? theme.chip : "transparent",
        marginBottom: 2,
        transition: "background 0.15s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100,
          color: theme.panelTxt, fontSize: 14, lineHeight: 1.2,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {name}
          {dirty && <span style={{ width: 7, height: 7, borderRadius: 7, background: theme.tabDirty }} />}
        </div>
        <div style={{
          fontFamily: theme.fontUI, fontSize: 12,
          color: theme.panelTxtMute, marginTop: 2,
        }}>{note}</div>
      </div>
      <span style={{
        opacity: hover ? 1 : 0, transition: "opacity 0.15s",
        display: "inline-flex", gap: 4, color: theme.panelTxtMute,
      }}>
        <button type="button" style={{ all: "unset", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <PI3Icon name="export" size={16} color="currentColor" />
        </button>
        <button type="button" style={{ all: "unset", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <PI3Icon name="trash" size={16} color="currentColor" />
        </button>
      </span>
    </div>
  );
}

function ProjectsPanel({ theme, lang, onClose }) {
  const t = PI3_STRINGS[lang];
  const exIcons = ["check","cursor","ball","snake","puzzle","ship"];
  return (
    <>
      <PanelHeader title={t.panels.projects} theme={theme} onClose={onClose} />
      <div style={{ padding: "16px 16px 4px", overflowY: "auto", flex: 1 }}>
        <SectionLabel theme={theme}>{t.panels.examples}</SectionLabel>
        <div style={{ marginBottom: 18 }}>
          {t.examples.map((name, i) => (
            <ExampleRow
              key={name}
              name={name}
              tag={t.exampleTags[i]}
              icon={exIcons[i]}
              theme={theme}
              current={i === 2}
            />
          ))}
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8, paddingRight: 4,
        }}>
          <SectionLabel theme={theme} noPad>{t.panels.yourProjects}</SectionLabel>
          <div style={{ display: "flex", gap: 6 }}>
            <PanelButton theme={theme} icon="import">{t.panels.import}</PanelButton>
            <PanelButton theme={theme} icon="plus" primary>{t.panels.newProject}</PanelButton>
          </div>
        </div>
        <div>
          {t.yourProjects.map(p => (
            <YourProjectRow key={p.name} {...p} theme={theme} />
          ))}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children, theme, noPad }) {
  return (
    <div style={{
      fontFamily: theme.fontUI,
      fontWeight: theme.weightUI + 100,
      fontSize: 11.5,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: theme.panelTxtMute,
      marginBottom: 8,
      paddingLeft: noPad ? 0 : 4,
    }}>{children}</div>
  );
}

function PanelButton({ children, theme, icon, primary }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        all: "unset", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 28, padding: "0 12px",
        borderRadius: 999,
        fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, fontSize: 12.5,
        background: primary ? theme.runBg : theme.chip,
        color: primary ? theme.runTxt : theme.panelTxt,
        boxShadow: primary && hover ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
        transition: "box-shadow 0.15s",
      }}>
      {icon && <PI3Icon name={icon} size={14} color="currentColor" strokeWidth={2.2} />}
      {children}
    </button>
  );
}

// Tiny SVG sprite tile (matches the 6 sprite types pi3 ships with)
function SpriteTile({ kind, theme, selected }) {
  const [hover, setHover] = useState(false);
  const accent = selected ? theme.accent : theme.panelTxtMute;
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        aspectRatio: "1 / 1",
        background: theme.chip,
        borderRadius: theme.radiusCard,
        border: `2px solid ${selected ? theme.accent : "transparent"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        transition: "border-color 0.15s, transform 0.15s",
        transform: hover ? "translateY(-2px)" : "none",
        cursor: "pointer",
      }}
    >
      <SpriteArt kind={kind} theme={theme} selected={selected} />
    </div>
  );
}

function SpriteArt({ kind, theme }) {
  const c = theme.syn.func;
  const a = theme.accent;
  if (kind === "ship") return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <path d="M22 8 L30 32 L22 28 L14 32 Z" fill={c} />
    </svg>
  );
  if (kind === "rock") return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <path d="M14 12 L28 10 L34 18 L32 28 L22 34 L12 28 L10 18 Z" fill={a} opacity="0.85" />
    </svg>
  );
  if (kind === "apple") return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="24" r="10" fill={a} />
      <path d="M22 14 L24 10 L28 12" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
  if (kind === "box") return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="10" y="10" width="24" height="24" rx="3" fill={c} opacity="0.8" />
      <rect x="14" y="14" width="16" height="16" rx="2" stroke={a} strokeWidth="2" fill="none" />
    </svg>
  );
  if (kind === "tile") return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="8" y="8" width="12" height="12" rx="2" fill={c} opacity="0.7" />
      <rect x="24" y="8" width="12" height="12" rx="2" fill={a} opacity="0.7" />
      <rect x="8" y="24" width="12" height="12" rx="2" fill={a} opacity="0.7" />
      <rect x="24" y="24" width="12" height="12" rx="2" fill={c} opacity="0.7" />
    </svg>
  );
  if (kind === "star") return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <path d="M22 8 L25 18 L36 18 L27 24 L30 34 L22 28 L14 34 L17 24 L8 18 L19 18 Z" fill={a} />
    </svg>
  );
  return null;
}

function AssetsPanel({ theme, lang, onClose }) {
  const t = PI3_STRINGS[lang];
  return (
    <>
      <PanelHeader title={t.panels.assets} theme={theme} onClose={onClose} />
      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
        <SectionLabel theme={theme}>{t.panels.selectedAssets}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
          <SpriteTile kind="ship" theme={theme} selected />
          <SpriteTile kind="rock" theme={theme} selected />
          <SpriteTile kind="star" theme={theme} selected />
        </div>

        <SectionLabel theme={theme}>{t.panels.availableAssets}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <button type="button" style={{
            all: "unset", cursor: "pointer",
            aspectRatio: "1 / 1",
            border: `1.5px dashed ${theme.panelBorder}`,
            borderRadius: theme.radiusCard,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 4, color: theme.panelTxtMute, fontFamily: theme.fontUI,
            fontSize: 11, fontWeight: theme.weightUI,
          }}>
            <PI3Icon name="plus" size={20} color="currentColor" />
            {t.panels.newSprite}
          </button>
          <SpriteTile kind="apple" theme={theme} />
          <SpriteTile kind="box" theme={theme} />
          <SpriteTile kind="tile" theme={theme} />
          <SpriteTile kind="ship" theme={theme} />
          <SpriteTile kind="rock" theme={theme} />
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, hint, on, theme, accent }) {
  const [v, setV] = useState(on);
  return (
    <button type="button"
      onClick={() => setV(!v)}
      style={{
        all: "unset", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", marginBottom: 6,
        background: theme.chip, borderRadius: theme.radiusCard,
      }}>
      <div>
        <div style={{ fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, color: theme.panelTxt, fontSize: 14 }}>{label}</div>
        {hint && <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginTop: 2 }}>{hint}</div>}
      </div>
      <span style={{
        width: 40, height: 24, borderRadius: 999,
        background: v ? (accent || theme.runBg) : theme.panelBorder,
        position: "relative", transition: "background 0.18s", flex: "none",
      }}>
        <span style={{
          position: "absolute", top: 3, left: v ? 19 : 3,
          width: 18, height: 18, borderRadius: 999, background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 0.18s",
        }} />
      </span>
    </button>
  );
}

function SettingsPanel({ theme, lang, onClose, setLang }) {
  const t = PI3_STRINGS[lang];
  return (
    <>
      <PanelHeader title={t.panels.settings} theme={theme} onClose={onClose} />
      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
        <SectionLabel theme={theme}>Editor</SectionLabel>
        <ToggleRow label={t.panels.autoSave} hint={t.panels.autoSaveHint} on theme={theme} />
        <ToggleRow label="Word wrap" hint="Wrap long lines in the editor" on theme={theme} />
        <ToggleRow label={t.panels.vimMode} on={false} theme={theme} />
        <ToggleRow label="Show invisibles" hint="Spaces, tabs, line endings" on={false} theme={theme} />

        <div style={{ height: 4 }} />
        <SectionLabel theme={theme}>Runtime</SectionLabel>
        <ToggleRow label={t.panels.showHitboxes} hint={t.panels.showHitboxesHint} on={false} theme={theme} accent={theme.accent} />
        <ToggleRow label="Pause on error" hint="Stop the canvas when code throws" on theme={theme} />
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", marginBottom: 6,
          background: theme.chip, borderRadius: theme.radiusCard,
        }}>
          <div>
            <div style={{ fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, color: theme.panelTxt, fontSize: 14 }}>Target FPS</div>
            <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginTop: 2 }}>Frame rate cap for the canvas</div>
          </div>
          <div style={{
            display: "inline-flex", padding: 2, background: theme.editorBg,
            border: `1px solid ${theme.panelBorder}`, borderRadius: 2,
          }}>
            {[30, 60, 120].map(v => (
              <span key={v} style={{
                padding: "3px 9px", fontFamily: theme.fontMono, fontSize: 11.5,
                background: v === 60 ? theme.accent : "transparent",
                color: v === 60 ? "#fff" : theme.panelTxt,
                fontWeight: v === 60 ? theme.weightUI + 100 : theme.weightUI,
              }}>{v}</span>
            ))}
          </div>
        </div>

        <div style={{ height: 4 }} />
        <SectionLabel theme={theme}>{t.panels.language}</SectionLabel>
        <div style={{
          display: "inline-flex", padding: 3, borderRadius: 2,
          background: theme.chip,
        }}>
          {[["en", "English"], ["ru", "Русский"]].map(([k, v]) => (
            <button key={k} type="button"
              onClick={() => setLang && setLang(k)}
              style={{
                all: "unset", cursor: "pointer",
                padding: "6px 14px", borderRadius: 2,
                fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, fontSize: 13,
                background: lang === k ? theme.surfacePanel : "transparent",
                color: lang === k ? theme.panelTxt : theme.panelTxtMute,
              }}>{v}</button>
          ))}
        </div>

        <div style={{ height: 16 }} />
        <SectionLabel theme={theme}>Account</SectionLabel>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px",
          background: theme.chip, borderRadius: theme.radiusCard,
          marginBottom: 6,
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: 2,
            background: theme.accent, color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: theme.fontUI, fontWeight: 800, fontSize: 14,
          }}>L</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: theme.fontUI, fontWeight: theme.weightUI + 100, color: theme.panelTxt, fontSize: 14 }}>Lena Volkova</div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 11.5, color: theme.panelTxtMute, marginTop: 2 }}>lena@pi3.sys5.ru · 12 projects</div>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div style={{
          fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute,
          textAlign: "center", padding: "10px 0",
        }}>pi3 · v0.4.2 · build 218</div>
      </div>
    </>
  );
}

window.ProjectsPanel = ProjectsPanel;
window.AssetsPanel = AssetsPanel;
window.SettingsPanel = SettingsPanel;
