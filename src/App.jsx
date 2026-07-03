const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#0e9aa7",
  "density": 1,
  "darkMode": false
}/*EDITMODE-END*/;

// ── pi3 Design Tokens ────────────────────────────────────────────────────────
const T = {
  appBg:        "#e9e3d3",
  surface:      "#fbf6e9",
  panel:        "#fffaf0",
  panelHeader:  "#fdf3e1",
  chip:         "#f3ebd7",
  border:       "rgba(20,30,40,0.08)",
  borderStrong: "rgba(20,30,40,0.15)",

  txt:       "#1f2933",
  txtMute:   "#5b6976",
  txtFaint:  "#9aa6b2",

  teal:      "var(--ocd-tweak-accent-color)",
  tealDeep:  "#0a3d44",
  tealSoft:  "rgba(14,154,167,0.08)",
  tealLine:  "rgba(14,154,167,0.25)",

  amber:       "#d48c1a",
  amberSoft:   "rgba(212,140,26,0.10)",
  green:       "#0e7c52",
  greenSoft:   "rgba(14,124,82,0.10)",
  danger:      "#c4451c",
  dangerSoft:  "rgba(196,69,28,0.10)",

  fontUI:    "'Inter', system-ui, sans-serif",
  fontMono:  "'JetBrains Mono', ui-monospace, monospace",
  fontDisplay:"'Nunito', system-ui, sans-serif",

  rCard:   12,
  rBtn:    8,
  rPill:   999,
  rInput:  8,

  shadowCard:   "0 1px 0 rgba(20,30,40,0.04), 0 1px 3px rgba(20,30,40,0.06)",
  shadowPop:    "0 12px 32px -8px rgba(20,30,40,0.18), 0 2px 8px rgba(20,30,40,0.06)",
  shadowSticky: "0 4px 16px -4px rgba(20,30,40,0.10)",
};

// ── SVG Icons ────────────────────────────────────────────────────────────────
const I = {
  arrowLeft:  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  doc:        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  lines:      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>,
  code:       <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  checkSq:    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  check:      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  plus:       <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>,
  trash:      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  eye:        <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/></>,
  eyeOff:     <><path d="M17.94 17.94A10 10 0 0 1 12 19c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/><path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/></>,
  play:       <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>,
  zap:        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  preview:    <><rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M3 8h18" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="6" cy="6" r="0.8" fill="currentColor"/><circle cx="8.5" cy="6" r="0.8" fill="currentColor"/><circle cx="11" cy="6" r="0.8" fill="currentColor"/></>,
  x:         <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>,
};

function Svg({ children, size = 16, color = "currentColor", ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ color, flex: "none", display: "block", ...props.style }} {...props}>
      {children}
    </svg>
  );
}

// ── Star Rating ──────────────────────────────────────────────────────────────
function Stars({ count, filled = count }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, alignItems: "center" }}>
      {[1,2,3].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 22 22" style={{display:"block"}}>
          <path d="M11 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L11 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
            fill={i <= filled ? "#eaa317" : "#c5cbd3"} opacity={i <= filled ? 1 : 0.35} />
        </svg>
      ))}
    </span>
  );
}

// ── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({ icon, title, desc, children, style }) {
  return (
    <div style={{
      background: T.panel,
      border: `0.5px solid ${T.border}`,
      borderRadius: T.rCard,
      overflow: "hidden",
      boxShadow: T.shadowCard,
      ...style,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 18px",
        borderBottom: `0.5px solid ${T.border}`,
        background: T.panelHeader,
      }}>
        <span style={{ color: T.teal, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 650, color: T.txt }}>{title}</span>
        {desc && (
          <span style={{ fontSize: 11.5, color: T.txtFaint, marginLeft: "auto" }}>
            {desc}
          </span>
        )}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

// ── FieldLabel ───────────────────────────────────────────────────────────────
function FieldLabel({ label, required }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 600, color: T.txtMute, marginBottom: 6, letterSpacing: "0.01em" }}>
      {label}
      {required && <span style={{ color: T.danger, marginLeft: 3 }}>*</span>}
    </div>
  );
}

// ── TextInput ────────────────────────────────────────────────────────────────
function TextInput({ value, onChange, mono, prefix, type, min }) {
  const base = {
    display: "block", width: "100%", boxSizing: "border-box",
    background: T.surface, color: T.txt,
    border: `0.5px solid ${T.borderStrong}`, borderRadius: T.rInput,
    padding: "10px 12px", fontFamily: mono ? T.fontMono : T.fontUI,
    fontSize: mono ? 12.5 : 13.5, outline: "none",
    transition: "border-color 0.15s",
  };

  if (prefix) {
    return (
      <div style={{ display: "flex", alignItems: "stretch", background: T.surface, border: `0.5px solid ${T.borderStrong}`, borderRadius: T.rInput, overflow: "hidden" }}>
        <span style={{ display: "flex", alignItems: "center", padding: "10px 10px 10px 12px", color: T.txtFaint, fontFamily: T.fontMono, fontSize: 12, whiteSpace: "nowrap", userSelect: "none" }}>
          {prefix}
        </span>
        <input value={value} onChange={e => onChange(e.target.value)} style={{ ...base, border: "none", borderRadius: 0, flex: 1, paddingLeft: 2 }} />
      </div>
    );
  }

  return <input value={value} type={type} min={min} onChange={e => onChange(e.target.value)} style={base} />;
}

// ── Textarea ─────────────────────────────────────────────────────────────────
function Textarea({ value, onChange, rows = 4, mono }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={{
      display: "block", width: "100%", boxSizing: "border-box",
      background: T.surface, color: T.txt,
      border: `0.5px solid ${T.borderStrong}`, borderRadius: T.rInput,
      padding: "10px 12px", fontFamily: mono ? T.fontMono : T.fontUI,
      fontSize: 12.5, lineHeight: 1.65, resize: "vertical",
      outline: "none", transition: "border-color 0.15s",
    }} />
  );
}

// ── VisibilityBadge ──────────────────────────────────────────────────────────
function VisibilityBadge({ visible, onToggle }) {
  const label = visible ? "Shown" : "Hidden";
  return (
    <button onClick={onToggle} aria-label={label} style={{
      all: "unset", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: T.rPill,
      fontSize: 11, fontWeight: 600, fontFamily: T.fontUI,
      background: visible ? T.greenSoft : T.chip,
      color: visible ? T.green : T.txtFaint,
      transition: "all 0.15s",
    }}>
      <Svg size={12} color="currentColor">{visible ? I.eye : I.eyeOff}</Svg>
      {label}
    </button>
  );
}

// ── ConsoleView ──────────────────────────────────────────────────────────────
function ConsoleView({ label, content, status }) {
  const bg = status === "error" ? "#fef2f2" : "#f2f6f9";
  const border = status === "error" ? "rgba(196,69,28,0.25)" : T.border;
  const labelColor = status === "error" ? T.danger : T.txtMute;
  return (
    <div style={{
      background: bg, border: `0.5px solid ${border}`,
      borderRadius: T.rInput, overflow: "hidden", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: `0.5px solid ${border}` }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: status === "error" ? T.danger : T.teal, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: labelColor }}>{label}</span>
      </div>
      <pre style={{ margin: 0, padding: "10px 12px", fontFamily: T.fontMono, fontSize: 11.5, lineHeight: 1.6, color: T.txt, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
        {content}
      </pre>
    </div>
  );
}

// ── Test Case Card ───────────────────────────────────────────────────────────
function TestCaseCard({ test, localIdx, onRemove, onSetTest }) {
  return (
    <div style={{
      border: `0.5px solid ${T.border}`, borderRadius: 10,
      marginBottom: 10, background: T.surface, overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", background: "rgba(255,255,255,0.4)",
        borderBottom: `0.5px solid ${T.border}`,
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 650, color: T.txtMute }}>
          Test {localIdx + 1}
        </span>
        <span style={{ fontSize: 10.5, color: T.txtFaint, flex: 1 }}>
          · Tier {test.tier}
        </span>
        <VisibilityBadge visible={test.is_visible} onToggle={() => onSetTest({ is_visible: !test.is_visible })} />
        <button onClick={onRemove} aria-label="Remove test" style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center",
          padding: 4, borderRadius: 4, color: T.txtFaint,
          marginLeft: 2,
        }}>
          <Svg size={13}>{I.trash}</Svg>
        </button>
      </div>

      {/* Input → Expected */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "10px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.txtFaint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>
            Input
          </div>
          <textarea
            value={test.input}
            onChange={e => onSetTest({ input: e.target.value })}
            rows={3}
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              background: "transparent", color: T.txt, border: "none",
              outline: "none", padding: 0, fontFamily: T.fontMono,
              fontSize: 12, lineHeight: 1.5, resize: "vertical", minHeight: 48,
            }}
          />
        </div>
        <div style={{
          display: "flex", alignItems: "center", padding: "0 2px",
          color: T.tealLine, flexShrink: 0,
        }}>
          <Svg size={18} color={T.teal}>{I.arrowRight}</Svg>
        </div>
        <div style={{ flex: 1, padding: "10px 12px", borderLeft: `0.5px solid ${T.border}` }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T.txtFaint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>
            Expected
          </div>
          <textarea
            value={test.expected}
            onChange={e => onSetTest({ expected: e.target.value })}
            rows={3}
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              background: "transparent", color: T.txt, border: "none",
              outline: "none", padding: 0, fontFamily: T.fontMono,
              fontSize: 12, lineHeight: 1.5, resize: "vertical", minHeight: 48,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Tier Group ───────────────────────────────────────────────────────────────
function TierGroup({ tier, tests, onAddTest, onRemoveTest, onSetTest }) {
  const tierLabel = tier === 1 ? "Visible — shown to students" : tier === 2 ? "Hidden — earned with 1 star" : "Hidden — earned with 2 stars";
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <Stars count={tier} />
        <span style={{ fontSize: 12.5, fontWeight: 650, color: T.txt }}>Tier {tier}</span>
        <span style={{ fontSize: 11, color: T.txtFaint }}>{tierLabel}</span>
      </div>

      {tests.length === 0 ? (
        <div style={{
          border: `1px dashed ${T.borderStrong}`, borderRadius: 10,
          padding: 16, textAlign: "center", fontSize: 12, color: T.txtFaint,
          marginBottom: 8, fontFamily: T.fontUI,
        }}>
          No tests in this tier yet
        </div>
      ) : (
        tests.map(({ test, idx }, localIdx) => (
          <TestCaseCard
            key={idx} test={test} localIdx={localIdx}
            onRemove={() => onRemoveTest(idx)}
            onSetTest={patch => onSetTest(idx, patch)}
          />
        ))
      )}

      <button onClick={onAddTest} style={{
        all: "unset", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 600, color: T.teal, fontFamily: T.fontUI,
        padding: "6px 12px", borderRadius: T.rBtn,
        transition: "background 0.15s",
      }}>
        <Svg size={13}>{I.plus}</Svg>
        Add Tier {tier} test
      </button>
    </div>
  );
}

// ── Student Preview ──────────────────────────────────────────────────────────
function StudentPreview({ title, statement, visibleTests }) {
  return (
    <div style={{
      borderRadius: T.rCard, overflow: "hidden", border: `0.5px solid ${T.border}`,
      boxShadow: T.shadowSticky, background: T.panel,
    }}>
      {/* Preview topbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "8px 14px", background: T.teal,
        fontSize: 11, color: "#fff", fontFamily: T.fontUI,
      }}>
        <Svg size={13} color="#fff">{I.preview}</Svg>
        <span style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.85 }}>
          Student Preview
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, opacity: 0.7 }}>What learners see</span>
      </div>

      {/* Problem title */}
      <div style={{
        padding: "14px 18px",
        borderBottom: `0.5px solid ${T.border}`,
        background: T.panelHeader,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: T.fontDisplay }}>
          {title || "Untitled Problem"}
        </div>
      </div>

      {/* Statement */}
      <div style={{
        padding: "16px 18px", fontSize: 13.5, lineHeight: 1.75,
        color: T.txt, maxHeight: 300, overflowY: "auto",
      }}>
        <div style={{ fontFamily: T.fontUI, whiteSpace: "pre-line" }}>
          {statement || <span style={{ color: T.txtFaint, fontStyle: "italic" }}>No statement yet — add one in the form to preview how students will read it.</span>}
        </div>

        {visibleTests.length > 0 && (
          <>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase",
              color: T.txtFaint, margin: "22px 0 12px",
            }}>
              Examples
            </div>
            {visibleTests.map((test, i) => (
              <div key={i} style={{
                border: `0.5px solid ${T.border}`, borderRadius: 9,
                marginBottom: 10, background: T.surface, overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", padding: "7px 10px",
                  borderBottom: `0.5px solid ${T.border}`, gap: 8,
                  background: "rgba(255,255,255,0.4)",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 650, color: T.txtMute }}>Test {i + 1}</span>
                </div>
                <div style={{ display: "flex" }}>
                  <div style={{ flex: 1, padding: "9px 11px" }}>
                    <div style={{ fontSize: 9.5, color: T.txtFaint, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.6 }}>Input</div>
                    <pre style={{ margin: 0, fontSize: 11.5, fontFamily: T.fontMono, color: T.txt, whiteSpace: "pre-wrap" }}>
                      {test.input || "—"}
                    </pre>
                  </div>
                  <div style={{ flex: 1, padding: "9px 11px", borderLeft: `0.5px solid ${T.border}` }}>
                    <div style={{ fontSize: 9.5, color: T.txtFaint, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.6 }}>Expected</div>
                    <pre style={{ margin: 0, fontSize: 11.5, fontFamily: T.fontMono, color: T.txt, whiteSpace: "pre-wrap" }}>
                      {test.expected || "—"}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const isNew = true; // toggle for edit/new mode

  // Form state
  const [title, setTitle] = React.useState("The Amazing Addition Race");
  const [slug, setSlug] = React.useState("amazing-addition-race");
  const [orderIndex, setOrderIndex] = React.useState("3");
  const [statement, setStatement] = React.useState(
    "Welcome to **The Amazing Addition Race**!\n\nYour task is to write a Python program that adds two numbers and prints the result.\n\n## Instructions\n1. Read two integers from input\n2. Add them together\n3. Print the sum\n\n> Tip: Use `int(input())` to read numbers!"
  );
  const [starterCode, setStarterCode] = React.useState("# Read two numbers\na = int(input())\nb = int(input())\n\n# Print the sum\nprint(a + b)\n");
  const [generatorCode, setGeneratorCode] = React.useState("import random\n\nfor i in range(3):\n    a = random.randint(1, 100)\n    b = random.randint(1, 100)\n    print(f\"Test {i+1}\")\n    print(f\"Input: {a} {b}\")\n    print(f\"Expected: {a+b}\")\n    print()\n");

  const [tests, setTests] = React.useState([
    { tier: 1, is_visible: true,  input: "5\n3", expected: "8" },
    { tier: 1, is_visible: true,  input: "10\n20", expected: "30" },
    { tier: 2, is_visible: false, input: "100\n200", expected: "300" },
    { tier: 3, is_visible: false, input: "50\n25", expected: "75" },
  ]);

  const [dirty, setDirty] = React.useState(false);
  const [generatorRunning, setGeneratorRunning] = React.useState(false);
  const [generatorOutput, setGeneratorOutput] = React.useState(null);
  const [generatorPreview, setGeneratorPreview] = React.useState(null);
  const [error, setError] = React.useState(null);

  const dirtyTimer = React.useRef(null);
  const markDirty = () => {
    setDirty(true);
    clearTimeout(dirtyTimer.current);
    dirtyTimer.current = setTimeout(() => setDirty(false), 4000);
  };

  const handleTitleChange = (v) => {
    setTitle(v);
    if (!slug) setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40));
    markDirty();
  };

  const addTest = (tier) => setTests(prev => [...prev, { tier, is_visible: tier === 1, input: "", expected: "" }]);
  const removeTest = (idx) => setTests(prev => prev.filter((_, i) => i !== idx));
  const setTest = (idx, patch) => setTests(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));

  const tierTests = (tier) => tests.map((test, idx) => ({ test, idx })).filter(({ test }) => test.tier === tier);
  const visibleTests = tests.filter(t => t.is_visible);

  const handleRunGenerator = () => {
    setGeneratorRunning(true);
    setGeneratorOutput(null);
    setGeneratorPreview(null);
    setTimeout(() => {
      setGeneratorRunning(false);
      setGeneratorOutput(">>> Generating test cases...\nFound 5 test cases\n>>> All tests pass checker validation ✓");
      setGeneratorPreview([
        { tier: 1, is_visible: true,  input: "5\n3", expected: "8" },
        { tier: 1, is_visible: true,  input: "10\n20", expected: "30" },
        { tier: 2, is_visible: false, input: "100\n200", expected: "300" },
        { tier: 2, is_visible: false, input: "1\n999", expected: "1000" },
        { tier: 3, is_visible: false, input: "50\n25", expected: "75" },
      ]);
    }, 1500);
  };

  const useGeneratedTests = () => {
    if (generatorPreview) { setTests(generatorPreview); setGeneratorPreview(null); }
  };

  const removeFromPreview = (i) => {
    setGeneratorPreview(prev => prev ? prev.filter((_, idx) => idx !== i) : null);
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.appBg, fontFamily: T.fontUI,
      color: T.txt, display: "flex", flexDirection: "column",
    }}>
      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 24px", background: T.panel,
        borderBottom: `0.5px solid ${T.border}`, boxShadow: T.shadowSticky,
      }}>
        <button onClick={() => {}} style={{
          all: "unset", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: T.txtMute, fontFamily: T.fontUI,
        }}>
          <Svg size={14}>{I.arrowLeft}</Svg>
          Problems
        </button>

        <span style={{ width: 1, height: 18, background: T.border, margin: "0 2px" }} />

        <span style={{ fontSize: 15, fontWeight: 700, color: T.txt }}>
          {isNew ? "New Problem" : "Edit Problem"}
        </span>

        <span style={{
          fontSize: 11, padding: "3px 10px", borderRadius: T.rPill,
          background: dirty ? T.amberSoft : T.greenSoft,
          color: dirty ? T.amber : T.green,
          fontWeight: 600, fontFamily: T.fontUI,
          transition: "all 0.25s",
        }}>
          {dirty ? "Unsaved" : "Saved"}
        </span>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11.5, color: T.txtFaint, fontFamily: T.fontMono }}>
          Ctrl+S to save
        </span>

        <button style={{
          all: "unset", cursor: "pointer",
          fontSize: 13, padding: "8px 16px", borderRadius: T.rBtn,
          border: `0.5px solid ${T.borderStrong}`, color: T.txtMute,
          fontFamily: T.fontUI,
        }}>
          Discard
        </button>

        <button style={{
          all: "unset", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 7,
          fontSize: 13, fontWeight: 650, padding: "8px 18px",
          borderRadius: T.rBtn, background: T.teal, color: "#fff",
          fontFamily: T.fontUI,
        }}>
          <Svg size={14} color="#fff">{I.check}</Svg>
          Save Problem
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1120, margin: "0 auto", width: "100%",
        padding: "24px 24px 64px", display: "flex", gap: 20,
        alignItems: "flex-start", boxSizing: "border-box",
      }}>
        {/* Left: authoring form */}
        <div style={{
          flex: "1 1 0", minWidth: 0,
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          {error && (
            <div style={{
              padding: "10px 14px", background: T.dangerSoft,
              border: `0.5px solid rgba(196,69,28,0.25)`, borderRadius: T.rInput,
              color: T.danger, fontSize: 12.5, fontFamily: T.fontUI,
            }}>
              {error}
            </div>
          )}

          {/* Problem Details */}
          <SectionCard icon={<Svg size={16} color={T.teal}>{I.doc}</Svg>} title="Problem Details" desc="Title & identifier">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <FieldLabel label="Title" required />
                <TextInput value={title} onChange={handleTitleChange} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <FieldLabel label="URL Slug" required />
                  <TextInput value={slug} mono prefix="/compete/" onChange={v => setSlug(v)} />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel label="Order" />
                  <TextInput value={orderIndex} type="number" min={0} onChange={v => setOrderIndex(v)} />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Statement */}
          <SectionCard icon={<Svg size={16} color={T.teal}>{I.lines}</Svg>} title="Problem Statement" desc="Markdown">
            <Textarea value={statement} onChange={setStatement} rows={8} />
          </SectionCard>

          {/* Starter Code */}
          <SectionCard icon={<Svg size={16} color={T.teal}>{I.code}</Svg>} title="Starter Code" desc="Pre-filled for students">
            <div style={{
              border: `0.5px solid ${T.borderStrong}`, borderRadius: T.rInput,
              overflow: "hidden", background: "#1e1e2e",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.2)",
              }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5f56" }} />
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ffbd2e" }} />
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#27c93f" }} />
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginLeft: 8, fontFamily: T.fontMono }}>
                  starter.py
                </span>
              </div>
              <pre style={{
                margin: 0, padding: "14px 16px", fontFamily: T.fontMono,
                fontSize: 12.5, lineHeight: 1.75, color: "#cdd6f4",
                whiteSpace: "pre-wrap", minHeight: 100,
              }}>
                <span style={{color:"#89b4fa"}}># Read two numbers</span>{"\n"}
                <span style={{color:"#fab387"}}>a</span> = <span style={{color:"#a6e3a1"}}>int</span>(<span style={{color:"#a6e3a1"}}>input</span>()){"\n"}
                <span style={{color:"#fab387"}}>b</span> = <span style={{color:"#a6e3a1"}}>int</span>(<span style={{color:"#a6e3a1"}}>input</span>()){"\n\n"}
                <span style={{color:"#89b4fa"}}># Print the sum</span>{"\n"}
                <span style={{color:"#a6e3a1"}}>print</span>(<span style={{color:"#fab387"}}>a</span> + <span style={{color:"#fab387"}}>b</span>){"\n"}
              </pre>
            </div>
          </SectionCard>

          {/* Test Cases */}
          <SectionCard icon={<Svg size={16} color={T.teal}>{I.checkSq}</Svg>} title="Test Cases" desc="3 tiers · each earns a star">
            {([1,2,3]).map(tier => (
              <TierGroup
                key={tier} tier={tier}
                tests={tierTests(tier)}
                onAddTest={() => addTest(tier)}
                onRemoveTest={removeTest}
                onSetTest={setTest}
              />
            ))}
          </SectionCard>

          {/* Generator */}
          <SectionCard icon={<Svg size={16} color={T.teal}>{I.zap}</Svg>} title="Test Generator" desc="Python script">
            {(generatorOutput) && (
              <ConsoleView
                label="Generator output"
                content={generatorOutput}
                status={error ? "error" : undefined}
              />
            )}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 10 }}>
                <FieldLabel label="Generator script" />
                <div style={{ flex: 1 }} />
                <button onClick={handleRunGenerator} disabled={generatorRunning} style={{
                  all: "unset", cursor: generatorRunning ? "not-allowed" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 650, padding: "6px 14px", borderRadius: T.rBtn,
                  background: generatorRunning ? T.chip : T.teal,
                  color: generatorRunning ? T.txtFaint : "#fff",
                  opacity: generatorRunning ? 0.7 : 1, fontFamily: T.fontUI,
                }}>
                  <Svg size={12} color="currentColor">{I.play}</Svg>
                  {generatorRunning ? "Running…" : "Run Generator"}
                </button>
              </div>
              <pre style={{
                margin: 0, padding: "12px 14px", fontFamily: T.fontMono,
                fontSize: 12, lineHeight: 1.7, color: T.txt, whiteSpace: "pre-wrap",
                border: `0.5px solid ${T.borderStrong}`, borderRadius: T.rInput,
                background: T.surface, minHeight: 120,
              }}>
                {generatorCode}
              </pre>
            </div>

            {generatorPreview && (
              <div style={{
                border: `0.5px solid ${T.border}`, borderRadius: T.rInput,
                overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", background: T.panelHeader,
                  borderBottom: `0.5px solid ${T.border}`,
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 650, color: T.txtMute }}>
                    Generated {generatorPreview.length} tests
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={useGeneratedTests} style={{
                    all: "unset", cursor: "pointer",
                    fontSize: 11.5, fontWeight: 650, padding: "4px 12px",
                    borderRadius: T.rBtn, background: T.green,
                    color: "#fff", fontFamily: T.fontUI,
                  }}>
                    Use These Tests
                  </button>
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {generatorPreview.map((tc, i) => (
                    <div key={i} style={{
                      display: "flex",
                      borderBottom: i < generatorPreview.length - 1 ? `0.5px solid ${T.border}` : undefined,
                    }}>
                      <div style={{ width: 70, flexShrink: 0, padding: "8px 10px", borderRight: `0.5px solid ${T.border}`, background: "rgba(255,255,255,0.2)" }}>
                        <div style={{ fontSize: 10, fontWeight: 650, color: T.txtMute, marginBottom: 2 }}>Tier {tc.tier}</div>
                        <div style={{ fontSize: 10, color: T.txtFaint }}>#{i + 1} {tc.is_visible ? "👁" : "🔒"}</div>
                      </div>
                      <div style={{ flex: 1, padding: "8px 10px", borderRight: `0.5px solid ${T.border}` }}>
                        <div style={{ fontSize: 9.5, color: T.txtFaint, marginBottom: 3, textTransform: "uppercase" }}>Input</div>
                        <pre style={{ margin: 0, fontSize: 11, fontFamily: T.fontMono, color: T.txt, whiteSpace: "pre-wrap" }}>
                          {tc.input || "—"}
                        </pre>
                      </div>
                      <div style={{ flex: 1, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9.5, color: T.txtFaint, marginBottom: 3, textTransform: "uppercase" }}>Expected</div>
                        <pre style={{ margin: 0, fontSize: 11, fontFamily: T.fontMono, color: T.txt, whiteSpace: "pre-wrap" }}>
                          {tc.expected || "—"}
                        </pre>
                      </div>
                      <div style={{ width: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: `0.5px solid ${T.border}` }}>
                        <button onClick={() => removeFromPreview(i)} style={{
                          all: "unset", cursor: "pointer", display: "flex",
                          alignItems: "center", padding: 4, borderRadius: 4,
                          color: T.txtFaint,
                        }}>
                          <Svg size={11}>{I.x}</Svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Save bar (bottom, for long forms) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 0",
          }}>
            <div style={{ flex: 1 }} />
            <button style={{
              all: "unset", cursor: "pointer",
              fontSize: 13, padding: "9px 18px", borderRadius: T.rBtn,
              border: `0.5px solid ${T.borderStrong}`, color: T.txtMute,
              fontFamily: T.fontUI,
            }}>
              Discard
            </button>
            <button style={{
              all: "unset", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 13, fontWeight: 650, padding: "9px 20px",
              borderRadius: T.rBtn, background: T.teal, color: "#fff",
              fontFamily: T.fontUI,
            }}>
              <Svg size={15} color="#fff">{I.check}</Svg>
              Save Problem
            </button>
          </div>
        </div>

        {/* Right: sticky student preview */}
        <div style={{
          flexShrink: 0, width: 400,
          position: "sticky", top: 72,
        }}>
          <StudentPreview
            title={title}
            statement={statement}
            visibleTests={visibleTests}
          />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
