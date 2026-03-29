type IconButtonProps = {
  label: string;
  icon: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
};

export default function IconButton({
  label,
  icon,
  onClick,
  active,
  disabled,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={[
        "group relative flex items-center justify-center",
        "w-12 h-12 rounded-lg",
        "transition-all duration-150",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
            ? "bg-blue-700"
            : "hover:bg-blue-800 active:bg-blue-700",
        "focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-white/70",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900",
      ].join(" ")}
    >
      <img
        src={icon}
        alt=""
        className="w-6 h-6 pointer-events-none opacity-90 group-hover:opacity-100"
      />
    </button>
  );
}
