/**
 * 3D Crystal Structure Viewer — renders POSCAR data as ball-and-stick model.
 * Uses Three.js for WebGL rendering with orbit controls.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  content: string; // POSCAR file content
}

interface AtomInfo {
  element: string;
  position: [number, number, number];
}

// Parse POSCAR into lattice + atoms (mirrors POSCARParser logic)
function parsePoscar(content: string): {
  lattice: number[][];
  atoms: AtomInfo[];
  comment: string;
} {
  const lines = content.split('\n');
  const comment = lines[0]?.trim() || '';
  const scale = parseFloat(lines[1] || '1') || 1;

  const lattice: number[][] = [];
  for (let i = 2; i < 5 && i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    lattice.push([
      parseFloat(parts[0]) * scale || 0,
      parseFloat(parts[1]) * scale || 0,
      parseFloat(parts[2]) * scale || 0,
    ]);
  }

  const elements = lines[5]?.trim().split(/\s+/) || [];
  const counts = lines[6]?.trim().split(/\s+/).map(Number) || [];

  // Determine coordinate start
  let coordStart = 7;
  let coordType = 'Direct';
  if (lines[7]?.trim().toLowerCase().startsWith('s')) coordStart = 8;
  if (lines[coordStart]?.trim().match(/^[a-zA-Z]/) && !lines[coordStart]?.match(/^\d/)) {
    const t = lines[coordStart].trim().toLowerCase();
    coordType = t.startsWith('c') || t.startsWith('k') ? 'Cartesian' : 'Direct';
    coordStart++;
  }

  // Build atom list
  const atoms: AtomInfo[] = [];
  let lineIdx = coordStart;
  for (let e = 0; e < elements.length; e++) {
    for (let c = 0; c < (counts[e] || 0); c++) {
      if (lineIdx >= lines.length) break;
      const parts = lines[lineIdx].trim().split(/\s+/);
      let pos: [number, number, number] = [
        parseFloat(parts[0]) || 0,
        parseFloat(parts[1]) || 0,
        parseFloat(parts[2]) || 0,
      ];
      // Convert fractional to Cartesian
      if (coordType === 'Direct' || coordType.toLowerCase().startsWith('d')) {
        pos = [
          pos[0] * lattice[0][0] + pos[1] * lattice[1][0] + pos[2] * lattice[2][0],
          pos[0] * lattice[0][1] + pos[1] * lattice[1][1] + pos[2] * lattice[2][1],
          pos[0] * lattice[0][2] + pos[1] * lattice[1][2] + pos[2] * lattice[2][2],
        ];
      }
      atoms.push({ element: elements[e], position: pos });
      lineIdx++;
    }
  }

  return { lattice, atoms, comment };
}

// Element colors (Jmol-inspired)
const ELEMENT_COLORS: Record<string, number> = {
  H: 0xffffff, He: 0xd9ffff, Li: 0xcc80ff, Be: 0xc2ff00, B: 0xffb5b5,
  C: 0x909090, N: 0x3050f8, O: 0xff0d0d, F: 0x90e050, Ne: 0xb3e3f5,
  Na: 0xab5cf2, Mg: 0x8aff00, Al: 0xbfa6a6, Si: 0xf0c8a0, P: 0xff8000,
  S: 0xffff30, Cl: 0x1ff01f, Ar: 0x80d1e3, K: 0x8f40d4, Ca: 0x3dff00,
  Sc: 0xe6e6e6, Ti: 0xbfc2c7, V: 0xa6a6ab, Cr: 0x8a99c7, Mn: 0x9c7ac7,
  Fe: 0xe06633, Co: 0xf090a0, Ni: 0x50d050, Cu: 0xc88033, Zn: 0x7d80b0,
  Ga: 0xc28f8f, Ge: 0x668f8f, As: 0xbd80e3, Se: 0xffa100, Br: 0xa62929,
  Kr: 0x5cb8d1, Rb: 0x702eb0, Sr: 0x00ff00, Y: 0x94ffff, Zr: 0x94e0e0,
  Nb: 0x73c2c9, Mo: 0x54b5b5, Tc: 0x3b9e9e, Ru: 0x248f8f, Rh: 0x0a7d8c,
  Pd: 0x006985, Ag: 0xc0c0c0, Cd: 0xffd98f, In: 0xa67573, Sn: 0x668080,
  Sb: 0x9e63b5, Te: 0xd47a00, I: 0x940094, Xe: 0x429eb0,
  Pt: 0xd0d0e0, Au: 0xffd123, Hg: 0xb8b8d0, Pb: 0x575961, Bi: 0x9e4fb5,
};

function getElementColor(el: string): number {
  return ELEMENT_COLORS[el] || 0x808080;
}

// Atomic radii (empirical, in Å)
function getElementRadius(el: string): number {
  const radii: Record<string, number> = { H: 0.25, C: 0.35, N: 0.35, O: 0.35, Fe: 0.50, Li: 0.45, Na: 0.60, K: 0.75, Pt: 0.55, Au: 0.55, Si: 0.45, Al: 0.50, Mg: 0.50, Ca: 0.60, Ti: 0.50, V: 0.50, Cr: 0.50, Mn: 0.50, Co: 0.50, Ni: 0.50, Cu: 0.50, Zn: 0.50 };
  return radii[el] || 0.40;
}

export default function StructureViewer({ content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string>('');

  useEffect(() => {
    if (!containerRef.current || !content) return;

    try {
      const data = parsePoscar(content);
      if (data.atoms.length === 0) {
        setError('No atoms found in POSCAR');
        return;
      }

      setInfo(`${data.comment} — ${data.atoms.length} atoms`);

      const container = containerRef.current;
      container.innerHTML = ''; // Clear previous

      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      // ── Scene setup ──
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(8, 5, 10);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // ── Controls ──
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;

      // ── Lighting ──
      scene.add(new THREE.AmbientLight(0x404060, 2));
      const dirLight = new THREE.DirectionalLight(0xffffff, 2);
      dirLight.position.set(10, 10, 10);
      scene.add(dirLight);
      const dirLight2 = new THREE.DirectionalLight(0x4488ff, 1);
      dirLight2.position.set(-5, 0, -5);
      scene.add(dirLight2);

      // ── Lattice box ──
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const boxEdges = new THREE.EdgesGeometry(boxGeo);
      const latticeLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }));
      scene.add(latticeLine);

      // Build transformation matrix from lattice vectors
      const a = data.lattice[0];
      const b = data.lattice[1];
      const c = data.lattice[2];
      // Normalize to unit cell
      const maxDim = Math.max(
        Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]),
        Math.sqrt(b[0]*b[0] + b[1]*b[1] + b[2]*b[2]),
        Math.sqrt(c[0]*c[0] + c[1]*c[1] + c[2]*c[2]),
      ) || 1;
      const scale = 5 / maxDim;

      // Draw atoms
      const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
      data.atoms.forEach(atom => {
        const color = getElementColor(atom.element);
        const radius = getElementRadius(atom.element) * scale * 0.5;
        const mat = new THREE.MeshPhongMaterial({ color, specular: 0x222222, shininess: 30 });
        const sphere = new THREE.Mesh(sphereGeo, mat);
        sphere.position.set(
          atom.position[0] * scale,
          atom.position[1] * scale,
          atom.position[2] * scale,
        );
        sphere.scale.setScalar(radius);
        scene.add(sphere);
      });

      // Draw unit cell wireframe
      const cellPoints = [
        [0,0,0], [a[0]*scale,a[1]*scale,a[2]*scale],
        [b[0]*scale,b[1]*scale,b[2]*scale],
        [(a[0]+b[0])*scale,(a[1]+b[1])*scale,(a[2]+b[2])*scale],
        [c[0]*scale,c[1]*scale,c[2]*scale],
        [(a[0]+c[0])*scale,(a[1]+c[1])*scale,(a[2]+c[2])*scale],
        [(b[0]+c[0])*scale,(b[1]+c[1])*scale,(b[2]+c[2])*scale],
        [(a[0]+b[0]+c[0])*scale,(a[1]+b[1]+c[1])*scale,(a[2]+b[2]+c[2])*scale],
      ];
      const edges = [[0,1],[0,2],[1,3],[2,3],[0,4],[1,5],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
      edges.forEach(([i, j]) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...cellPoints[i] as [number,number,number]),
          new THREE.Vector3(...cellPoints[j] as [number,number,number]),
        ]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.6 }));
        scene.add(line);
      });

      // ── Animation loop ──
      let animId: number;
      function animate() {
        animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      // Resize handler
      const onResize = () => {
        const w = container.clientWidth || 400;
        const h = container.clientHeight || 400;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        controls.dispose();
        container.innerHTML = '';
      };
    } catch (e: any) {
      setError(`3D render error: ${e.message}`);
    }
  }, [content]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', fontSize: 12 }}>
        ⚠ {error}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {info && (
        <div style={{
          position: 'absolute', bottom: 4, left: 4,
          fontSize: 10, color: '#888', background: 'rgba(10,10,26,0.8)',
          padding: '2px 6px', borderRadius: 3,
        }}>
          {info}
        </div>
      )}
    </div>
  );
}
