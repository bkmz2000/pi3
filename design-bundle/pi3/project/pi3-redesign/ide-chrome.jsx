// Main IDE mock — one component, parameterised by theme + language.
// Renders the full pi3 layout: rail, file tabs, editor, console, floating canvas.

const { useState, useEffect, useRef } = React;

function Pi3Logo({ color, size = 28, weightBold = 800 }) {
  return (
    <div style={{
      fontFamily: "'Nunito', system-ui, sans-serif",
      fontWeight: weightBold,
      fontSize: size,
      color,
      lineHeight: 1,
      letterSpacing: -0.5,
      display: "inline-flex",
      alignItems: "flex-start",
    }}>
      pi<span style={{ fontSize: size * 0.6, marginLeft: 1, transform: "translateY(-2px)", display: "inline-block" }}>3</span>
    </div>
  );
}

function RailButton({ icon, label, active, onClick, theme, badge, big, accentBg }) {
  const [hover, setHover] = useState(false);
  const bg = accentBg
    ? accentBg
    : active
    ? theme.railActiveBg
    : hover
    ? theme.railHoverBg
    : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      aria-label={label}
      style={{
        all: "unset",
        cursor: "pointer",
        width: 44,
        height: 44,
        borderRadius: theme.radiusButton,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: active ? theme.railIconActive : theme.railIcon,
        position: "relative",
        transition: "background 0.15s, color 0.15s",
        boxShadow: "none",
      }}
    >
      <PI3Icon name={icon} size={big ? 22 : 21} color="currentColor" />
      {badge && (
        <span style={{
          position: "absolute", top: 6, right: 6,
          width: 7, height: 7, borderRadius: 7, background: theme.tabDirty,
        }} />
      )}
    </button>
  );
}

function Rail({ theme, lang, activePanel, setPanel, running, onRunToggle }) {
  const t = PI3_STRINGS[lang];
  return (
    <div style={{
      width: 60,
      flex: "none",
      background: theme.railBg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "14px 0 14px",
      gap: 8,
      borderTopLeftRadius: theme.radiusWindow,
      borderBottomLeftRadius: theme.radiusWindow,
    }}>
      <div style={{ marginBottom: 12 }}>
        <Pi3Logo color={theme.railLogo} size={26} weightBold={theme.weightHeader} />
      </div>

      <RailButton
        icon="folder" label={t.rail.projects}
        active={activePanel === "projects"}
        onClick={() => setPanel(activePanel === "projects" ? null : "projects")}
        theme={theme}
      />

      <div style={{ position: "relative", marginTop: 4, marginBottom: 4 }}>
        <button
          type="button"
          onClick={onRunToggle}
          aria-label={running ? t.rail.stop : t.rail.run}
          title={running ? t.stopHint : t.runHint}
          style={{
            all: "unset", cursor: "pointer",
            width: 44, height: 44, borderRadius: theme.radiusButton,
            background: running ? theme.stopBg : theme.runBg,
            color: theme.runTxt,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.1s",
          }}
        >
          <PI3Icon name={running ? "stop" : "play"} size={20} color="currentColor" />
        </button>
      </div>

      <RailButton
        icon="sparkle" label={t.rail.assets}
        active={activePanel === "assets"}
        onClick={() => setPanel(activePanel === "assets" ? null : "assets")}
        theme={theme}
      />

      <div style={{ flex: 1 }} />

      <RailButton
        icon="settings" label={t.rail.settings}
        active={activePanel === "settings"}
        onClick={() => setPanel(activePanel === "settings" ? null : "settings")}
        theme={theme}
      />
    </div>
  );
}

function FileTab({ name, active, dirty, theme, onClick, isPlus }) {
  const [hover, setHover] = useState(false);
  if (isPlus) {
    return (
      <button
        type="button"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onClick={onClick}
        style={{
          all: "unset", cursor: "pointer",
          height: 32, padding: "0 10px",
          background: hover ? theme.tabInactiveHover : theme.tabInactiveBg,
          color: theme.tabInactiveTxt,
          borderRadius: theme.radiusTab,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginRight: 2,
          transition: "background 0.15s",
        }}
        title="New file"
      >
        <PI3Icon name="plus" size={16} color="currentColor" strokeWidth={2.2} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        all: "unset", cursor: "pointer",
        height: active ? 38 : 32,
        padding: "0 14px",
        background: active ? theme.tabActiveBg : (hover ? theme.tabInactiveHover : theme.tabInactiveBg),
        color: active ? theme.tabActiveTxt : theme.tabInactiveTxt,
        borderRadius: theme.radiusTab,
        display: "inline-flex", alignItems: "center", gap: 8,
        marginRight: 4,
        fontFamily: theme.fontUI,
        fontWeight: active ? theme.weightUI + 100 : theme.weightUI,
        fontSize: 13.5,
        transition: "background 0.15s",
      }}
    >
      <span>{name}</span>
      {dirty && (
        <span style={{
          width: 7, height: 7, borderRadius: 7, background: theme.tabDirty,
          boxShadow: `0 0 0 2px ${active ? theme.tabActiveBg : theme.filebarBg}`,
        }} />
      )}
      {active && (
        <span
          aria-hidden
          style={{
            width: 18, height: 18, borderRadius: 6,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: theme.panelTxtMute, marginLeft: 2,
          }}
        >
          <PI3Icon name="close" size={12} color="currentColor" strokeWidth={2.2} />
        </span>
      )}
    </button>
  );
}

function FileBar({ theme, lang, files, currentFile, onFile, dirty }) {
  return (
    <div style={{
      height: 44,
      background: theme.filebarBg,
      display: "flex",
      alignItems: "flex-end",
      padding: "0 12px 0 16px",
      gap: 0,
    }}>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
        {files.map(f => (
          <FileTab
            key={f}
            name={f}
            active={f === currentFile}
            dirty={dirty.includes(f)}
            theme={theme}
            onClick={() => onFile(f)}
          />
        ))}
        <FileTab key="__plus" isPlus theme={theme} onClick={() => {}} />
      </div>
      <div style={{
        height: 28, padding: "0 12px",
        display: "inline-flex", alignItems: "center", gap: 8,
        borderRadius: 999,
        background: theme.tabInactiveBg,
        color: theme.tabInactiveTxt,
        fontFamily: theme.fontUI, fontWeight: theme.weightUI, fontSize: 12.5,
        marginBottom: 4,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 22,
          background: theme.accent, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 11,
        }}>L</span>
        Lena
      </div>
    </div>
  );
}

window.Pi3Logo = Pi3Logo;
window.Rail = Rail;
window.FileBar = FileBar;
