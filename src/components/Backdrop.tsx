type BackdropProps = {
  open: boolean;
  onClick: () => void;
};

export default function Backdrop({ open, onClick }: BackdropProps) {
  return (
    <div
      onClick={onClick}
      className={`fixed inset-y-0 right-0 z-5 bg-black/40 transition-opacity ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      style={{ left: "var(--rail-w, 56px)" }}
    />
  );
}
