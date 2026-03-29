type IconButtonProps = {
  label: string;
  icon: string;
  expanded?: boolean;
  controls?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  spin?: boolean;
};

export default function IconButton({
  label,
  icon,
  expanded,
  controls,
  onClick,
  active,
  disabled,
  spin,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      title={label}
      disabled={disabled}
      className={[
        "flex items-center justify-center w-12 h-12 rounded-md transition-colors",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : active
            ? "bg-cyan-800"
            : "hover:bg-cyan-800 active:bg-cyan-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-cyan-900",
      ].join(" ")}
    >
      <img
        src={icon}
        alt=""
        className={[
          "w-6 h-6",
          spin ? "animate-spin" : "",
          "opacity-90 hover:opacity-100 transition-opacity",
        ].join(" ")}
      />
    </button>
  );
}
