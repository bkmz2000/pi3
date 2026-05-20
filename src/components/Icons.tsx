type IconProps = { size?: number; color?: string; strokeWidth?: number };

function s(props: IconProps) {
  return {
    stroke: props.color || "currentColor",
    strokeWidth: props.strokeWidth ?? 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
  };
}

export function IconFolder({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
    </svg>
  );
}

export function IconPlay({ size = 22, ...rest }: IconProps) {
  const c = rest.color || "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={c}>
      <path d="M8 5.6v12.8c0 .8.86 1.3 1.55.86l9.5-6.4a1 1 0 0 0 0-1.72L9.55 4.74A1 1 0 0 0 8 5.6Z" />
    </svg>
  );
}

export function IconStop({ size = 22, ...rest }: IconProps) {
  const c = rest.color || "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={c}>
      <rect x="6" y="6" width="12" height="12" rx="3.5" />
    </svg>
  );
}

export function IconSparkle({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.6 6.6l2 2M15.4 15.4l2 2M6.6 17.4l2-2M15.4 8.6l2-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconSettings({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 12a7.5 7.5 0 0 0-.1-1.4l1.7-1.3-1.7-3-2 .7a7.4 7.4 0 0 0-2.4-1.4L14.5 3h-5l-.4 2.2a7.4 7.4 0 0 0-2.4 1.4l-2-.7-1.7 3 1.7 1.3a7.5 7.5 0 0 0 0 2.8L3 14.3l1.7 3 2-.7a7.4 7.4 0 0 0 2.4 1.4L9.5 21h5l.4-2.2a7.4 7.4 0 0 0 2.4-1.4l2 .7 1.7-3-1.7-1.3c.07-.46.1-.92.1-1.4Z" />
    </svg>
  );
}

export function IconPlus({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconClose({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconTrash({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M4 7h16M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7M6.5 7l.9 12.1A2.5 2.5 0 0 0 9.9 21.5h4.2a2.5 2.5 0 0 0 2.5-2.4L17.5 7" />
    </svg>
  );
}

export function IconCheck({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconImport({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  );
}

export function IconExport({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 19V8m0 0l-4 4m4-4l4 4M5 4h14" />
    </svg>
  );
}

export function IconWarn({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 4l10 17H2L12 4ZM12 10v5M12 18v.5" />
    </svg>
  );
}

export function IconCursor({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M5 4l14 6-6 2-2 6-6-14Z" />
    </svg>
  );
}

export function IconHand({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V13m0-6.5V5a1.5 1.5 0 0 1 3 0v7.5M14 9a1.5 1.5 0 0 1 3 0v3M17 12a1.5 1.5 0 0 1 3 0v2a7 7 0 0 1-7 7 6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0" />
    </svg>
  );
}

export function IconSquare({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  );
}

export function IconCircle({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function IconLine({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M5 19L19 5" />
    </svg>
  );
}

export function IconPencil({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M3 21l3.5-1L20 6.5 17.5 4 4 17.5 3 21Z" />
    </svg>
  );
}

export function IconPolygon({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 3l9 6-3.5 11h-11L3 9l9-6Z" />
    </svg>
  );
}

export function IconText({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M5 6V4h14v2M12 4v16M9 20h6" />
    </svg>
  );
}

export function IconUndo({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

export function IconRedo({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
    </svg>
  );
}

export function IconGrid({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M4 10h16M4 16h16M10 4v16M16 4v16" />
    </svg>
  );
}

export function IconCopy({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H17" />
    </svg>
  );
}

export function IconEye({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconNodes({ size = 22, ...rest }: IconProps) {
  const c = rest.color || "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 18 C9 18 9 6 14 6 L20 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="4" cy="18" r="2" fill={c} />
      <circle cx="14" cy="6" r="2" fill={c} />
      <circle cx="20" cy="6" r="2" fill={c} />
    </svg>
  );
}

export function IconUsers({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M21 20c-.3-2-2-3.5-4-3.5" />
    </svg>
  );
}

export function IconBucket({ size = 22, ...rest }: IconProps) {
  const c = rest.color || "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bucket body (trapezoid, wider at bottom) */}
      <path d="M6 8.5 L7.5 19 Q7.8 20.5 9.5 20.5 H14.5 Q16.2 20.5 16.5 19 L18 8.5 Z"
        fill={c} opacity="0.2"/>
      <path d="M6 8.5 L7.5 19 Q7.8 20.5 9.5 20.5 H14.5 Q16.2 20.5 16.5 19 L18 8.5 Z"
        stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Top rim */}
      <rect x="5" y="7" width="14" height="2" rx="1" fill={c}/>
      {/* Handle (arc) */}
      <path d="M9.5 7 Q9.5 4 12 4 Q14.5 4 14.5 7"
        stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Paint drip */}
      <path d="M12 20.5 Q11.5 23 13.5 22.5 Q15 22 14 20.5"
        stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function IconFrame({ size = 22, ...rest }: IconProps) {
  const c = rest.color || "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="1" stroke={c} strokeWidth={1.8} strokeDasharray="3 2" />
      <rect x="2" y="2" width="4" height="4" rx="1" fill={c} />
      <rect x="18" y="2" width="4" height="4" rx="1" fill={c} />
      <rect x="2" y="18" width="4" height="4" rx="1" fill={c} />
      <rect x="18" y="18" width="4" height="4" rx="1" fill={c} />
    </svg>
  );
}

export type IconName =
  | "folder"
  | "play"
  | "stop"
  | "sparkle"
  | "settings"
  | "plus"
  | "close"
  | "trash"
  | "check"
  | "import"
  | "export"
  | "warn"
  | "cursor"
  | "square"
  | "circle"
  | "line"
  | "pencil"
  | "polygon"
  | "text"
  | "undo"
  | "redo"
  | "grid"
  | "copy"
  | "eye"
  | "nodes"
  | "book"
  | "users"
  | "bucket"
  | "frame"
  | "filter"
  | "hand";

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  switch (name) {
    case "folder": return <IconFolder {...props} />;
    case "play": return <IconPlay {...props} />;
    case "stop": return <IconStop {...props} />;
    case "sparkle": return <IconSparkle {...props} />;
    case "settings": return <IconSettings {...props} />;
    case "plus": return <IconPlus {...props} />;
    case "close": return <IconClose {...props} />;
    case "trash": return <IconTrash {...props} />;
    case "check": return <IconCheck {...props} />;
    case "import": return <IconImport {...props} />;
    case "export": return <IconExport {...props} />;
    case "warn": return <IconWarn {...props} />;
    case "cursor": return <IconCursor {...props} />;
    case "square": return <IconSquare {...props} />;
    case "circle": return <IconCircle {...props} />;
    case "line": return <IconLine {...props} />;
    case "pencil": return <IconPencil {...props} />;
    case "polygon": return <IconPolygon {...props} />;
    case "text": return <IconText {...props} />;
    case "undo": return <IconUndo {...props} />;
    case "redo": return <IconRedo {...props} />;
    case "grid": return <IconGrid {...props} />;
    case "copy": return <IconCopy {...props} />;
    case "eye": return <IconEye {...props} />;
    case "nodes": return <IconNodes {...props} />;
    case "book": return <IconBook {...props} />;
    case "users": return <IconUsers {...props} />;
    case "bucket": return <IconBucket {...props} />;
    case "frame": return <IconFrame {...props} />;
    case "filter": return <IconFilter {...props} />;
    case "hand": return <IconHand {...props} />;
  }
}

function IconFilter({ size = 22, ...rest }: IconProps) {
  const c = rest.color || "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 5h18M6 10h12M10 15h4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconBook({ size = 22, color, strokeWidth }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth={strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="13" y2="11" />
    </svg>
  );
}

export function IconImage({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3 16l4.5-5 4 4.5 2.5-2.5 5 5" />
    </svg>
  );
}

export function IconLayers({ size = 22, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s(rest)}>
      <path d="M12 2L2 7l10 5 10-5-10-5Z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}
