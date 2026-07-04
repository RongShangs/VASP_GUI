import { useUIStore, useJobStore } from '../../store';
import FunctionCards from './FunctionCards';
import RuntimeMonitor from './RuntimeMonitor';
import PostProcessPage from '../postprocess/PostProcessPage';

export default function RightPanel() {
  const collapsed = useUIStore(s => s.rightPanelCollapsed);
  const mode = useUIStore(s => s.rightPanelMode);
  const { activeJob } = useJobStore();

  if (collapsed) return null;
  if (mode === 'postprocess') return <PostProcessPage />;
  if (activeJob || mode === 'running') return <RuntimeMonitor />;
  return <FunctionCards />;
}
