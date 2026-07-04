import Header from './Header';
import StatusBar from './StatusBar';
import LeftPanel from '../left-panel/LeftPanel';
import CenterPanel from '../center-panel/CenterPanel';
import RightPanel from '../right-panel/RightPanel';
import { useUIStore } from '../../store';

export default function MainLayout() {
  const leftCollapsed = useUIStore(s => s.leftPanelCollapsed);
  const leftWide = useUIStore(s => s.leftPanelWide);
  const rightCollapsed = useUIStore(s => s.rightPanelCollapsed);

  return (
    <div className="vasp-layout">
      <Header />
      <div className="vasp-body">
        <div
          className={`left-panel${leftCollapsed ? ' collapsed' : ''}`}
          style={leftWide && !leftCollapsed ? { width: '55vw', minWidth: 500 } : undefined}
        >
          <LeftPanel />
        </div>
        <div className="center-panel">
          <CenterPanel />
        </div>
        <div className={`right-panel${rightCollapsed ? ' collapsed' : ''}`}>
          <RightPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
