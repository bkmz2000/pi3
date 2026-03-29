import { useIde } from "../state/IdeState";
import { PanelId } from "../state/IdeState";

export function usePanels() {
  const activePanel = useIde((s) => s.activePanel);
  const setActivePanel = useIde((s) => s.setActivePanel);
  const togglePanel = useIde((s) => s.togglePanel);

  const isOpen = (id: Exclude<PanelId, null>) => activePanel === id;
  const closePanels = () => setActivePanel(null);

  return {
    activePanel,
    isOpen,
    togglePanel,
    closePanels,
  };
}
