import { useIde } from '../state/IdeState';

export function SaveErrorIndicator() {
  const saveError = useIde((s) => s.saveError);

  if (!saveError) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 9998,
        padding: '12px 16px',
        borderRadius: 6,
        fontSize: 13,
        color: '#fff',
        background: '#e05',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        maxWidth: 300,
        wordWrap: 'break-word',
      }}
    >
      Couldn't save — check your connection
    </div>
  );
}
