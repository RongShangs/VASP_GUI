import { useMemo } from 'react';
import { useConnectionStore, useJobStore } from '../../store';

export default function StatusBar() {
  const { connectedAlias } = useConnectionStore();
  const { activeJob, progress } = useJobStore();

  const elapsed = useMemo(() => {
    if (!progress?.elapsedSeconds) return null;
    const h = Math.floor(progress.elapsedSeconds / 3600);
    const m = Math.floor((progress.elapsedSeconds % 3600) / 60);
    const s = Math.floor(progress.elapsedSeconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [progress?.elapsedSeconds]);

  return (
    <div className="vasp-statusbar">
      <span>
        <span className={`conn-dot ${connectedAlias ? 'online' : 'offline'}`} />
        {' '}{connectedAlias || '未连接'}
      </span>
      {activeJob && (
        <>
          <span>📐 {activeJob.calc_type}</span>
          <span>
            <span className={`status-indicator ${activeJob.status === 'running' ? 'online' : activeJob.status === 'error' ? 'offline' : ''}`} />
            {activeJob.status}
          </span>
          {progress && (
            <>
              <span>⚡ E: {progress.currentEnergy?.toFixed(4) ?? '—'} eV</span>
              <span>🔄 离子: {progress.ionicCurrent}/{progress.totalIonicSteps || '?'}</span>
              {elapsed && <span>⏱ {elapsed}</span>}
            </>
          )}
        </>
      )}
    </div>
  );
}
