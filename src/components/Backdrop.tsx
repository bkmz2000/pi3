type BackdropProps = {
  open: boolean;
  onClick: () => void;
};

export default function Backdrop({ open, onClick }: BackdropProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed",
        inset: 0,
        left: 60,
        background: "transparent",
        zIndex: 5,
      }}
    />
  );
}
