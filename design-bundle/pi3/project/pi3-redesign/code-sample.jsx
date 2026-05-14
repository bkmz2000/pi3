// Lightweight Python tokenizer for the static code editor mock.
// Renders with the colored indentation guides that pi3 already ships in CodeMirror.

const PI3_KW = new Set(["from","import","def","return","if","elif","else","for","while","in","not","and","or","is","None","True","False","global","nonlocal","class","try","except","finally","raise","with","as","lambda","yield","pass","break","continue"]);
const PI3_BUILTIN = new Set(["print","range","len","abs","int","float","str","list","tuple","dict","set","bool","input","round","random","min","max","sum"]);
const PI3_GAPI = new Set(["size","background","fill","stroke","no_fill","no_stroke","circle","rect","ellipse","line","point","text","width","height","run","setup","every","on_key_press","on_mouse_move","on_mouse_click","Actor","random_color","mouse_x","mouse_y"]);

function pi3Tokenize(line) {
  const out = [];
  let i = 0;
  let indent = 0;
  while (i < line.length && line[i] === " ") { indent++; i++; }
  while (i < line.length) {
    const c = line[i];
    if (c === "#") { out.push({ t: "comment", v: line.slice(i) }); break; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== c) j++;
      out.push({ t: "string", v: line.slice(i, Math.min(line.length, j + 1)) });
      i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      out.push({ t: "number", v: line.slice(i, j) });
      i = j; continue;
    }
    if (c === "@") {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      out.push({ t: "decorator", v: line.slice(i, j) });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let k = j; while (k < line.length && line[k] === " ") k++;
      const isCall = line[k] === "(";
      let kind = "ident";
      if (PI3_KW.has(word)) kind = "keyword";
      else if (PI3_BUILTIN.has(word) || PI3_GAPI.has(word)) kind = "builtin";
      else if (isCall) kind = "func";
      out.push({ t: kind, v: word });
      i = j; continue;
    }
    out.push({ t: "operator", v: c });
    i++;
  }
  return { indent, tokens: out };
}

function CodeBlock({ code, theme, activeLine = 13 }) {
  const lines = code.split("\n");
  const ch = "0.6em"; // approx 1ch in monospace at our font size
  return (
    <div style={{
      fontFamily: theme.fontMono,
      fontSize: 13.5,
      lineHeight: "22px",
      color: theme.editorTxt,
      paddingTop: 8,
    }}>
      {lines.map((ln, idx) => {
        const { indent, tokens } = pi3Tokenize(ln);
        const indentLevels = Math.floor(indent / 4);
        const remainder = indent % 4;
        const isActive = idx === activeLine;
        return (
          <div key={idx} style={{
            display: "flex",
            alignItems: "stretch",
            background: isActive ? theme.editorActiveLine : "transparent",
            minHeight: 22,
          }}>
            <div style={{
              width: 44,
              textAlign: "right",
              paddingRight: 14,
              color: theme.editorGutterTxt,
              userSelect: "none",
              flex: "none",
              fontVariantNumeric: "tabular-nums",
            }}>
              {idx + 1}
            </div>
            <div style={{ display: "flex", flex: 1, position: "relative", paddingRight: 16 }}>
              {[...Array(indentLevels)].map((_, k) => (
                <span key={k} style={{
                  width: "calc(4ch)",
                  background: theme.indent[Math.min(k, theme.indent.length - 1)],
                  flex: "none",
                }} />
              ))}
              {remainder > 0 && (
                <span style={{ width: `${remainder}ch`, flex: "none" }} />
              )}
              <span style={{ flex: 1, whiteSpace: "pre" }}>
                {tokens.map((tk, j) => (
                  <span key={j} style={{ color: theme.syn[tk.t] || theme.syn.ident }}>{tk.v}</span>
                ))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PI3_CODE_BOUNCE = `from graphics import *

@setup
def start():
    size(640, 360)

ball_x = 100
ball_y = 100
vx = 4
vy = 3

@every(1)
def loop():
    global ball_x, ball_y, vx, vy
    background("midnightblue")
    ball_x += vx
    ball_y += vy
    if ball_x < 20 or ball_x > 620:
        vx = -vx
    if ball_y < 20 or ball_y > 340:
        vy = -vy
    fill("hotpink")
    no_stroke()
    circle(ball_x, ball_y, 20)

run()`;

// Adapter for ide-editor.jsx: returns array of { tokens: [{k, t}], gutter? }
// gutter "warn" highlights a line; here we mark line 10 as warn for the lint chip.
function SAMPLE_CODE(_lang) {
  const lines = PI3_CODE_BOUNCE.split("\n");
  return lines.map((ln, idx) => {
    const { tokens } = pi3Tokenize(ln);
    return {
      tokens: tokens.map(tk => ({ k: tk.t, t: tk.v })),
      gutter: idx === 9 ? "warn" : undefined,
    };
  });
}

window.CodeBlock = CodeBlock;
window.PI3_CODE_BOUNCE = PI3_CODE_BOUNCE;
window.SAMPLE_CODE = SAMPLE_CODE;
