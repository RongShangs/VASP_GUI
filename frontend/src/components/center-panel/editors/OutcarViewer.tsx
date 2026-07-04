import { useMemo } from 'react';
import { Descriptions, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

function extractOutcarInfo(content: string) {
  const info: Record<string, any> = {};

  // VASP version
  const verMatch = content.match(/vasp\.(\d+\.\d+\.\d+)/i);
  info.version = verMatch ? verMatch[1] : 'unknown';

  // Execution time
  const timeMatch = content.match(/Total CPU time used \(sec\):\s+([\d.]+)/);
  info.cpuTime = timeMatch ? parseFloat(timeMatch[1]) : null;

  // Loop timing
  const loopMatch = content.match(/LOOP\+:\s+CPU time\s+([\d.]+)/g);
  info.loopTimes = loopMatch ? loopMatch.length : 0;

  // Final energy - look for the last "FREE ENERGIE OF THE ION-ELECTRON SYSTEM"
  const energyMatches = [...content.matchAll(/FREE ENERGIE OF THE ION-ELECTRON SYSTEM\s*\n\s*-+\s*\n.*?\n.*?\n\s*energy\s+without\s+entropy\s*=\s+([\d.\-]+)\s+energy\(sigma->0\)\s*=\s+([\d.\-]+)/gi)];
  if (energyMatches.length > 0) {
    const last = energyMatches[energyMatches.length - 1];
    info.energyWithoutEntropy = parseFloat(last[1]);
    info.energySigma0 = parseFloat(last[2]);
  }

  // Forces / Stress
  const forceMatch = content.match(/TOTAL-FORCE\s*\(eV\/Angst\)/);
  info.hasForces = !!forceMatch;

  const stressMatch = content.match(/in\s+kB/);
  info.hasStress = !!stressMatch;

  // Convergence reached?
  info.converged = content.includes('reached required accuracy');
  info.aborting = content.includes('aborting loop');

  // Memory usage
  const memMatch = content.match(/memory\s+\(kb\)\s*:\s+([\d.]+)/i);
  info.memoryKB = memMatch ? parseFloat(memMatch[1]) : null;

  // Ions per type
  const ionMatch = content.match(/ions per type =\s+(.+)/);
  info.ionsPerType = ionMatch ? ionMatch[1].trim() : null;

  // K-points
  const kptMatch = content.match(/Found\s+(\d+)\s+irreducible k-points/);
  info.nKpoints = kptMatch ? parseInt(kptMatch[1]) : null;

  // Plane waves
  const pwMatch = content.match(/maximum\s+plane-waves\s+(\d+)/);
  info.nPlaneWaves = pwMatch ? parseInt(pwMatch[1]) : null;

  return info;
}

interface Props {
  content: string;
}

export default function OutcarViewer({ content }: Props) {
  const info = useMemo(() => extractOutcarInfo(content), [content]);

  const statusTag = info.converged ? (
    <Tag icon={<CheckCircleOutlined />} color="success">Converged</Tag>
  ) : info.aborting ? (
    <Tag icon={<CloseCircleOutlined />} color="error">Aborted</Tag>
  ) : (
    <Tag icon={<ClockCircleOutlined />} color="default">Unknown</Tag>
  );

  return (
    <div style={{ padding: 12, overflow: 'auto' }}>
      <Descriptions column={2} size="small" bordered
        labelStyle={{ color: '#888', fontSize: 11, width: 160 }}
        contentStyle={{ color: '#e0e0e0', fontSize: 11, fontFamily: 'monospace' }}
      >
        <Descriptions.Item label="VASP Version">{info.version}</Descriptions.Item>
        <Descriptions.Item label="Status">{statusTag}</Descriptions.Item>
        <Descriptions.Item label="E (w/o entropy)">
          {info.energyWithoutEntropy ? `${info.energyWithoutEntropy.toFixed(8)} eV` : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="E (sigma→0)">
          {info.energySigma0 ? `${info.energySigma0.toFixed(8)} eV` : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Total CPU Time">
          {info.cpuTime ? `${(info.cpuTime / 60).toFixed(1)} min` : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Loop Iterations">{info.loopTimes || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Memory">
          {info.memoryKB ? `${(info.memoryKB / 1024).toFixed(1)} MB` : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Irreducible K-points">{info.nKpoints || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Max Plane Waves">{info.nPlaneWaves || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Ions per Type">{info.ionsPerType || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Forces Available">
          <Tag color={info.hasForces ? 'green' : 'default'}>{info.hasForces ? 'Yes' : 'No'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Stress Available">
          <Tag color={info.hasStress ? 'green' : 'default'}>{info.hasStress ? 'Yes' : 'No'}</Tag>
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 12, fontSize: 10, color: '#666' }}>
        OUTCAR summary — {(content.length / 1024 / 1024).toFixed(1)} MB total. Use "Edit Source" for full content.
      </div>
    </div>
  );
}
