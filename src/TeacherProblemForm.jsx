// ── pi3 Teacher Problem Form — Fullscreen, 3 Layouts ────────────────────────────
// Layout A: Tabbed (horizontal tabs + right preview)
// Layout B: Sidebar (vertical nav + center content + right preview)
// Layout C: Accordion (stacked collapsible sections + floating preview drawer)

// ── Design Tokens ──────────────────────────────────────────────────────────────
const T = {
  appBg:        "#e9e3d3",
  surface:      "#fbf6e9",
  panel:        "#fffaf0",
  panelHeader:  "#fdf3e1",
  chip:         "#f3ebd7",
  border:       "rgba(20,30,40,0.08)",
  borderStrong: "rgba(20,30,40,0.15)",
  borderHeavy:  "rgba(20,30,40,0.22)",

  txt:       "#1f2933",
  txtMute:   "#5b6976",
  txtFaint:  "#9aa6b2",

  teal:      "#0e9aa7",
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

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const ICONS = {
  doc:     <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  code:    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  check:   <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  plus:    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>,
  trash:   <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  eye:     <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/></>,
  eyeOff:  <><path d="M17.94 17.94A10 10 0 0 1 12 19c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/><path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/></>,
  play:    <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>,
  zap:     <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  arrowR:  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  arrowL:  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  x:       <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>,
  layoutA: <><rect x="3" y="3" width="7" height="16" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="12" y="3" width="7" height="16" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/></>,
  layoutB: <><rect x="2" y="3" width="5" height="16" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="9" y="3" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="9" y="12" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/></>,
  layoutC: <><rect x="3" y="3" width="16" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="3" y="10" width="16" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="3" y="17" width="9" height="2" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none"/></>,
  star:    <path d="M11 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L11 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" fill="currentColor"/>,
  settings:<><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M12 1v2M12 19v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M19 12h2M4.22 19.78l1.42-1.42M16.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>,
  preview: <><rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M3 8h18" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="6" cy="6" r="0.8" fill="currentColor"/><circle cx="8.5" cy="6" r="0.8" fill="currentColor"/><circle cx="11" cy="6" r="0.8" fill="currentColor"/></>,
  chevronD:<path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  chevronR:<path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  save:    <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  flag:    <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M4 22V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/></>,
  tag:     <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></>,
  copy:    <><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/></>,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function sectionHasContent(id, form) {
  if (id === "details") return !!(form.title || form.tags.length > 0);
  if (id === "statement") return form.statement.length > 10;
  if (id === "code") return form.starterCode.length > 10;
  if (id === "tests") return form.tests.length > 0;
  if (id === "generate") return form.genScript.length > 20;
  return false;
}

// ── Section Definitions ────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "details",  label: "Details",   icon: ICONS.settings, desc: "Title, slug, difficulty" },
  { id: "statement",label: "Statement", icon: ICONS.doc,      desc: "Problem description" },
  { id: "code",     label: "Code",      icon: ICONS.code,     desc: "Starter code template" },
  { id: "tests",    label: "Tests",     icon: ICONS.check,    desc: "Test cases & tiers" },
  { id: "generate", label: "Generate",  icon: ICONS.zap,      desc: "Auto-generate tests" },
];

// ── Star Rating ────────────────────────────────────────────────────────────────
function Stars({ count }) {
  return (
    <span style={{ display:"inline-flex", gap:1, alignItems:"center" }}>
      {[1,2,3].map(function(i) {
        return (
          <svg key={i} width="14" height="14" viewBox="0 0 22 22" style={{display:"block"}}>
            <path d="M11 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L11 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
              fill={i <= count ? "#eaa317" : "#c5cbd3"} opacity={i <= count ? 1 : 0.3} />
          </svg>
        );
      })}
    </span>
  );
}

// ── Section Header (used in card headers) ──────────────────────────────────────
function SectionHeader(props) {
  var icon = props.icon, title = props.title, desc = props.desc, number = props.number, badge = props.badge, actions = props.actions;
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"14px 18px", background:T.panelHeader,
      borderBottom:"0.5px solid "+T.border,
    }}>
      {number != null && (
        <span style={{
          display:"inline-flex", alignItems:"center", justifyContent:"center",
          width:22, height:22, borderRadius:6,
          background:T.teal, color:"#fff",
          fontSize:11, fontWeight:700, fontFamily:T.fontUI,
          flexShrink:0
        }}>{number}</span>
      )}
      <span style={{ color:T.teal, flexShrink:0, display:"flex" }}>
        <svg width={16} height={16} viewBox="0 0 22 22" style={{display:"block"}}>{icon}</svg>
      </span>
      <span style={{ fontSize:13.5, fontWeight:650, color:T.txt }}>{title}</span>
      {desc && <span style={{ fontSize:11.5, color:T.txtFaint }}>{desc}</span>}
      {badge && (
        <span style={{
          marginLeft:"auto", padding:"2px 8px", borderRadius:T.rPill,
          fontSize:10.5, fontWeight:600, fontFamily:T.fontUI,
          background: badge.color === "amber" ? T.amberSoft : badge.color === "green" ? T.greenSoft : T.tealSoft,
          color: badge.color === "amber" ? T.amber : badge.color === "green" ? T.green : T.teal,
        }}>{badge.label}</span>
      )}
      {actions}
    </div>
  );
}

// ── Field Label ────────────────────────────────────────────────────────────────
function Label(props) {
  return (
    <div style={{ fontSize:11.5, fontWeight:600, color:T.txtMute, marginBottom:6, letterSpacing:"0.01em" }}>
      {props.children}{props.required && React.createElement('span', {style:{ color:T.danger, marginLeft:3 }}, '*')}
    </div>
  );
}

// ── Text Input ─────────────────────────────────────────────────────────────────
function Input(props) {
  var value = props.value, onChange = props.onChange, mono = props.mono, placeholder = props.placeholder, prefix = props.prefix, type = props.type, min = props.min;
  var base = {
    display:"block", width:"100%", boxSizing:"border-box",
    background:T.surface, color:T.txt,
    border:"0.5px solid "+T.borderStrong, borderRadius:T.rInput,
    padding:"10px 12px", fontFamily: mono ? T.fontMono : T.fontUI,
    fontSize: mono ? 12.5 : 13.5, outline:"none",
    transition:"border-color 0.15s",
  };
  if (prefix) {
    return (
      <div style={{ display:"flex", alignItems:"stretch", background:T.surface, border:"0.5px solid "+T.borderStrong, borderRadius:T.rInput, overflow:"hidden" }}>
        <span style={{ display:"flex", alignItems:"center", padding:"10px 10px 10px 12px", color:T.txtFaint, fontFamily:T.fontMono, fontSize:12, whiteSpace:"nowrap", userSelect:"none" }}>{prefix}</span>
        <input value={value} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder} style={Object.assign({}, base, {border:"none", borderRadius:0, flex:1, paddingLeft:2})} />
      </div>
    );
  }
  return React.createElement('input', { value:value, type:type, min:min, onChange:function(e) { onChange(e.target.value); }, placeholder:placeholder, style:base });
}

function Textarea(props) {
  var value = props.value, onChange = props.onChange, rows = props.rows, mono = props.mono;
  return (
    <textarea value={value} onChange={function(e) { onChange(e.target.value); }} rows={rows || 5} style={{
      display:"block", width:"100%", boxSizing:"border-box",
      background:T.surface, color:T.txt,
      border:"0.5px solid "+T.borderStrong, borderRadius:T.rInput,
      padding:"10px 12px", fontFamily: mono ? T.fontMono : T.fontUI,
      fontSize:12.5, lineHeight:1.65, resize:"vertical",
      outline:"none", transition:"border-color 0.15s",
    }} />
  );
}

// ── Pill Badge ─────────────────────────────────────────────────────────────────
function Pill(props) {
  return (
    <button onClick={props.onClick} style={{
      all:"unset", cursor: props.onClick ? "pointer" : "default",
      display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:T.rPill,
      fontSize:11, fontWeight:600, fontFamily:T.fontUI,
      background: props.active ? T.tealSoft : T.chip,
      color: props.active ? T.teal : (props.color || T.txtFaint),
      transition:"all 0.15s",
    }}>
      {props.icon && React.createElement('svg', {width:12, height:12, viewBox:"0 0 22 22", style:{display:"block"}}, props.icon)}
      {props.label}
    </button>
  );
}

// ── Test Case Card ─────────────────────────────────────────────────────────────
function TestCaseCard(props) {
  return (
    <div style={{
      background:T.surface, border:"0.5px solid "+T.border,
      borderRadius:T.rCard, overflow:"hidden",
    }}>
      <div style={{
        display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
        borderBottom:"0.5px solid "+T.border,
      }}>
        <span style={{ fontSize:11, fontWeight:700, color:T.txtMute, fontFamily:T.fontMono }}>#{(props.index||0)+1}</span>
        <Stars count={props.tier} />
        <span style={{ fontSize:11, color:T.txtFaint }}>Tier {props.tier}</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          <Pill label={props.visible ? "Shown" : "Hidden"} color={props.visible ? T.green : T.txtFaint} icon={props.visible ? ICONS.eye : ICONS.eyeOff} onClick={props.onToggleVis} active={props.visible} />
          <button onClick={props.onDelete} style={{ all:"unset", cursor:"pointer", display:"flex", padding:2, color:T.txtFaint, borderRadius:4 }} title="Delete test">
            <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.trash}</svg>
          </button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:0, alignItems:"stretch" }}>
        <div style={{ padding:"10px 14px 14px" }}>
          <div style={{ fontSize:10.5, fontWeight:600, color:T.txtFaint, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Input</div>
          <textarea value={props.input} onChange={function(e) { props.onInput(e.target.value); }} rows={3} style={{
            display:"block", width:"100%", boxSizing:"border-box", resize:"vertical",
            background:"transparent", color:T.txt, border:"none",
            fontFamily:T.fontMono, fontSize:12, lineHeight:1.6, outline:"none",
          }} />
        </div>
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:"0 4px", color:T.teal, background:T.tealSoft,
        }}>
          <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.arrowR}</svg>
        </div>
        <div style={{ padding:"10px 14px 14px" }}>
          <div style={{ fontSize:10.5, fontWeight:600, color:T.txtFaint, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Expected</div>
          <textarea value={props.expected} onChange={function(e) { props.onExpected(e.target.value); }} rows={3} style={{
            display:"block", width:"100%", boxSizing:"border-box", resize:"vertical",
            background:"transparent", color:T.txt, border:"none",
            fontFamily:T.fontMono, fontSize:12, lineHeight:1.6, outline:"none",
          }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT PREVIEW (shared across all layouts)
// ═══════════════════════════════════════════════════════════════════════════════
function StudentPreview(props) {
  var title = props.title, statement = props.statement, visibleTests = props.visibleTests;
  return (
    <div style={{
      display:"flex", flexDirection:"column", height:"100%",
      background:T.panel, border:"0.5px solid "+T.border,
      borderRadius:T.rCard, overflow:"hidden", boxShadow:T.shadowCard,
    }}>
      <div style={{
        display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
        background:T.teal, color:"#fff",
      }}>
        <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block", opacity:0.9}}>{ICONS.preview}</svg>
        <span style={{ fontSize:12, fontWeight:600, fontFamily:T.fontUI }}>Student Preview</span>
        <span style={{ marginLeft:"auto", fontSize:10, opacity:0.7 }}>Live</span>
      </div>
      <div style={{ padding:"14px 16px 10px", borderBottom:"0.5px solid "+T.border, background:T.panelHeader }}>
        <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:T.txt, fontFamily:T.fontDisplay }}>
          {title || "Untitled Problem"}
        </h2>
      </div>
      <div style={{ padding:"14px 16px", flex:1, overflowY:"auto" }}>
        <div style={{ fontSize:13, lineHeight:1.7, color:T.txtMute, whiteSpace:"pre-wrap", fontFamily:T.fontUI }}>
          {statement || "No problem statement yet. Write your problem description in the Statement section."}
        </div>
        {visibleTests && visibleTests.length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.txtMute, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.04em" }}>Examples</div>
            {visibleTests.map(function(t, i) {
              return (
                <div key={i} style={{
                  display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:0,
                  border:"0.5px solid "+T.border, borderRadius:T.rInput,
                  marginBottom:8, overflow:"hidden", fontSize:12,
                }}>
                  <div style={{ padding:"8px 10px", fontFamily:T.fontMono, color:T.txt, background:T.surface }}>
                    <div style={{ fontSize:9.5, color:T.txtFaint, marginBottom:3, fontWeight:600 }}>INPUT</div>
                    {t.input}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", padding:"0 5px", color:T.teal, background:T.tealSoft }}>
                    <svg width={12} height={12} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.arrowR}</svg>
                  </div>
                  <div style={{ padding:"8px 10px", fontFamily:T.fontMono, color:T.txt, background:T.surface }}>
                    <div style={{ fontSize:9.5, color:T.txtFaint, marginBottom:3, fontWeight:600 }}>EXPECTED</div>
                    {t.expected}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{
        display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
        borderTop:"0.5px solid "+T.border, background:T.panelHeader,
        fontSize:10.5, color:T.txtFaint,
      }}>
        <span>Type your answer in the code editor</span>
        <span style={{ marginLeft:"auto" }}>python</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM CONTENT — shared across all layouts
// ═══════════════════════════════════════════════════════════════════════════════
function FormContent(props) {
  var section = props.section, form = props.form, setForm = props.setForm;

  if (section === "details") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div>
          <Label required>Problem Title</Label>
          <Input value={form.title} onChange={function(v) { setForm("title", v); }} placeholder="e.g. Sum of Two Numbers" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div>
            <Label required>URL Slug</Label>
            <Input value={form.slug} onChange={function(v) { setForm("slug", v); }} mono prefix="/problems/" placeholder="sum-two-numbers" />
          </div>
          <div>
            <Label>Difficulty Tier</Label>
            <div style={{ display:"flex", gap:8, paddingTop:2 }}>
              {[1,2,3].map(function(tier) {
                return (
                  <button key={tier} onClick={function() { setForm("tier", tier); }} style={{
                    all:"unset", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:5,
                    padding:"7px 14px", borderRadius:T.rInput,
                    background: form.tier === tier ? T.tealSoft : T.surface,
                    border:"0.5px solid " + (form.tier === tier ? T.tealLine : T.borderStrong),
                    color: form.tier === tier ? T.teal : T.txtMute,
                    fontSize:12.5, fontWeight:600, fontFamily:T.fontUI,
                    transition:"all 0.15s",
                  }}>
                    <Stars count={tier} />
                    <span>Tier {tier}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <Label>Tags</Label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {form.tags.map(function(tag, i) {
              return React.createElement(Pill, {key:i, label:tag, icon:ICONS.tag, onClick:function() {
                setForm("tags", form.tags.filter(function(_,j) { return j !== i; }));
              }});
            })}
            <button onClick={function() {
              var t = prompt("Add tag:");
              if (t && form.tags.indexOf(t) === -1) setForm("tags", form.tags.concat([t]));
            }} style={{
              all:"unset", cursor:"pointer",
              display:"inline-flex", alignItems:"center", gap:4,
              padding:"3px 10px", borderRadius:T.rPill,
              background:T.chip, color:T.txtFaint,
              fontSize:11, fontWeight:600, fontFamily:T.fontUI,
            }}>
              <svg width={12} height={12} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.plus}</svg>Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (section === "statement") {
    return (
      <div>
        <Label required>Problem Statement (Markdown)</Label>
        <Textarea value={form.statement} onChange={function(v) { setForm("statement", v); }} rows={12} mono />
        <div style={{ marginTop:8, fontSize:10.5, color:T.txtFaint }}>
          Supports Markdown. Use #, **bold**, - lists, and ```python code blocks.
        </div>
      </div>
    );
  }

  if (section === "code") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <Label>Starter Code (students see this)</Label>
          <div style={{
            background:"#1e2329", borderRadius:T.rInput, overflow:"hidden",
            border:"0.5px solid "+T.borderStrong,
          }}>
            <div style={{
              display:"flex", alignItems:"center", gap:8, padding:"6px 14px",
              background:"rgba(255,255,255,0.04)", borderBottom:"0.5px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:T.teal }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontFamily:T.fontMono }}>solution.py</span>
            </div>
            <textarea value={form.starterCode} onChange={function(e) { setForm("starterCode", e.target.value); }} rows={10} style={{
              display:"block", width:"100%", boxSizing:"border-box", resize:"vertical",
              background:"transparent", color:"#d8dee9", border:"none",
              fontFamily:T.fontMono, fontSize:12.5, lineHeight:1.7,
              padding:"12px 14px", outline:"none",
            }} />
          </div>
        </div>
      </div>
    );
  }

  if (section === "tests") {
    var tierLabels = {1:"Basic understanding", 2:"Edge cases", 3:"Advanced scenarios"};
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
        {[1,2,3].map(function(tier) {
          var tierTests = form.tests.filter(function(t) { return t.tier === tier; });
          return (
            <div key={tier}>
              <div style={{
                display:"flex", alignItems:"center", gap:8, marginBottom:10,
                padding:"10px 14px", background:T.panelHeader,
                borderRadius:T.rInput, border:"0.5px solid "+T.border,
              }}>
                <Stars count={tier} />
                <span style={{ fontSize:13, fontWeight:650, color:T.txt }}>Tier {tier}</span>
                <span style={{ fontSize:11, color:T.txtFaint }}>{tierLabels[tier]}</span>
                <div style={{ marginLeft:"auto" }}>
                  <Pill label={tierTests.length+" tests"} color={T.txtFaint} />
                </div>
              </div>
              {tierTests.length === 0 ? (
                <div style={{
                  padding:"24px", textAlign:"center", border:"1px dashed "+T.border,
                  borderRadius:T.rInput, color:T.txtFaint, fontSize:12.5,
                }}>
                  No Tier {tier} tests yet.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {tierTests.map(function(t) {
                    var idx = form.tests.indexOf(t);
                    return React.createElement(TestCaseCard, {
                      key:idx, index:idx, tier:t.tier, input:t.input, expected:t.expected, visible:t.visible,
                      onToggleVis: function() {
                        setForm("tests", form.tests.map(function(tt, j) {
                          return idx === j ? Object.assign({}, tt, {visible: !tt.visible}) : tt;
                        }));
                      },
                      onDelete: function() {
                        setForm("tests", form.tests.filter(function(tt) { return tt !== t; }));
                      },
                      onInput: function(v) {
                        setForm("tests", form.tests.map(function(tt, j) {
                          return idx === j ? Object.assign({}, tt, {input: v}) : tt;
                        }));
                      },
                      onExpected: function(v) {
                        setForm("tests", form.tests.map(function(tt, j) {
                          return idx === j ? Object.assign({}, tt, {expected: v}) : tt;
                        }));
                      }
                    });
                  })}
                </div>
              )}
              <button onClick={function() {
                setForm("tests", form.tests.concat([{tier:tier, input:"", expected:"", visible: tier===1}]));
              }} style={{
                all:"unset", cursor:"pointer", marginTop:8,
                display:"inline-flex", alignItems:"center", gap:6,
                color:T.teal, fontSize:12, fontWeight:600, fontFamily:T.fontUI,
              }}>
                <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.plus}</svg>
                Add Tier {tier} test
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === "generate") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div>
          <Label>Python Generator Script</Label>
          <div style={{
            background:"#1e2329", borderRadius:T.rInput, overflow:"hidden",
            border:"0.5px solid "+T.borderStrong,
          }}>
            <div style={{
              display:"flex", alignItems:"center", gap:8, padding:"6px 14px",
              background:"rgba(255,255,255,0.04)", borderBottom:"0.5px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#61afef" }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontFamily:T.fontMono }}>generator.py</span>
              <button onClick={function() { setForm("genOutput", "Running generator...\n 8 tests generated"); }} style={{
                all:"unset", cursor:"pointer", marginLeft:"auto",
                display:"inline-flex", alignItems:"center", gap:5,
                padding:"3px 10px", borderRadius:T.rBtn,
                background:T.teal, color:"#fff",
                fontSize:11, fontWeight:600, fontFamily:T.fontUI,
              }}>
                <svg width={11} height={11} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.play}</svg>Run
              </button>
            </div>
            <textarea value={form.genScript} onChange={function(e) { setForm("genScript", e.target.value); }} rows={8} style={{
              display:"block", width:"100%", boxSizing:"border-box", resize:"vertical",
              background:"transparent", color:"#d8dee9", border:"none",
              fontFamily:T.fontMono, fontSize:12.5, lineHeight:1.7,
              padding:"12px 14px", outline:"none",
            }} />
          </div>
        </div>
        {form.genOutput && (
          <div style={{
            background:"#f2f6f9", border:"0.5px solid "+T.border,
            borderRadius:T.rInput, overflow:"hidden",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", borderBottom:"0.5px solid "+T.border }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:T.teal }} />
              <span style={{ fontSize:11, fontWeight:600, color:T.txtMute }}>Output</span>
            </div>
            <pre style={{ margin:0, padding:"10px 14px", fontSize:11.5, color:T.txt, fontFamily:T.fontMono, lineHeight:1.6, whiteSpace:"pre-wrap", overflowX:"auto" }}>
              {form.genOutput}
            </pre>
          </div>
        )}
        {form.genTests.length > 0 && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:12, fontWeight:650, color:T.txt }}>Generated Tests</span>
              <Pill label={form.genTests.length+" tests"} color={T.txtFaint} />
              <button onClick={function() {
                setForm("tests", form.tests.concat(form.genTests.map(function(t) { return Object.assign({}, t); })));
                setForm("genTests", []);
              }} style={{
                all:"unset", cursor:"pointer", marginLeft:"auto",
                display:"inline-flex", alignItems:"center", gap:5,
                padding:"5px 14px", borderRadius:T.rBtn,
                background:T.green, color:"#fff",
                fontSize:11.5, fontWeight:600, fontFamily:T.fontUI,
              }}>
                <svg width={12} height={12} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.check}</svg>
                Adopt All Tests
              </button>
            </div>
            <div style={{ border:"0.5px solid "+T.border, borderRadius:T.rCard, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5, fontFamily:T.fontMono }}>
                <thead>
                  <tr style={{ background:T.panelHeader, borderBottom:"0.5px solid "+T.border }}>
                    <th style={{ padding:"8px 10px", textAlign:"left", fontWeight:600, color:T.txtMute, fontSize:10.5 }}>Tier</th>
                    <th style={{ padding:"8px 10px", textAlign:"left", fontWeight:600, color:T.txtMute, fontSize:10.5 }}>Input</th>
                    <th style={{ padding:"8px 10px", textAlign:"left", fontWeight:600, color:T.txtMute, fontSize:10.5 }}>Expected</th>
                    <th style={{ padding:"8px 10px", width:40 }} />
                  </tr>
                </thead>
                <tbody>
                  {form.genTests.map(function(t, i) {
                    return (
                      <tr key={i} style={{ borderBottom:"0.5px solid "+T.border }}>
                        <td style={{ padding:"8px 10px", color:T.txtMute }}>T{t.tier}</td>
                        <td style={{ padding:"8px 10px", color:T.txt }}>{t.input}</td>
                        <td style={{ padding:"8px 10px", color:T.txt }}>{t.expected}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center" }}>
                          <button onClick={function() { setForm("genTests", form.genTests.filter(function(_,j) { return j !== i; })); }} style={{
                            all:"unset", cursor:"pointer", color:T.txtFaint, display:"flex",
                          }}>
                            <svg width={12} height={12} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.x}</svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT A — FULLSCREEN TABBED
// ═══════════════════════════════════════════════════════════════════════════════
function LayoutTabbed(props) {
  var form = props.form, setForm = props.setForm, section = props.section, setSection = props.setSection, onLayout = props.onLayout;

  return (
    <div style={{ display:"flex", height:"100vh", background:T.appBg, fontFamily:T.fontUI }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <div style={{
          display:"flex", alignItems:"stretch", gap:0,
          background:T.panel, borderBottom:"1px solid "+T.borderHeavy,
          padding:"0 20px", boxShadow:T.shadowSticky,
        }}>
          {SECTIONS.map(function(s) {
            var active = section === s.id;
            var hasContent = sectionHasContent(s.id, form);
            return (
              <button key={s.id} onClick={function() { setSection(s.id); }} style={{
                all:"unset", cursor:"pointer",
                display:"flex", alignItems:"center", gap:7,
                padding:"12px 18px",
                fontSize:12.5, fontWeight: active ? 650 : 500,
                fontFamily:T.fontUI,
                color: active ? T.teal : T.txtMute,
                borderBottom: active ? "2.5px solid "+T.teal : "2.5px solid transparent",
                background: "transparent",
                transition:"all 0.15s",
                whiteSpace:"nowrap",
              }}>
                <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block", opacity: active ? 1 : 0.55}}>{s.icon}</svg>
                {s.label}
                {hasContent && (
                  <span style={{
                    width:6, height:6, borderRadius:"50%",
                    background: active ? T.teal : T.amber,
                    display:"inline-block",
                  }} />
                )}
              </button>
            );
          })}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ display:"flex", gap:2, background:T.chip, borderRadius:T.rBtn, padding:2 }}>
              {[
                { id:"tabbed", icon:ICONS.layoutA, label:"Tabs" },
                { id:"sidebar", icon:ICONS.layoutB, label:"Sidebar" },
                { id:"accordion", icon:ICONS.layoutC, label:"Stack" },
              ].map(function(l) {
                return (
                  <button key={l.id} onClick={function() { onLayout(l.id); }} style={{
                    all:"unset", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:4,
                    padding:"4px 8px", borderRadius:4,
                    fontSize:10.5, fontWeight:600, fontFamily:T.fontUI,
                    color:T.txtFaint,
                    background:"transparent",
                  }} title={l.label}>
                    <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{l.icon}</svg>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
          <div style={{
            maxWidth:680, margin:"0 auto",
            background:T.panel, borderRadius:T.rCard,
            border:"0.5px solid "+T.border, boxShadow:T.shadowCard,
            overflow:"hidden",
          }}>
            {React.createElement(SectionHeader, {
              number: SECTIONS.findIndex(function(s) { return s.id === section; }) + 1,
              icon: SECTIONS.find(function(s) { return s.id === section; }).icon,
              title: SECTIONS.find(function(s) { return s.id === section; }).label,
              desc: SECTIONS.find(function(s) { return s.id === section; }).desc,
            })}
            <div style={{ padding:20 }}>
              <FormContent section={section} form={form} setForm={setForm} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ width:380, flexShrink:0, padding:"16px 16px 16px 0" }}>
        <StudentPreview
          title={form.title}
          statement={form.statement}
          visibleTests={form.tests.filter(function(t) { return t.visible; })}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT B — FULLSCREEN SIDEBAR NAVIGATOR
// ═══════════════════════════════════════════════════════════════════════════════
function LayoutSidebar(props) {
  var form = props.form, setForm = props.setForm, section = props.section, setSection = props.setSection, onLayout = props.onLayout;
  var sectionIndex = SECTIONS.findIndex(function(s) { return s.id === section; });

  return (
    <div style={{ display:"flex", height:"100vh", background:T.appBg, fontFamily:T.fontUI }}>
      <div style={{
        width:200, flexShrink:0, display:"flex", flexDirection:"column",
        background:T.panel, borderRight:"1px solid "+T.borderHeavy,
        boxShadow:T.shadowSticky, zIndex:1,
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8, padding:"16px 16px 12px",
          borderBottom:"1px solid "+T.border,
        }}>
          <div style={{
            width:32, height:32, borderRadius:8, background:T.teal,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize:15, fontWeight:700, fontFamily:T.fontDisplay,
          }}>&#960;</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.txt }}>Problem Editor</div>
            <div style={{ fontSize:10.5, color:T.txtFaint }}>{form.title || "Untitled"}</div>
          </div>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:1, padding:"10px 8px" }}>
          {SECTIONS.map(function(s, i) {
            var active = section === s.id;
            var hasContent = sectionHasContent(s.id, form);
            return (
              <button key={s.id} onClick={function() { setSection(s.id); }} style={{
                all:"unset", cursor:"pointer",
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", borderRadius:T.rInput,
                background: active ? T.tealSoft : "transparent",
                color: active ? T.teal : T.txtMute,
                transition:"all 0.12s",
              }}>
                <span style={{
                  display:"flex", alignItems:"center", justifyContent:"center",
                  width:20, height:20, borderRadius:5,
                  background: active ? T.teal : T.chip,
                  color: active ? "#fff" : T.txtFaint,
                  fontSize:10.5, fontWeight:700,
                  flexShrink:0,
                }}>{i + 1}</span>
                <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block", opacity: active ? 1 : 0.55}}>{s.icon}</svg>
                <span style={{ fontSize:12.5, fontWeight: active ? 650 : 500 }}>{s.label}</span>
                {hasContent && (
                  <span style={{
                    marginLeft:"auto", width:6, height:6, borderRadius:"50%",
                    background: T.amber, display:"inline-block",
                  }} />
                )}
              </button>
            );
          })}
        </div>
        <div style={{ padding:"10px 12px", borderTop:"1px solid "+T.border }}>
          <div style={{ fontSize:10, fontWeight:600, color:T.txtFaint, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>Layout</div>
          <div style={{ display:"flex", gap:2, background:T.chip, borderRadius:T.rBtn, padding:2 }}>
            {[{ id:"tabbed", icon:ICONS.layoutA },{ id:"sidebar", icon:ICONS.layoutB },{ id:"accordion", icon:ICONS.layoutC }].map(function(l) {
              return (
                <button key={l.id} onClick={function() { onLayout(l.id); }} style={{
                  all:"unset", cursor:"pointer", flex:1,
                  display:"flex", justifyContent:"center", padding:"5px 0", borderRadius:4,
                  background:"transparent", color:T.txtFaint,
                }} title={l.id}>
                  <svg width={16} height={16} viewBox="0 0 22 22" style={{display:"block"}}>{l.icon}</svg>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"28px 32px", minWidth:0 }}>
        <div style={{ display:"flex", gap:24, marginBottom:24, alignItems:"center" }}>
          {SECTIONS.map(function(s, i) {
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{
                  width:24, height:24, borderRadius:"50%",
                  background: i < sectionIndex ? T.green : i === sectionIndex ? T.teal : T.chip,
                  color: i <= sectionIndex ? "#fff" : T.txtFaint,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700,
                  transition:"all 0.2s",
                }}>{i < sectionIndex ? "\u2713" : i + 1}</span>
                <span style={{
                  fontSize:11, fontWeight: i === sectionIndex ? 650 : 500,
                  color: i === sectionIndex ? T.txt : i < sectionIndex ? T.txtMute : T.txtFaint,
                }}>{s.label}</span>
                {i < SECTIONS.length - 1 && (
                  <div style={{ width:32, height:1, background: i < sectionIndex ? T.green : T.border, margin:"0 4px" }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{
          maxWidth:720,
          background:T.panel, borderRadius:T.rCard,
          border:"1px solid "+T.borderHeavy, boxShadow:T.shadowCard,
          overflow:"hidden",
        }}>
          {React.createElement(SectionHeader, {
            number: sectionIndex + 1,
            icon: SECTIONS[sectionIndex].icon,
            title: SECTIONS[sectionIndex].label,
            desc: SECTIONS[sectionIndex].desc,
          })}
          <div style={{ padding:24 }}>
            <FormContent section={section} form={form} setForm={setForm} />
          </div>
        </div>
        <div style={{ maxWidth:720, display:"flex", justifyContent:"space-between", marginTop:16, gap:12 }}>
          <button onClick={function() { if (sectionIndex>0) setSection(SECTIONS[sectionIndex-1].id); }} style={{
            all:"unset", cursor: sectionIndex>0 ? "pointer" : "default",
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"8px 16px", borderRadius:T.rBtn,
            background: sectionIndex>0 ? T.surface : "transparent",
            border:"0.5px solid "+T.border,
            color: sectionIndex>0 ? T.txt : T.txtFaint,
            fontSize:12, fontWeight:600, fontFamily:T.fontUI,
            opacity: sectionIndex>0 ? 1 : 0.4,
          }}>
            <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.arrowL}</svg>
            Previous
          </button>
          <button onClick={function() { if (sectionIndex<SECTIONS.length-1) setSection(SECTIONS[sectionIndex+1].id); }} style={{
            all:"unset", cursor: sectionIndex<SECTIONS.length-1 ? "pointer" : "default",
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"8px 16px", borderRadius:T.rBtn,
            background: sectionIndex<SECTIONS.length-1 ? T.teal : "transparent",
            border: sectionIndex<SECTIONS.length-1 ? "none" : "0.5px solid "+T.border,
            color: sectionIndex<SECTIONS.length-1 ? "#fff" : T.txtFaint,
            fontSize:12, fontWeight:600, fontFamily:T.fontUI,
            opacity: sectionIndex<SECTIONS.length-1 ? 1 : 0.4,
          }}>
            Next
            <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.arrowR}</svg>
          </button>
        </div>
      </div>
      <div style={{ width:380, flexShrink:0, padding:"16px 16px 16px 0" }}>
        <StudentPreview
          title={form.title}
          statement={form.statement}
          visibleTests={form.tests.filter(function(t) { return t.visible; })}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT C — FULLSCREEN ACCORDION FLOW (stacked, collapsible, floating preview)
// ═══════════════════════════════════════════════════════════════════════════════
function LayoutAccordion(props) {
  var form = props.form, setForm = props.setForm, collapsed = props.collapsed, setCollapsed = props.setCollapsed, showPreview = props.showPreview, setShowPreview = props.setShowPreview;

  return (
    <div style={{ height:"100vh", background:T.appBg, fontFamily:T.fontUI, display:"flex" }}>
      <div style={{ flex:1, overflowY:"auto", padding:"28px 32px 100px", minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28, maxWidth:780, margin:"0 auto 28px" }}>
          <div style={{
            width:36, height:36, borderRadius:9, background:T.teal,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize:18, fontWeight:700, fontFamily:T.fontDisplay,
          }}>&#960;</div>
          <div>
            <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:T.txt, fontFamily:T.fontDisplay }}>Problem Editor</h1>
            <div style={{ fontSize:11, color:T.txtFaint }}>{form.title || "Untitled problem"} &mdash; {form.tests.length} tests, {form.genTests.length} generated</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={function() { setShowPreview(!showPreview); }} style={{
              all:"unset", cursor:"pointer",
              display:"inline-flex", alignItems:"center", gap:5,
              padding:"5px 12px", borderRadius:T.rBtn,
              background: showPreview ? T.teal : T.chip,
              color: showPreview ? "#fff" : T.txtFaint,
              fontSize:11, fontWeight:600, fontFamily:T.fontUI,
            }}>
              <svg width={12} height={12} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.eye}</svg>
              Preview
            </button>
          </div>
        </div>

        <div style={{ maxWidth:780, margin:"0 auto", display:"flex", flexDirection:"column", gap:14 }}>
          {SECTIONS.map(function(s, i) {
            var isCollapsed = collapsed[s.id];
            var hasContent = sectionHasContent(s.id, form);

            return (
              <div key={s.id} style={{
                background:T.panel, borderRadius:T.rCard,
                border:"1px solid "+(isCollapsed ? T.border : T.borderHeavy),
                boxShadow: isCollapsed ? "none" : T.shadowCard,
                overflow:"hidden",
                transition:"box-shadow 0.2s, border-color 0.2s",
              }}>
                <button onClick={function() { setCollapsed(s.id, !isCollapsed); }} style={{
                  all:"unset", cursor:"pointer", width:"100%", boxSizing:"border-box",
                  display:"flex", alignItems:"center", gap:10,
                  padding:"14px 18px", background:T.panelHeader,
                  borderBottom: isCollapsed ? "none" : "0.5px solid "+T.border,
                }}>
                  <span style={{
                    display:"inline-flex", alignItems:"center", justifyContent:"center",
                    width:24, height:24, borderRadius:6,
                    background: isCollapsed ? T.chip : T.teal,
                    color: isCollapsed ? T.txtFaint : "#fff",
                    fontSize:11.5, fontWeight:700, flexShrink:0, fontFamily:T.fontUI,
                    transition:"all 0.15s",
                  }}>{i + 1}</span>
                  <span style={{ color:T.teal, flexShrink:0, display:"flex" }}>
                    <svg width={15} height={15} viewBox="0 0 22 22" style={{display:"block"}}>{s.icon}</svg>
                  </span>
                  <span style={{ fontSize:13.5, fontWeight:650, color:T.txt }}>{s.label}</span>
                  <span style={{ fontSize:11.5, color:T.txtFaint }}>{s.desc}</span>
                  {hasContent && !isCollapsed && (
                    <span style={{ fontSize:10.5, fontWeight:600, color:T.amber, background:T.amberSoft, padding:"2px 8px", borderRadius:T.rPill }}>Filled</span>
                  )}
                  <span style={{ marginLeft:"auto", color:T.txtFaint, transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition:"transform 0.2s", display:"flex" }}>
                    <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.chevronD}</svg>
                  </span>
                </button>
                {!isCollapsed && (
                  <div style={{ padding:20 }}>
                    <FormContent section={s.id} form={form} setForm={setForm} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ maxWidth:780, margin:"20px auto 0", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button style={{
            all:"unset", cursor:"pointer",
            padding:"10px 20px", borderRadius:T.rBtn,
            background:T.surface, border:"0.5px solid "+T.borderStrong,
            color:T.txtMute, fontSize:13, fontWeight:600, fontFamily:T.fontUI,
          }}>Discard</button>
          <button style={{
            all:"unset", cursor:"pointer",
            display:"inline-flex", alignItems:"center", gap:7,
            padding:"10px 24px", borderRadius:T.rBtn,
            background:T.teal, color:"#fff",
            fontSize:13, fontWeight:600, fontFamily:T.fontUI,
          }}>
            <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.save}</svg>
            Save Problem
          </button>
        </div>
      </div>

      {showPreview && (
        <div style={{
          width:400, flexShrink:0, padding:"16px",
          borderLeft:"1px solid "+T.borderHeavy,
          background:T.appBg,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:650, color:T.txtMute }}>Student Preview</span>
            <button onClick={function() { setShowPreview(false); }} style={{
              all:"unset", cursor:"pointer", marginLeft:"auto", color:T.txtFaint, display:"flex",
            }}>
              <svg width={14} height={14} viewBox="0 0 22 22" style={{display:"block"}}>{ICONS.x}</svg>
            </button>
          </div>
          <div style={{ height:"calc(100vh - 80px)" }}>
            <StudentPreview
              title={form.title}
              statement={form.statement}
              visibleTests={form.tests.filter(function(t) { return t.visible; })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function App() {
  var _useState = React.useState, layoutState = _useState("tabbed"), layout = layoutState[0], setLayout = layoutState[1];
  var sectionState = _useState("details"), section = sectionState[0], setSection = sectionState[1];
  var collapsedState = _useState({details:false, statement:false, code:true, tests:false, generate:true});
  var collapsed = collapsedState[0], setCollapsedRaw = collapsedState[1];
  var setCollapsed = function(id, val) { setCollapsedRaw(function(prev) { var n = {}; Object.keys(prev).forEach(function(k) { n[k] = prev[k]; }); n[id] = val; return n; }); };
  var previewState = _useState(true), showPreview = previewState[0], setShowPreview = previewState[1];

  var formState = _useState({
    title: "Sum of Two Numbers",
    slug: "sum-two-numbers",
    tier: 1,
    tags: ["math", "beginner", "arithmetic"],
    statement: "Write a function that takes **two numbers** and returns their sum.\n\n## Example\nIf the input is `3` and `5`, the output should be `8`.\n\n### Notes\n- Both numbers will be integers\n- The result can be positive or negative",
    starterCode: "def sum_two(a, b):\n    # Write your code here\n    pass",
    tests: [
      { tier: 1, input: "3\n5", expected: "8", visible: true },
      { tier: 1, input: "10\n20", expected: "30", visible: true },
      { tier: 2, input: "-5\n7", expected: "2", visible: true },
      { tier: 2, input: "0\n0", expected: "0", visible: false },
      { tier: 3, input: "1000000\n2000000", expected: "3000000", visible: false },
    ],
    genScript: "import random\n\ndef generate_tests(n=10):\n    tests = []\n    for _ in range(n):\n        a = random.randint(-100, 100)\n        b = random.randint(-100, 100)\n        tests.append({\n            \"input\": f\"{a}\\n{b}\",\n            \"expected\": str(a + b)\n        })\n    return tests",
    genOutput: "",
    genTests: [
      { tier: 1, input: "42\n58", expected: "100" },
      { tier: 2, input: "-33\n33", expected: "0" },
      { tier: 3, input: "999\n-1001", expected: "-2" },
    ],
  });
  var form = formState[0], setFormRaw = formState[1];
  var setForm = function(key, val) { setFormRaw(function(prev) { var n = {}; Object.keys(prev).forEach(function(k) { n[k] = prev[k]; }); n[key] = val; return n; }); };

  if (layout === "sidebar") {
    return React.createElement(LayoutSidebar, {form:form, setForm:setForm, section:section, setSection:setSection, onLayout:setLayout});
  }
  if (layout === "accordion") {
    return React.createElement(LayoutAccordion, {form:form, setForm:setForm, collapsed:collapsed, setCollapsed:setCollapsed, showPreview:showPreview, setShowPreview:setShowPreview});
  }
  return React.createElement(LayoutTabbed, {form:form, setForm:setForm, section:section, setSection:setSection, onLayout:setLayout});
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
