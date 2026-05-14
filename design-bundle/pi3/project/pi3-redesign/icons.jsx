// Shared icon set — simple line + filled glyphs, friendly without being childish.
function PI3Icon({ name, size = 22, color = "currentColor", strokeWidth = 1.8 }) {
  const s = { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  switch (name) {
    case "folder":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/></svg>);
    case "play":
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M8 5.6v12.8c0 .8.86 1.3 1.55.86l9.5-6.4a1 1 0 0 0 0-1.72L9.55 4.74A1 1 0 0 0 8 5.6Z"/></svg>);
    case "stop":
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill={color}><rect x="6" y="6" width="12" height="12" rx="3.5"/></svg>);
    case "sparkle":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.6 6.6l2 2M15.4 15.4l2 2M6.6 17.4l2-2M15.4 8.6l2-2"/><circle cx="12" cy="12" r="3"/></svg>);
    case "settings":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 12a7.5 7.5 0 0 0-.1-1.4l1.7-1.3-1.7-3-2 .7a7.4 7.4 0 0 0-2.4-1.4L14.5 3h-5l-.4 2.2a7.4 7.4 0 0 0-2.4 1.4l-2-.7-1.7 3 1.7 1.3a7.5 7.5 0 0 0 0 2.8L3 14.3l1.7 3 2-.7a7.4 7.4 0 0 0 2.4 1.4L9.5 21h5l.4-2.2a7.4 7.4 0 0 0 2.4-1.4l2 .7 1.7-3-1.7-1.3c.07-.46.1-.92.1-1.4Z"/></svg>);
    case "copy":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H17"/></svg>);
    case "trash":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M4 7h16M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7M6.5 7l.9 12.1A2.5 2.5 0 0 0 9.9 21.5h4.2a2.5 2.5 0 0 0 2.5-2.4L17.5 7"/></svg>);
    case "plus":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14"/></svg>);
    case "close":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M6 6l12 12M18 6L6 18"/></svg>);
    case "import":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/></svg>);
    case "export":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 19V8m0 0l-4 4m4-4l4 4M5 4h14"/></svg>);
    case "check":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 13l4 4L19 7"/></svg>);
    case "tag":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M3 12V5.5A2.5 2.5 0 0 1 5.5 3H12l9 9-7.5 7.5L3 12Z"/><circle cx="8" cy="8" r="1.4" fill={color} stroke="none"/></svg>);
    case "ball":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/></svg>);
    case "snake":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M4 8c2 0 2 4 5 4s3-4 6-4 3 4 5 4"/><circle cx="20" cy="8" r="1.2" fill={color} stroke="none"/></svg>);
    case "puzzle":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M9 4h2.5a1.5 1.5 0 1 1 0 3H14a2 2 0 0 1 2 2v2.5a1.5 1.5 0 1 0 3 0V14a2 2 0 0 1-2 2h-2.5a1.5 1.5 0 1 0 0 3H10a2 2 0 0 1-2-2v-2.5a1.5 1.5 0 1 1-3 0V10a2 2 0 0 1 2-2h2"/></svg>);
    case "ship":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 3l5 14-5-3-5 3 5-14Z"/></svg>);
    case "cursor":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 4l14 6-6 2-2 6-6-14Z"/></svg>);
    case "type":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 6V4h14v2M9 4v16M15 4v16M7 20h4M13 20h4"/></svg>);
    case "eye":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>);
    case "eye-off":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M3 3l18 18M9.9 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.3 4.3M6.4 6.4A17.7 17.7 0 0 0 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>);
    case "square":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="4" y="4" width="16" height="16"/></svg>);
    case "circle":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="8"/></svg>);
    case "line":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 19L19 5"/></svg>);
    case "pencil":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M3 21l3.5-1L20 6.5 17.5 4 4 17.5 3 21Z"/></svg>);
    case "polygon":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 3l9 6-3.5 11h-11L3 9l9-6Z"/></svg>);
    case "text":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>);
    case "undo":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg>);
    case "redo":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"/></svg>);
    case "grid":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="4" y="4" width="16" height="16"/><path d="M4 10h16M4 16h16M10 4v16M16 4v16"/></svg>);
    case "warn":
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 4l10 17H2L12 4ZM12 10v5M12 18v.5"/></svg>);
  }
  return null;
}

window.PI3Icon = PI3Icon;
